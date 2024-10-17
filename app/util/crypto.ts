import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

const fromBase64 = (base64String: string) => base64String
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

export const hashToken = (token: string): string => {
    const fullHash = createHash('sha256');
    fullHash.update(token, 'utf8');
    const fullDigest = fullHash.digest();
    const digestBuffer = fullDigest.slice(0, fullDigest.length / 2);
    if (Buffer.isEncoding('base64url')) {
        return digestBuffer.toString('base64url');
    }

    return fromBase64(digestBuffer.toString('base64'));
}

export function findEcdhEsEncryptionKey(jwks: any, crv: string, algs: string[]) {
    let encryptionKey = jwks.keys.find((item) =>
        item.use === 'enc' &&
        item.kty === 'EC' &&
        item.crv === crv &&
        (!item.alg ||
            (item.alg === 'ECDH-ES+A256KW' &&
                algs.some((alg) => alg === item.alg))),
    );
    if (encryptionKey) {
        return {
            ...encryptionKey,
            ...(!encryptionKey.alg ? { alg: 'ECDH-ES+A256KW' } : {}),
        }
    }

    encryptionKey = jwks.keys.find((item) =>
        item.use === 'enc' &&
        item.kty === 'EC' &&
        item.crv === crv &&
        (!item.alg ||
            (item.alg === 'ECDH-ES+A192KW' &&
                algs.some((alg) => alg === item.alg))),
    );
    if (encryptionKey) {
        return {
            ...encryptionKey,
            ...(!encryptionKey.alg ? { alg: 'ECDH-ES+A256KW' } : {}),
        }
    }

    encryptionKey = jwks.keys.find((item) =>
        item.use === 'enc' &&
        item.kty === 'EC' &&
        item.crv === crv &&
        (!item.alg ||
            (item.alg === 'ECDH-ES+A128KW' &&
                algs.some((alg) => alg === item.alg))),
    );
    if (encryptionKey) {
        return {
            ...encryptionKey,
            ...(!encryptionKey.alg ? { alg: 'ECDH-ES+A256KW' } : {}),
        }
    }

    return null
}

export function findEncryptionKey(jwks: any, algs: string[]) {
    let encryptionKey = findEcdhEsEncryptionKey(jwks, 'P-521', algs)
    if (encryptionKey) {
        return encryptionKey
    }
    if (!encryptionKey) {
        encryptionKey = findEcdhEsEncryptionKey(jwks, 'P-384', algs)
    }
    if (encryptionKey) {
        return encryptionKey
    }
    if (!encryptionKey) {
        encryptionKey = findEcdhEsEncryptionKey(jwks, 'P-256', algs)
    }
    if (encryptionKey) {
        return encryptionKey
    }
    if (!encryptionKey) {
        encryptionKey = jwks.keys.find(
            (item) =>
                item.use === 'enc' &&
                item.kty === 'RSA' &&
                (!item.alg ||
                    (item.alg === 'RSA-OAEP-256' &&
                        algs.some((alg) => alg === item.alg))),
        )
    }
    if (encryptionKey) {
        return { ...encryptionKey, alg: 'RSA-OAEP-256' }
    }
}