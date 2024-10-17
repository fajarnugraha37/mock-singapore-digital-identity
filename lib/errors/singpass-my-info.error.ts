export class SingpassMyInfoError extends Deno.errors.Http {
    constructor(message: string, wrappedError?: Error) {
        super(`[singpass-myinfo-oidc-helper] ${message}`);
        Error.captureStackTrace(this, SingpassMyInfoError);
        Object.setPrototypeOf(this, SingpassMyInfoError.prototype);
        if (wrappedError) {
            this.stack = this.stack + "\n" + wrappedError.stack;
        }
        return this;
    }
}