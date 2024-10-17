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