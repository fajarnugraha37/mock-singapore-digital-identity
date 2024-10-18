import { Hono, type HonoRequest } from "hono";
import { Buffer } from "node:buffer";
import * as jose from "node-jose";
import { oidc } from "@app-util/assertions.ts";
import { COMMON_CONTRACTS } from "@app-config/contracts.ts";
import { ExpiryMap } from "@lib/index.ts";
import { generateAuthCode, lookUpByAuthCode } from "@app-util/auth-code.ts";
import { buildAssertURL, customProfileFromHeaders, idGenerator } from "@app-util/http.ts";
import { render } from "mustache_ts";


const profileStore = new ExpiryMap(COMMON_CONTRACTS.REFRESH_TOKEN_TIMEOUT);

export function getSPCPHandler(
    showLoginPage = (req: HonoRequest) => (req.header('X-Show-Login-Page') || Deno.env.get('SHOW_LOGIN_PAGE')) === 'true',
    serviceProvider = {
        cert: COMMON_CONTRACTS.SERVICE_PROVIDER_CERT,
        pubKey: COMMON_CONTRACTS.SERVICE_PROVIDER_PUB_KEY,
    },
    isStateless = COMMON_CONTRACTS.IS_STATELESS
) {
    const app = new Hono;

    for (const idp of ['singPass', 'corpPass']) {
        const profiles = oidc[idp];
        const defaultProfile = profiles.find((p) => p.nric === Deno.env.get('MOCKPASS_NRIC')) || profiles[0];

        app.get(`/${idp.toLowerCase()}/authorize`, (c) => {
            const { client_id: clientId, redirect_uri: redirectURI, state, nonce } = c.req.query();
            if (showLoginPage(c.req)) {
                const values = profiles.map((profile) => {
                    const authCode = generateAuthCode({ profile, scopes: null, nonce }, { isStateless });
                    const assertURL = buildAssertURL(redirectURI, authCode, state);
                    const id = idGenerator[idp](profile);

                    return { id, assertURL };
                })

                return c.html(render(COMMON_CONTRACTS.LOGIN_TEMPLATE, {
                    values,
                    customProfileConfig: {
                        endpoint: `/${idp.toLowerCase()}/authorize/custom-profile`,
                        showUuid: true,
                        showUen: idp === 'corpPass',
                        redirectURI,
                        state,
                        nonce,
                    },
                }));
            }

            const profile = customProfileFromHeaders[idp](c.req) || defaultProfile;
            const authCode = generateAuthCode({ profile, nonce, scopes: null }, { isStateless });
            const assertURL = buildAssertURL(redirectURI, authCode, state);
            console.warn(`Redirecting login from ${clientId} to ${redirectURI}`);

            return c.redirect(assertURL);
        });
        app.get(`/${idp.toLowerCase()}/authorize/custom-profile`, (c) => {
            const { nric, uuid, uen, redirectURI, state, nonce } = c.req.query();

            const profile = { nric, uuid };
            if (idp === 'corpPass') {
                profile['name'] = `Name of ${nric}`;
                profile['isSingPassHolder'] = false;
                profile['uen'] = uen;
            }

            const authCode = generateAuthCode({ profile, nonce, scopes: null }, { isStateless });
            const assertURL = buildAssertURL(redirectURI, authCode, state);

            return c.redirect(assertURL);
        });
        app.post(`/${idp.toLowerCase()}/token`, async (c) => {
            const url = new URL(c.req.url);
            const { client_id: aud, grant_type: grant } = await c.req.parseBody({ all: true });
            let profile, nonce;
            if (grant === 'refresh_token') {
                const { refresh_token: suppliedRefreshToken } = await c.req.parseBody({ all: true });
                console.warn(`Refreshing tokens with ${suppliedRefreshToken}`);

                profile = isStateless
                    ? JSON.parse(Buffer.from(suppliedRefreshToken as string, 'base64url').toString('utf-8'))
                    : profileStore.get(suppliedRefreshToken);
            } else {
                const { code: authCode, redirect_uri: redirectUri } = await c.req.parseBody({ all: true });
                console.warn(`Received auth code ${authCode} from ${aud} and ${redirectUri}`);
                ({ profile, nonce } = lookUpByAuthCode(authCode as string, { isStateless }));
            }

            const iss = `${url.protocol}://${url.host}`;
            const {
                idTokenClaims,
                accessToken,
                refreshToken: generatedRefreshToken,
            } = await oidc.create[idp](profile, iss, aud, nonce);

            const refreshToken = isStateless
                ? Buffer.from(JSON.stringify(profile)).toString('base64url')
                : generatedRefreshToken;
            profileStore.set(refreshToken, profile);

            const signingKey = await jose.JWK.asKey(COMMON_CONTRACTS.SPCP_KEY_PEM, 'pem');
            const signedIdToken = await jose.JWS.createSign({ format: 'compact' }, signingKey)
                .update(JSON.stringify(idTokenClaims))
                .final();

            const encryptionKey = await jose.JWK.asKey(serviceProvider.cert, 'pem');
            const idToken = await jose.JWE.createEncrypt({ format: 'compact', fields: { cty: 'JWT' } }, encryptionKey)
                .update(signedIdToken)
                .final()

            return c.json({
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_in: 24 * 60 * 60,
                scope: 'openid',
                token_type: 'bearer',
                id_token: idToken,
            });
        });
    }

    return app;
}