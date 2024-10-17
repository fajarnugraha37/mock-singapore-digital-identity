import { randomBytes } from 'node:crypto';
import { JWK, JWS } from 'node-jose';
import { singPassAccounts, corpPassAccounts } from './assertions.json.ts';
import { hashToken } from "./crypto.ts";
import { COMMON_CONTRACTS } from "../config/contracts.ts";

export const signingPem = COMMON_CONTRACTS.SPCP_KEY_PEM;

export const oidc = {
    singPass: singPassAccounts,
    corpPass: corpPassAccounts,
    create: {
        singPass: ({ nric, uuid }, iss, aud, nonce, accessToken = randomBytes(15).toString('hex'),) => {
            const sfa = {
                Y4581892I: { fid: 'G730Z-H5P96', coi: 'DE', RP: 'CORPPASS' },
                Y7654321K: { fid: '123456789', coi: 'CN', RP: 'IRAS' },
                Y1234567P: { fid: 'G730Z-H5P96', coi: 'MY', RP: 'CORPPASS' },
            };
            let sub = `s=${nric},u=${uuid}`;
            if (nric.startsWith('Y')) {
                const sfaAccount = sfa[nric]
                    ? sfa[nric]
                    : { fid: 'G730Z-H5P96', coi: 'DE', RP: 'CORPPASS' }
                sub = `s=${nric},fid=${sfaAccount.fid},coi=${sfaAccount.coi},u=${uuid}`
            };
            const accessTokenHash = hashToken(accessToken);
            const refreshToken = randomBytes(20).toString('hex');
            const refreshTokenHash = hashToken(refreshToken);

            return {
                accessToken,
                refreshToken,
                idTokenClaims: {
                    rt_hash: refreshTokenHash,
                    at_hash: accessTokenHash,
                    iat: Math.floor(Date.now() / 1000),
                    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
                    iss,
                    amr: ['pwd'],
                    aud,
                    sub,
                    ...(nonce ? { nonce } : {}),
                },
            };
        },
        corpPass: async ({ nric, uuid, name, isSingPassHolder, uen }, iss, aud, nonce) => {
            const baseClaims = {
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
                iss,
                aud,
            };
            const sub = `s=${nric},u=${uuid},c=SG`;
            const accessTokenClaims = {
                ...baseClaims,
                authorization: {
                    EntityInfo: {},
                    AccessInfo: {},
                    TPAccessInfo: {},
                },
            };

            const signingKey = await JWK.asKey(signingPem, 'pem')
            const accessToken = await JWS.createSign(
                { format: 'compact' },
                signingKey,
            )
                .update(JSON.stringify(accessTokenClaims))
                .final()

            const accessTokenHash = hashToken(accessToken)

            const refreshToken = randomBytes(20).toString('hex')
            const refreshTokenHash = hashToken(refreshToken)

            return {
                accessToken,
                refreshToken,
                idTokenClaims: {
                    ...baseClaims,
                    rt_hash: refreshTokenHash,
                    at_hash: accessTokenHash,
                    amr: ['pwd'],
                    sub,
                    ...(nonce ? { nonce } : {}),
                    userInfo: {
                        CPAccType: 'User',
                        CPUID_FullName: name,
                        ISSPHOLDER: isSingPassHolder ? 'YES' : 'NO',
                    },
                    entityInfo: {
                        CPEntID: uen,
                        CPEnt_TYPE: 'UEN',
                        CPEnt_Status: 'Registered',
                        CPNonUEN_Country: '',
                        CPNonUEN_RegNo: '',
                        CPNonUEN_Name: '',
                    },
                },
            };
        },
    },
}