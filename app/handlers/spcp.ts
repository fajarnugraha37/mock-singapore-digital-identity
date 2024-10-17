import { Hono, type HonoRequest } from "hono";
import { oidc } from "@app-util/assertions.ts";
import { COMMON_CONTRACTS } from "@app-config/contracts.ts";


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
            return c.body(c.req.url);
        });
        app.get(`/${idp.toLowerCase()}/authorize/custom-profile`, (c) => {
            return c.body(c.req.url);
        });
        app.post(`/${idp.toLowerCase()}/token`, (c) => {
            return c.body(c.req.url);
        });
    }

    return app;
}