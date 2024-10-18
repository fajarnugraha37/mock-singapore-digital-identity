import { Hono, type HonoRequest } from "hono";
import { render } from "mustache_ts";
import * as jose from "node-jose";
import { COMMON_CONTRACTS } from "@app-config/contracts.ts";
import { oidc } from "@app-util/assertions.ts";
import { generateAuthCode, lookUpByAuthCode } from "@app-util/auth-code.ts";
import { buildAssertURL, customProfileFromHeaders, idGenerator } from "@app-util/http.ts";
import { findEncryptionKey } from "@app-util/crypto.ts";


export function getNDIV2Handler(
    showLoginPage = (req: HonoRequest) => (req.header('X-Show-Login-Page') || Deno.env.get('SHOW_LOGIN_PAGE')) === 'true',
    isStateless = COMMON_CONTRACTS.IS_STATELESS
) {
    const app = new Hono;

    for (const idp of ['singPass', 'corpPass']) {
        const profiles = oidc[idp]
        const defaultProfile = profiles.find((p: Record<string, any>) => p.nric === Deno.env.get('MOCKPASS_NRIC')) || profiles[0];

        app.get(`/${idp.toLowerCase()}/v2/authorize`, (c) => {
            const {
                scope,
                response_type,
                client_id,
                redirect_uri: redirectURI,
                state,
                nonce,
            } = c.req.query();

            if (scope !== 'openid') {
                return c.json({
                    error: 'invalid_scope',
                    error_description: `Unknown scope ${scope}`,
                }, 400);
            }
            if (response_type !== 'code') {
                return c.json({
                    error: 'unsupported_response_type',
                    error_description: `Unknown response_type ${response_type}`,
                }, 400);
            }
            if (!client_id) {
                return c.json({
                    error: 'invalid_request',
                    error_description: 'Missing client_id',
                }, 400);
            }
            if (!redirectURI) {
                return c.json({
                    error: 'invalid_request',
                    error_description: 'Missing redirect_uri',
                }, 400);
            }
            if (!nonce) {
                return c.json({
                    error: 'invalid_request',
                    error_description: 'Missing nonce',
                }, 400);
            }
            if (!state) {
                return c.json({
                    error: 'invalid_request',
                    error_description: 'Missing state',
                }, 400);
            }

            // Identical to OIDC v1
            if (showLoginPage(c.req)) {
                const values = profiles.map((profile) => {
                    const authCode = generateAuthCode({ profile, scopes: scope, nonce }, { isStateless });
                    const assertURL = buildAssertURL(redirectURI, authCode, state);
                    const id = idGenerator[idp](profile);

                    return { id, assertURL };
                })

                return c.html(render(COMMON_CONTRACTS.LOGIN_TEMPLATE, {
                    values,
                    customProfileConfig: {
                        endpoint: `/${idp.toLowerCase()}/v2/authorize/custom-profile`,
                        showUuid: true,
                        showUen: idp === 'corpPass',
                        redirectURI,
                        state,
                        nonce,
                    },
                }));
            }

            const profile = customProfileFromHeaders[idp](c.req) || defaultProfile
            const authCode = generateAuthCode({ profile, scopes: scope, nonce }, { isStateless });
            const assertURL = buildAssertURL(redirectURI, authCode, state);
            console.warn(`Redirecting login from ${client_id} to ${redirectURI}`);

            return c.redirect(assertURL);
        });
        app.get(`/${idp.toLowerCase()}/v2/authorize/custom-profile`, (c) => {
            const { nric, uuid, uen, redirectURI, state, nonce } = c.req.query();
            const profile = { nric, uuid };
            if (idp === 'corpPass') {
                profile['name'] = `Name of ${nric}`
                profile['isSingPassHolder'] = false
                profile['uen'] = uen
            }

            const authCode = generateAuthCode({ profile, scopes: null, nonce }, { isStateless });
            const assertURL = buildAssertURL(redirectURI, authCode, state);

            return c.redirect(assertURL);
        });
        app.get(`/${idp.toLowerCase()}/v2/token`, async (c) => {
            const url = new URL(c.req.url);
            const {
                client_id,
                redirect_uri: redirectURI,
                grant_type,
                code: authCode,
                client_assertion_type,
                client_assertion: clientAssertion,
            } = await c.req.parseBody({ all: true });

            // Only SP requires client_id
            if (idp === 'singPass' && !client_id) {
                console.error('Missing client_id')
                return c.json({
                    error: 'invalid_request',
                    error_description: 'Missing client_id',
                }, 400);
            }
            if (!redirectURI) {
                console.error('Missing redirect_uri')
                return c.json({
                    error: 'invalid_request',
                    error_description: 'Missing redirect_uri',
                }, 400);
            }
            if (grant_type !== 'authorization_code') {
                console.error('Unknown grant_type', grant_type)
                return c.json({
                    error: 'unsupported_grant_type',
                    error_description: `Unknown grant_type ${grant_type}`,
                }, 400);
            }
            if (!authCode) {
                return c.json({
                    error: 'invalid_request',
                    error_description: 'Missing code',
                }, 400);
            }
            if (
                client_assertion_type !==
                'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
            ) {
                console.error('Unknown client_assertion_type', client_assertion_type)
                return c.json({
                    error: 'invalid_request',
                    error_description: `Unknown client_assertion_type ${client_assertion_type}`,
                }, 400);
            }
            if (!clientAssertion) {
                console.error('Missing client_assertion')
                return c.json({
                    error: 'invalid_request',
                    error_description: 'Missing client_assertion',
                }, 400);
            }

            // Step 0: Get the RP keyset
            const rpJwksEndpoint = idp === 'singPass'
                ? Deno.env.get('SP_RP_JWKS_ENDPOINT')
                : Deno.env.get('CP_RP_JWKS_ENDPOINT');

            let rpKeysetString: string;
            if (rpJwksEndpoint) {
                try {
                    const rpKeysetResponse = await fetch(rpJwksEndpoint, {
                        method: 'GET',
                    });
                    rpKeysetString = await rpKeysetResponse.text();
                    if (!rpKeysetResponse.ok) {
                        throw new Error(rpKeysetString)
                    }
                } catch (e) {
                    console.error(
                        'Failed to fetch RP JWKS from',
                        rpJwksEndpoint,
                        e.message,
                    );

                    return c.json({
                        error: 'invalid_client',
                        error_description: `Failed to fetch RP JWKS from specified endpoint: ${e.message}`,
                    }, 400);
                }
            } else {
                // If the endpoint is not defined, default to the sample keyset we provided.
                rpKeysetString = COMMON_CONTRACTS.RP_PUBLIC;
            }

            let rpKeysetJson: Record<string, any>;
            try {
                rpKeysetJson = JSON.parse(rpKeysetString);
            } catch (e) {
                console.error('Unable to parse RP keyset', e.message);
                return c.json({
                    error: 'invalid_client',
                    error_description: `Unable to parse RP keyset: ${e.message}`,
                }, 400);
            }

            const rpKeyset = jose.createLocalJWKSet(rpKeysetJson);
            // Step 0.5: Verify client assertion with RP signing key
            let clientAssertionResult;
            try {
                clientAssertionResult = await jose.jwtVerify(
                    clientAssertion,
                    rpKeyset,
                );
            } catch (e) {
                console.error(
                    'Unable to verify client_assertion',
                    e.message,
                    clientAssertion,
                );

                return c.json({
                    error: 'invalid_client',
                    error_description: `Unable to verify client_assertion: ${e.message}`,
                }, 401);
            }

            const { payload: clientAssertionClaims, protectedHeader } = clientAssertionResult;
            console.debug(
                'Received client_assertion',
                clientAssertionClaims,
                protectedHeader,
            );
            if (!COMMON_CONTRACTS.TOKEN_ENDPOINT_AUTH_SIGNING_ALG_VALUES_SUPPORTED[idp].some((item) => item === protectedHeader.alg)) {
                console.warn(
                    'The client_assertion alg',
                    protectedHeader.alg,
                    'does not meet required token_endpoint_auth_signing_alg_values_supported',
                    COMMON_CONTRACTS.TOKEN_ENDPOINT_AUTH_SIGNING_ALG_VALUES_SUPPORTED[idp],
                );
            }

            if (!protectedHeader.typ) {
                console.error('The client_assertion typ should be set');

                return c.json({
                    error: 'invalid_client',
                    error_description: 'The client_assertion typ should be set',
                }, 401);
            }

            if (idp === 'singPass') {
                if (clientAssertionClaims['sub'] !== client_id) {
                    console.error(
                        'Incorrect sub in client_assertion claims. Found',
                        clientAssertionClaims['sub'],
                        'but should be',
                        client_id,
                    );

                    return c.json({
                        error: 'invalid_client',
                        error_description: 'Incorrect sub in client_assertion claims',
                    }, 401);
                }
            } else {
                // Since client_id is not given for corpPass, sub claim is required in
                // order to get aud for id_token.
                if (!clientAssertionClaims['sub']) {
                    console.error('Missing sub in client_assertion claims')
                    
                    return c.json({
                        error: 'invalid_client',
                        error_description: 'Missing sub in client_assertion claims',
                    }, 401);
                }
            }

            // According to OIDC spec, asp must check the aud claim.
            const iss = `${url.protocol}://${url.host}/${idp.toLowerCase()}/v2`;
            if (clientAssertionClaims['aud'] !== iss) {
                console.error(
                    'Incorrect aud in client_assertion claims. Found',
                    clientAssertionClaims['aud'],
                    'but should be',
                    iss,
                );

                return c.json({
                    error: 'invalid_client',
                    error_description: 'Incorrect aud in client_assertion claims',
                }, 401);
            }

            // Step 1: Obtain profile for which the auth code requested data for
            const { profile, nonce } = lookUpByAuthCode(authCode as string, { isStateless });

            // Step 2: Get ID token
            const aud = clientAssertionClaims['sub'];
            console.debug('Received token request', {
                code: authCode,
                client_id: aud,
                redirect_uri: redirectURI,
            });

            const { idTokenClaims, accessToken } = await oidc.create[idp](profile, iss, aud, nonce);

            // Step 3: Sign ID token with ASP signing key
            const aspKeyset = JSON.parse(COMMON_CONTRACTS.ASP_SECRET);
            const aspSigningKey = aspKeyset.keys.find((item) => item.use === 'sig' && item.kty === 'EC' && item.crv === 'P-256');
            if (!aspSigningKey) {
                console.error('No suitable signing key found', aspKeyset.keys);

                return c.json({
                    error: 'invalid_request',
                    error_description: 'No suitable signing key found',
                }, 400);
            }
            const signingKey = await jose.importJWK(aspSigningKey, 'ES256');
            const signedProtectedHeader = {
                alg: 'ES256',
                typ: 'JWT',
                kid: aspSigningKey.kid,
            };
            const signedIdToken = await new jose.CompactSign(new TextEncoder().encode(JSON.stringify(idTokenClaims)))
                .setProtectedHeader(signedProtectedHeader)
                .sign(signingKey);

            // Step 4: Encrypt ID token with RP encryption key
            const rpEncryptionKey = findEncryptionKey(
                rpKeysetJson,
                COMMON_CONTRACTS.ID_TOKEN_ENCRYPTION_ALG_VALUES_SUPPORTED[idp],
            );
            if (!rpEncryptionKey) {
                console.error('No suitable encryption key found', rpKeysetJson.keys)
                
                return c.json({
                    error: 'invalid_request',
                    error_description: 'No suitable encryption key found',
                }, 400);
            }
            console.debug('Using encryption key', rpEncryptionKey);
            const encryptedProtectedHeader = {
                alg: rpEncryptionKey.alg,
                typ: 'JWT',
                kid: rpEncryptionKey.kid,
                enc: 'A256CBC-HS512',
                cty: 'JWT',
            };
            const idToken = await new jose.CompactEncrypt(new TextEncoder().encode(signedIdToken))
                .setProtectedHeader(encryptedProtectedHeader)
                .encrypt(await jose.importJWK(rpEncryptionKey, rpEncryptionKey.alg))

            console.debug('ID Token', idToken);
            // Step 5: Send token
            c.json({
                access_token: accessToken,
                token_type: 'Bearer',
                id_token: idToken,
                ...(idp === 'corpPass'
                    ? { scope: 'openid', expires_in: 10 * 60 }
                    : {}),
            });
        });
        app.get(`/${idp.toLowerCase()}/v2/.well-known/openid-configuration`, (c) => {
            const url = new URL(c.req.url);
            const baseUrl = `${url.protocol}://${url.host}/${idp.toLowerCase()}/v2`;

            // Note: does not support backchannel auth
            const data = {
                issuer: baseUrl,
                authorization_endpoint: `${baseUrl}/authorize`,
                jwks_uri: `${baseUrl}/.well-known/keys`,
                response_types_supported: ['code'],
                scopes_supported: ['openid'],
                subject_types_supported: ['public'],
                claims_supported: ['nonce', 'aud', 'iss', 'sub', 'exp', 'iat'],
                grant_types_supported: ['authorization_code'],
                token_endpoint: `${baseUrl}/token`,
                token_endpoint_auth_methods_supported: ['private_key_jwt'],
                token_endpoint_auth_signing_alg_values_supported: COMMON_CONTRACTS.TOKEN_ENDPOINT_AUTH_SIGNING_ALG_VALUES_SUPPORTED[idp],
                id_token_signing_alg_values_supported: ['ES256'],
                id_token_encryption_alg_values_supported: COMMON_CONTRACTS.ID_TOKEN_ENCRYPTION_ALG_VALUES_SUPPORTED[idp],
                id_token_encryption_enc_values_supported: ['A256CBC-HS512'],
            };

            if (idp === 'corpPass') {
                data['claims_supported'] = [
                    ...data['claims_supported'],
                    'userInfo',
                    'EntityInfo',
                    'rt_hash',
                    'at_hash',
                    'amr',
                ]
                // Omit authorization-info_endpoint for CP
            };

            return c.json(data);
        });
        app.get(`/${idp.toLowerCase()}/v2/.well-known/keys`, (c) => {
            return c.json(JSON.parse(COMMON_CONTRACTS.ASP_PUBLIC));
        });
    }

    return app;
}