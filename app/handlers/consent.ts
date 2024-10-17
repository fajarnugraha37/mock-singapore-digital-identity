import { stringify } from "node:querystring";
import { randomUUID } from "node:crypto";
import { pick } from "@std/collections";
import { Hono, type Context } from "hono";
import * as cookie from 'hono/cookie';
import { render } from 'https://deno.land/x/mustache_ts@v0.4.1.1/mustache.ts';
import { API_CONTRACTS, COMMON_CONTRACTS } from "../config/contracts.ts";
import { lookUpByAuthCode } from "../util/index.ts";
import { myinfo } from "../util/assertions.json.ts";


export const authorize = (redirectTo: (v: string) => string) => (c: Context) => {
    const client_id = c.req.query('client_id');
    const redirect_uri = c.req.query('redirect_uri');
    const attributes = c.req.query('attributes');
    const purpose = c.req.query('purpose');
    const state = c.req.query('state');
    const relayStateParams = stringify({
        client_id,
        redirect_uri,
        state,
        purpose,
        scope: (attributes || '').replace(/,/g, ' '),
        realm: API_CONTRACTS.MYINFO_ASSERT_ENDPOINT,
        response_type: 'code',
    });
    const relayState = `${API_CONTRACTS.AUTHORIZE_ENDPOINT}${encodeURIComponent('?' + relayStateParams)}`;

    return c.redirect(redirectTo(relayState));
}

export const authorizeViaOIDC = authorize(
    (state) => `/singpass/authorize?client_id=MYINFO-CONSENTPLATFORM&redirect_uri=${API_CONTRACTS.MYINFO_ASSERT_ENDPOINT}&state=${state}`
)

export const authorizations: Record<string, any> = {};

export function getConsentHandler({ isStateless = false }) {
    const app = new Hono();

    app.get(API_CONTRACTS.MYINFO_ASSERT_ENDPOINT, (c) => {
        const rawArtifact = c.req.query('SAMLart') || c.req.query('code');
        const state = c.req.query('RelayState') || c.req.query('state');
        if(!rawArtifact || !state) {
            return c.json({
                message: 'Invalid request format',
                myinfoVersion: COMMON_CONTRACTS.MYINFO_VERSION,
            }, 400);
        }

        const artifact = rawArtifact.replace(/ /g, '+');
        const profile = lookUpByAuthCode(artifact, { isStateless }).profile;
        const { nric: id } = profile;
        const persona = myinfo[COMMON_CONTRACTS.MYINFO_VERSION].personas[id];
        if (!persona) {
            return c.json({
                message: 'Cannot find MyInfo Persona',
                artifact,
                myinfoVersion: COMMON_CONTRACTS.MYINFO_VERSION,
                id,
            }, 404);
        }

        cookie.setCookie(c, 'connect.sid', id);
        return c.redirect(state);
    });
    
    app.get(API_CONTRACTS.AUTHORIZE_ENDPOINT, (c) => {
        const scope = c.req.query('scope');
        if(!scope) {
            return c.json({
                message: 'Invalid request format',
                myinfoVersion: COMMON_CONTRACTS.MYINFO_VERSION,
            }, 400);
        }
        const params = {
            ...c.req.query(),
            scope: scope.replace(/\+/g, ' '),
            id: cookie.getCookie(c, 'connect.sid'),
            action: API_CONTRACTS.AUTHORIZE_ENDPOINT,
        };

        return c.html(render(COMMON_CONTRACTS.CONSENT_TEMPLATE, params));
    });

    app.post(API_CONTRACTS.AUTHORIZE_ENDPOINT, async (c) => {
        const id = cookie.getCookie(c, 'connect.sid');
        const code = randomUUID();
        const body = await c.req.parseBody({
            all: true,
        });
        const url = new URL(c.req.url);
        authorizations[code] = [
            {
                sub: id,
                auth_level: 0,
                scope: (body['scope'] as string).split(' '),
                iss: `${url.protocol}://${url.host}/consent/oauth2/consent/myinfo-com`,
                tokenName: 'access_token',
                token_type: 'Bearer',
                authGrantId: code,
                auditTrackingId: code,
                jti: code,
                aud: 'myinfo',
                grant_type: 'authorization_code',
                realm: '/consent/myinfo-com',
            },
            body['redirect_uri'],
        ];
        let callbackParams = stringify({
            state: (body.state as any),
            'error-description': 'Resource Owner did not authorize the request',
            error: 'access_denied',
        });
        if(body.decision === 'allow') {
            callbackParams = stringify({
                code,
                ...pick(body, ['state', 'scope', 'client_id']),
                iss: `${url.protocol}://${url.host}/consent/oauth2/consent/myinfo-com`,
            });
        }

        return c.redirect(`${body.redirect_uri}?${callbackParams}`);
    });

    return app;
}
