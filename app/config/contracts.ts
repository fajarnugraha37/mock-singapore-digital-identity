import { readFileAsBuffer, readFileAsUtf8 } from "../util/file.ts";


export const API_CONTRACTS = {
    VERSION_PREFIX: '/v2',
    OAUTH_PREFIX: '/oauth',
    PATH_PREFIX: '',
    MYINFO_ASSERT_ENDPOINT: '/consent/myinfo-com',
    AUTHORIZE_ENDPOINT: '/consent/oauth2/authorize',
}
API_CONTRACTS.PATH_PREFIX = API_CONTRACTS.VERSION_PREFIX + API_CONTRACTS.OAUTH_PREFIX;


export const COMMON_CONTRACTS = {
    MYINFO_VERSION: 'v3',
    AUTH_CODE_TIMEOUT: 5 * 60 * 1000,
    REFRESH_TOKEN_TIMEOUT: 24 * 60 * 60 * 1000,
    LOGIN_TEMPLATE: readFileAsUtf8('static/html/login-page.html'),
    MY_INFO_V3: JSON.parse(readFileAsUtf8('static/private/myinfo/v3.json')),
    SPCP_KEY_PEM: readFileAsBuffer('static/private/certs/spcp-key.pem'),
    CONSENT_TEMPLATE: readFileAsUtf8('static/html/consent.html'),
    MOCKPASS_PRIVATE_KEY: readFileAsBuffer('static/private/certs/spcp-key.pem'),
    MOCKPASS_PUBLIC_KEY: readFileAsBuffer('static/private/certs/spcp.crt'),
    MYINFO_SECRET: Deno.env.get('SERVICE_PROVIDER_MYINFO_SECRET') ?? 'secret',

    ASP_PUBLIC: readFileAsBuffer('static/private/certs/oidc-v2-asp-public.json'),
    ASP_SECRET: readFileAsBuffer('static/private/certs/oidc-v2-asp-secret.json'),
    RP_PUBLIC: readFileAsBuffer('static/private/certs/oidc-v2-rp-public.json'),
    SINGPASS_TOKEN_ENDPOINT_AUTH_SIGNING_ALG_VALUES_SUPPORTED: [
        'ES256',
        'ES384',
        'ES512',
    ],
    CORPPASS_TOKEN_ENDPOINT_AUTH_SIGNING_ALG_VALUES_SUPPORTED: ['ES256'],
    SINGPASS_ID_TOKEN_ENCRYPTION_ALG_VALUES_SUPPORTED: [
        'ECDH-ES+A256KW',
        'ECDH-ES+A192KW',
        'ECDH-ES+A128KW',
        'RSA-OAEP-256',
    ],
    CORPPASS_ID_TOKEN_ENCRYPTION_ALG_VALUES_SUPPORTED: [
        'ECDH-ES+A256KW'
    ],
    ID_TOKEN_ENCRYPTION_ALG_VALUES_SUPPORTED: {
        singPass: [],
        corpPass: [],
    }
}
COMMON_CONTRACTS.ID_TOKEN_ENCRYPTION_ALG_VALUES_SUPPORTED = {
    singPass: COMMON_CONTRACTS.SINGPASS_ID_TOKEN_ENCRYPTION_ALG_VALUES_SUPPORTED,
    corpPass: COMMON_CONTRACTS.CORPPASS_ID_TOKEN_ENCRYPTION_ALG_VALUES_SUPPORTED,
}