export { };


declare global {
    interface DeferredPromise<T> {
        /**
            The deferred promise.
        */
        promise: Promise<T>;
    
        /**
            Resolves the promise with a value or the result of another promise.
            @param value - The value to resolve the promise with.
        */
        resolve(this: void, value?: T | PromiseLike<T>): void;
    
        /**
            Reject the promise with a provided reason or error.
            @param reason - The reason or error to reject the promise with.
        */
        reject(this: void, reason?: unknown): void;
    }
}