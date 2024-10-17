/* eslint-disable max-params */
import * as crypto from "node:crypto";
import * as jose from "node-jose";
import * as qs from "node:querystring";
import * as jwt from "jsonwebtoken";
import { deepMerge } from "@std/collections";
import { SingpassMyInfoError } from "@lib/errors/singpass-my-info.error.ts";

/**
 * Generate the Authorization header for requests to V3 MyInfo
 *
 * @param url
 * @param queryParams
 * @param method
 * @param appId
 * @param signingKey
 * @param signingKeyPassphrase
 */
export function generateMyInfoAuthorizationHeader(
	url: string,
	queryParams: { [key: string]: any },
	method: HttpMethod,
	appId: string,
	signingKey: string,
	nonce?: number,
	timestamp?: number,
	signingKeyPassphrase?: string,
) {
	const authHeaderObj: Partial<AuthHeader> = {
		app_id: appId, // App ID assigned to your application
		nonce, // secure random number
		signature_method: "RS256",
		timestamp, // Unix epoch time
	};

	const signature = generateSignature(authHeaderObj, queryParams, method, url, signingKey, signingKeyPassphrase);

	return generateAuthHeaderString(appId, nonce, signature, timestamp);
}

function generateAuthHeaderString(appId: string, nonceValue: any, signature: string, timestamp: number) {
	return (
		'PKI_SIGN app_id="' +
		appId + // Defaults to 1st part of incoming request hostname
		'",nonce="' +
		nonceValue +
		'",signature_method="RS256"' +
		',signature="' +
		signature +
		'",timestamp="' +
		timestamp +
		'"'
	);
}

/**
 * Function to generate signature for authenticated requests to myinfo v3
 *
 * @param authHeader
 * @param queryParams
 * @param method
 * @param url
 * @param key
 * @param keyPassphrase
 */
function generateSignature(
	authHeader: Partial<AuthHeader>,
	queryParams: { [key: string]: any },
	method: HttpMethod,
	url: string,
	key: string,
	keyPassphrase?: string,
): string {
	const baseParams = deepMerge(authHeader, queryParams, { maps: 'merge' });

	const sortedKeys = Object.keys(baseParams).sort();
	const initialAccObj = {};
	const sortedParams = sortedKeys.reduce((accObj, paramKey) => {
        accObj[paramKey] = baseParams[paramKey];
		return paramKey;
	}, initialAccObj);

	const baseParamsStr = qs.unescape(qs.stringify(sortedParams)); // url safe
	const baseString = method.toUpperCase() + "&" + url + "&" + baseParamsStr;

	const signWith = { key };
	if (keyPassphrase) {
        signWith['passphrase'] = keyPassphrase;
	}

	const signature = crypto.createSign("RSA-SHA256").update(baseString).sign(signWith, "base64");

	return signature;
}
export async function createClientAssertion({
	issuer,
	audience,
	subject,
	key,
}: CreateClientAssertion): Promise<string> {
	if (!key) 
        throw new SingpassMyInfoError("Missing key to sign client assertion.");
	if (!key.alg) 
        throw new SingpassMyInfoError("Missing key algorithm to sign client assertion.");
	
    const signingKey = await jose.JWK.asKey(key.key, key.format);
	return jwt.sign({}, signingKey.toPEM(true), {
		algorithm: key.alg,
		keyid: signingKey.kid,
		issuer,
		audience,
		subject,
		expiresIn: 120,
	});
}