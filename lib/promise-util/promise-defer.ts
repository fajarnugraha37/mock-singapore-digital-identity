export function pDefer<T>(): DeferredPromise<T> {
	const deferred = {} as DeferredPromise<T>;

	deferred.promise = new Promise((resolve, reject) => {
		deferred.resolve = resolve;
		deferred.reject = reject;
	});

	return deferred;
}