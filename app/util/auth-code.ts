import { randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { ExpiryMap } from "@lib/index.ts";
import { COMMON_CONTRACTS } from "@app-config/contracts.ts";

const profileAndNonceStore = new ExpiryMap(COMMON_CONTRACTS.AUTH_CODE_TIMEOUT);

export const generateAuthCode = ({ profile, scopes, nonce }, { isStateless = false }) => {
    const authCode = isStateless
        ? Buffer.from(JSON.stringify({ profile, scopes, nonce })).toString('base64url')
        : randomBytes(45).toString('base64');
    profileAndNonceStore.set(authCode, { profile, scopes, nonce });

    return authCode
}

export const lookUpByAuthCode = (authCode: string, { isStateless = false }) => {
    return isStateless
        ? JSON.parse(Buffer.from(authCode, 'base64url').toString('utf-8'))
        : profileAndNonceStore.get(authCode);
}