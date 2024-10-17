import * as jwt from "jsonwebtoken";

export { }

declare global {
    interface Key {
        key: string;
        format?: "json" | "pkcs8" | "spki" | "pkix" | "x509" | "pem";
        alg?: jwt.Algorithm;
    }


    enum HttpMethod {
        GET = "GET",
        POST = "POST",
    }

    interface AuthHeader {
        app_id: string;
        nonce: number;
        signature_method: string;
        timestamp: number;
        signature: string;
    }

    interface CreateClientAssertion {
        issuer: string;
        audience: string;
        subject: string;
        key: Key;
    }
}