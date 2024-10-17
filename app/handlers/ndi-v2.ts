import { Hono, type HonoRequest } from "hono";
import { COMMON_CONTRACTS } from "@app-config/contracts.ts";
import { oidc } from "@app-util/assertions.ts";


export function getNDIV2Handler(
    showLoginPage = (req: HonoRequest) => (req.header('X-Show-Login-Page') || Deno.env.get('SHOW_LOGIN_PAGE')) === 'true',
    isStateless = COMMON_CONTRACTS.IS_STATELESS
) {
    const app = new Hono;

    for (const idp of ['singPass', 'corpPass']) {
        const profiles = oidc[idp]
        const defaultProfile = profiles.find((p) => p.nric === Deno.env.get('MOCKPASS_NRIC')) || profiles[0];


        app.get(`/${idp.toLowerCase()}/v2/authorize`, (c) => {
            return c.body(c.req.url);
        });
        app.get(`/${idp.toLowerCase()}/v2/authorize/custom-profile`, (c) => {
            return c.body(c.req.url);
        });
        app.get(`/${idp.toLowerCase()}/v2/token`, (c) => {
            return c.body(c.req.url);
        });
        app.get(`/${idp.toLowerCase()}/v2/.well-known/openid-configuration`, (c) => {
            return c.body(c.req.url);
        });
        app.get(`/${idp.toLowerCase()}/v2/.well-known/keys`, (c) => {
            return c.body(c.req.url);
        });
    }

    return app;
}