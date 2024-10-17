import { Hono, type HonoRequest } from "hono";
import * as jose from "node-jose";
import { render } from "mustache_ts";
import * as log from "@std/log";
import { generateAuthCode, lookUpByAuthCode, idGenerator, buildAssertURL, oidc, sgIDScopeToMyInfoField } from "@app-util/index.ts";
import { myinfo } from "@app-util/assertions.json.ts";
import { COMMON_CONTRACTS, API_CONTRACTS } from "@app-config/index.ts";


export function getSgIdHandler(
    showLoginPage = (req: HonoRequest) => (req.header('X-Show-Login-Page') || Deno.env.get('SHOW_LOGIN_PAGE')) === 'true',
    serviceProvider = {
        cert: COMMON_CONTRACTS.SERVICE_PROVIDER_CERT,
        pubKey: COMMON_CONTRACTS.SERVICE_PROVIDER_PUB_KEY,
    },
    isStateless = COMMON_CONTRACTS.IS_STATELESS
) {
    const app = new Hono;

    const profiles = oidc.singPass;
    const defaultProfile = profiles.find((p) => p.nric === Deno.env.get('MOCKPASS_NRIC')) || profiles[0];

    app.get(`${API_CONTRACTS.PATH_PREFIX}/authorize`, (c) => {
        const { redirect_uri: redirectURI, client_id: clientId, state, nonce } = c.req.query();
        const scopes = c.req.query('scope') ?? 'openid';
        log.info(`Requested scope ${scopes}`);
        if (!state || !redirectURI || !clientId || !state) {
            return c.json({
                message: 'invalid format request'
            }, 400);
        }

        if (showLoginPage(c.req)) {
            const values = profiles
                .filter((profile) => myinfo.v3.personas[profile.nric])
                .map((profile) => {
                    const authCode = generateAuthCode(
                        { profile, scopes, nonce },
                        { isStateless },
                    );
                    const assertURL = buildAssertURL(redirectURI, authCode, state);
                    const id = idGenerator.singPass(profile);

                    return { id, assertURL };
                })

            return c.html(render(COMMON_CONTRACTS.LOGIN_TEMPLATE, { values }));
        }

        const profile = defaultProfile;
        const authCode = generateAuthCode(
            { profile, scopes, nonce },
            { isStateless },
        );
        const assertURL = buildAssertURL(redirectURI, authCode, state);
        log.info(`Redirecting login from ${clientId} to ${assertURL}`);

        return c.redirect(assertURL);
    });
    app.post(`${API_CONTRACTS.PATH_PREFIX}/token`, async (c) => {
        const url = new URL(c.req.url);
        const body = await c.req.parseBody({ all: true });
        const aud = body.client_id as string;
        const authCode = body.code as string;
        console.info(`Received auth code ${authCode} from ${aud} and ${body.redirect_uri}`);

        const { profile, scopes, nonce } = lookUpByAuthCode(authCode, { isStateless });
        console.info(`Profile ${JSON.stringify(profile)} with token scope ${scopes}`);
        const iss = `${url.protocol}://${url.host}${API_CONTRACTS.VERSION_PREFIX}`;

        const { idTokenClaims, refreshToken } = oidc.create.singPass(
            profile,
            iss,
            aud,
            nonce,
            authCode,
        );
        // Change sub from `s=${nric},u=${uuid}`
        // to `u=${uuid}` to be consistent with userinfo sub
        idTokenClaims.sub = idTokenClaims.sub.split(',')[1]

        const signingKey = await jose.JWK.asKey(COMMON_CONTRACTS.SPCP_KEY_PEM, 'pem');
        const idToken = await jose.JWS.createSign(
            { format: 'compact' },
            signingKey,
        )
            .update(JSON.stringify(idTokenClaims))
            .final();

        return c.json({
            access_token: authCode,
            refresh_token: refreshToken,
            expires_in: 24 * 60 * 60,
            scope: scopes,
            token_type: 'Bearer',
            id_token: idToken,
        });
    });
    app.get(`${API_CONTRACTS.PATH_PREFIX}/userinfo`, async (c) => {
        const authCode = (c.req.header('authorization') || c.req.header('Authorization')).replace('Bearer ', '');
        const { profile, scopes, unused } = lookUpByAuthCode(authCode, { isStateless });
        const uuid = profile.uuid;
        const nric = oidc.singPass.find((p) => p.uuid === uuid).nric;
        const persona = myinfo.v3.personas[nric];

        console.info(`userinfo scopes ${scopes}`);
        const payloadKey = await jose.JWK.createKey('oct', 256, {
            alg: 'A256GCM'
        });

        const encryptPayload = async (field) => {
            return await jose.JWE.createEncrypt({ format: 'compact' }, payloadKey)
                .update(field)
                .final()
        };
        const encryptedNric = await encryptPayload(nric);
        // sgID doesn't actually offer the openid scope yet
        const scopesArr = scopes
            .split(' ')
            .filter((field) => field !== 'openid' && field !== 'myinfo.nric_number');
        console.info(`userinfo scopesArr ${scopesArr}`);

        const myInfoFields = await Promise.all(
            scopesArr.map((scope) =>
                encryptPayload(sgIDScopeToMyInfoField(persona, scope)),
            ),
        );

        const data = {}
        scopesArr.forEach((name, index) => {
            data[name] = myInfoFields[index]
        });
        data['myinfo.nric_number'] = encryptedNric;
        const encryptionKey = await jose.JWK.asKey(serviceProvider.pubKey, 'pem');

        const plaintextPayloadKey = JSON.stringify(payloadKey.toJSON(true));
        const encryptedPayloadKey = await jose.JWE.createEncrypt(
            { format: 'compact' },
            encryptionKey,
        )
            .update(plaintextPayloadKey)
            .final()

        return c.json({
            sub: `u=${uuid}`,
            key: encryptedPayloadKey,
            data,
        });
    });

    app.get(`${API_CONTRACTS.VERSION_PREFIX}/.well-known/jwks.json`, async (c) => {
        const key = await jose.JWK.asKey(COMMON_CONTRACTS.SPCP_KEY_PEM, 'pem');
        const jwk = key.toJSON();
        jwk.use = 'sig';

        return c.json({
            keys: [jwk]
        });
    });
    app.get(`${API_CONTRACTS.VERSION_PREFIX}/.well-known/openid-configuration`, (c) => {
        const url = new URL(c.req.url);
        const issuer = `${url.protocol}://${url.host}${API_CONTRACTS.VERSION_PREFIX}`;
        const responseBody = {
            issuer,
            authorization_endpoint: `${issuer}/${API_CONTRACTS.OAUTH_PREFIX}/authorize`,
            token_endpoint: `${issuer}/${API_CONTRACTS.OAUTH_PREFIX}/token`,
            userinfo_endpoint: `${issuer}/${API_CONTRACTS.OAUTH_PREFIX}/userinfo`,
            jwks_uri: `${issuer}/.well-known/jwks.json`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code'],
            // Note: some of these scopes are not yet officially documented
            // in https://docs.id.gov.sg/data-catalog
            // So they are not officially supported yet.
            scopes_supported: [
                'openid',
                'myinfo.nric_number',
                'myinfo.name',
                'myinfo.email',
                'myinfo.sex',
                'myinfo.race',
                'myinfo.mobile_number',
                'myinfo.registered_address',
                'myinfo.date_of_birth',
                'myinfo.passport_number',
                'myinfo.passport_expiry_date',
                'myinfo.nationality',
                'myinfo.residentialstatus',
                'myinfo.residential',
                'myinfo.housingtype',
                'myinfo.hdbtype',
                'myinfo.birth_country',
                'myinfo.vehicles',
                'myinfo.name_of_employer',
                'myinfo.workpass_status',
                'myinfo.workpass_expiry_date',
                'myinfo.marital_status',
                'myinfo.mobile_number_with_country_code',
            ],
            id_token_signing_alg_values_supported: ['RS256'],
            subject_types_supported: ['pairwise'],
        };

        return c.json(responseBody);
    });


    return app;
}