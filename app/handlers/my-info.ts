import { Hono, type Context } from "hono";
import { createVerify } from "node:crypto";
import * as jose from "node-jose";
import * as jwt from 'jsonwebtoken';
import { pki } from "@lib/signature/myinfo-signature.ts";
import { COMMON_CONTRACTS } from "@app-config/contracts.ts";
import { Buffer } from "node:buffer";
import { myinfo } from "@app-util/assertions.json.ts";
import { partition } from "@std/collections/partition";
import { pick } from "@std/collections/pick";
import { authorizations, authorizeViaOIDC } from "@app-handlers/consent.ts";


const verify = (signature: string, baseString: string, pubKey: Buffer) => {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(baseString);
    verifier.end();

    return verifier.verify(pubKey, signature, 'base64');
}

const encryptPersona = (cert: Buffer) => async (persona: any) => {
    /*
     * We sign and encrypt the persona. It's important to note that although a signature is
     * usually derived from the payload hash and is thus much smaller than the payload itself,
     * we're specifically contructeding a JWT, which contains the original payload.
     *
     * We then construct a JWE and provide two headers specifying the encryption algorithms used.
     * You can read about them here: https://www.rfc-editor.org/rfc/inline-errata/rfc7518.html
     *
     * These values weren't picked arbitrarily; they were the defaults used by a library we
     * formerly used: node-jose. We opted to continue using them for backwards compatibility.
     */
    const privateKey = await jose.importPKCS8(COMMON_CONTRACTS.MOCKPASS_PRIVATE_KEY.toString())
    const sign = await new jose.SignJWT(persona)
        .setProtectedHeader({ alg: 'RS256' })
        .sign(privateKey);
    const publicKey = await jose.importX509(cert.toString());
    const encryptedAndSignedPersona = await new jose.CompactEncrypt(Buffer.from(sign))
        .setProtectedHeader({ alg: 'RSA-OAEP', enc: 'A256GCM' })
        .encrypt(publicKey);

    return encryptedAndSignedPersona;
}

const lookupPerson = async (encryptMyInfo: boolean, cert: Buffer, version: string, c: Context, allowedAttributes: string[]) => {
    const requestedAttributes = (c.req.query('attributes') || '').split(',');
    const [attributes, disallowedAttributes] = partition(
        requestedAttributes,
        (v) => allowedAttributes.includes(v),
    );

    if (disallowedAttributes.length > 0) {
        return c.json({
            code: 401,
            message: 'Disallowed',
            fields: disallowedAttributes.join(','),
        }, 401);
    }
    const transformPersona = encryptMyInfo
        ? encryptPersona(cert)
        : (person: Record<string, any>) => person
    const persona = myinfo[version].personas[c.req.param('uinfin')] as Record<string, any>;

    return c.json(
        persona
            ? await transformPersona(pick(persona, attributes))
            : {
                code: 404,
                message: 'UIN/FIN does not exist in MyInfo.',
                fields: '',
            },
        (persona ? 200 : 404)
    );
}


export function getMyInfoHandler(
    version = 'v3',
    myInfoSignature = pki,
    serviceProvider = {
        cert: COMMON_CONTRACTS.SERVICE_PROVIDER_CERT,
        pubKey: COMMON_CONTRACTS.SERVICE_PROVIDER_PUB_KEY,
    },
    encryptMyInfo = true
) {
    const app = new Hono;
    const allowedAttributes = myinfo[version].attributes;

    app.get(`/myinfo/${version}/person-basic/:uinfin/`, async c => {
        // const authHeaders = c.req.header('Authorization').split(' ');
        const { signature, baseString } = myInfoSignature({
            authHeaders: c.req.header(),
            url: c.req.url,
            body: await c.req.parseBody({ all: true }),
            httpMethod: c.req.method,
            query: c.req.query(),
            context: {}
        });
        if (!verify(signature, baseString, serviceProvider.pubKey)) {
            return c.json({
                code: 403,
                message: `Signature verification failed, ${baseString} does not result in ${signature}`,
                fields: '',
            }, 403);
        }

        return await lookupPerson(encryptMyInfo, serviceProvider.cert, version, c, allowedAttributes.basic);
    });
    app.get(`/myinfo/${version}/person/:uinfin/`, async c => {
        const { signature, baseString } = encryptMyInfo
            ? myInfoSignature({
                authHeaders: c.req.header(),
                url: c.req.url,
                body: await c.req.parseBody({ all: true }),
                httpMethod: c.req.method,
                query: c.req.query(),
                context: {}
            })
            : {}

        const authz = c.req.header('Authorization').split(' ');
        const token = authz.pop();
        const { sub, scope } = jwt.verify(token, COMMON_CONTRACTS.MOCKPASS_PUBLIC_KEY, {
            algorithms: ['RS256'],
        });
        if (encryptMyInfo && !verify(signature, baseString, serviceProvider.pubKey)) {
            return c.json({
                code: 401,
                message: `Signature verification failed, ${baseString} does not result in ${signature}`,
            }, 401);
        }

        if (sub !== c.req.param('uinfin')) {
            return c.json({
                code: 401,
                message: 'UIN requested does not match logged in user',
            }, 401);
        }

        return await lookupPerson(encryptMyInfo, serviceProvider.cert, version, c, scope);
    });
    app.get(`/myinfo/${version}/authorise/`, authorizeViaOIDC);
    app.get(`/myinfo/${version}/token/`, async c => {
        const body = await c.req.parseBody({ all: true });
        const code = body.code as string;
        if (!code) {
            return c.json({
                code: 400,
                message: 'No such authorization given',
                fields: '',
            }, 400);
        }

        const [tokenTemplate, redirect_uri] = authorizations[code];
        if (!tokenTemplate) {
            return c.json({
                code: 400,
                message: 'No such authorization given',
                fields: '',
            }, 400);
        }
        const { signature, baseString } = COMMON_CONTRACTS.MYINFO_SECRET
            ? myInfoSignature({
                authHeaders: c.req.header(),
                url: c.req.url,
                body: await c.req.parseBody({ all: true }),
                httpMethod: c.req.method,
                query: c.req.query(),
                context: {
                    client_secret: COMMON_CONTRACTS.MYINFO_SECRET,
                    redirect_uri
                }
            })
            : {};
        if (COMMON_CONTRACTS.MYINFO_SECRET && !verify(signature, baseString, serviceProvider.pubKey)) {
            return c.json({
                code: 403,
                message: `Signature verification failed, ${baseString} does not result in ${signature}`,
            }, 403);
        }

        return c.json({
            access_token: jwt.sign(
                { ...tokenTemplate, auth_time: Date.now() },
                COMMON_CONTRACTS.MOCKPASS_PRIVATE_KEY,
                { expiresIn: '1800 seconds', algorithm: 'RS256' },
            ),
            token_type: 'Bearer',
            expires_in: 1798,
        });
    });

    return app;
}