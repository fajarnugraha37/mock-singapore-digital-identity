import { myinfo } from './assertions.json.ts';
import type { HonoRequest } from "hono";

export const buildAssertURL = (redirectURI: string, authCode: string, state: string) =>
    `${redirectURI}?code=${encodeURIComponent(authCode)}&state=${encodeURIComponent(state)}`;

export const idGenerator = {
    singPass: ({ nric }) => myinfo.v3.personas[nric] ? `${nric} [MyInfo]` : nric,
    corpPass: ({ nric, uen }) => `${nric} / UEN: ${uen}`,
}

export const customProfileFromHeaders = {
    singPass: (req: HonoRequest) => {
        const customNricHeader = req.header('X-Custom-NRIC');
        const customUuidHeader = req.header('X-Custom-UUID');
        if (!customNricHeader || !customUuidHeader) {
            return false;
        }
        return { 
            nric: customNricHeader, 
            uuid: customUuidHeader,
         };
    },
    corpPass: (req: HonoRequest) => {
        const customNricHeader = req.header('X-Custom-NRIC');
        const customUuidHeader = req.header('X-Custom-UUID');
        const customUenHeader = req.header('X-Custom-UEN');
        if (!customNricHeader || !customUuidHeader || !customUenHeader) {
            return false;
        }

        return {
            nric: customNricHeader,
            uuid: customUuidHeader,
            uen: customUenHeader,
        };
    },
}