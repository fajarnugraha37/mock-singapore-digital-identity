import {} from '@std/async'
import { clearTimeout, setTimeout } from 'node:timers'
import { pDefer } from "@lib/promise-util/index.ts";


export function mapAgeCleaner<K = unknown, V = Entry>(map: Map<K, V>, property = 'maxAge') {
	let processingKey: K | undefined;
	let processingTimer: ReturnType<typeof setTimeout> | undefined;
	let processingDeferred: DeferredPromise<void> | undefined;

    
	const cleanup = async () => {
		if (processingKey !== undefined) {
			// If we are already processing an item, we can safely exit
			return;
		}

		const setupTimer = (item: [K, V]) => {
			processingDeferred = pDefer();
			const delay = (item[1] as unknown)[property] - Date.now();

			if (delay <= 0) {
				// Remove the item immediately if the delay is equal to or below 0
				map.delete(item[0]);
				processingDeferred.resolve();
				return;
			}

			// Keep track of the current processed key
			processingKey = item[0];

			processingTimer = setTimeout(() => {
				// Remove the item when the timeout fires
				map.delete(item[0]);

				if (processingDeferred) {
					processingDeferred.resolve();
				}
			}, delay);

			// tslint:disable-next-line:strict-type-predicates
			if (typeof processingTimer.unref === 'function') {
				// Don't hold up the process from exiting
				processingTimer.unref();
			}

			return processingDeferred.promise;
		};

		try {
			for (const entry of map) {
				await setupTimer(entry);
			}
		} catch {
			// Do nothing if an error occurs, this means the timer was cleaned up and we should stop processing
		}
		processingKey = undefined;
	};

	const reset = () => {
		processingKey = undefined;

        if (processingTimer !== undefined) {
			clearTimeout(processingTimer);
			processingTimer = undefined;
		}

		if (processingDeferred !== undefined) {
			processingDeferred.reject(undefined);
			processingDeferred = undefined;
		}
	};

	const originalSet = map.set.bind(map);

	map.set = (key: K, value: V) => {
		if (map.has(key)) {
			// If the key already exist, remove it so we can add it back at the end of the map.
			map.delete(key);
		}

		// Call the original `map.set`
		const result = originalSet(key, value);

		// If we are already processing a key and the key added is the current processed key, stop processing it
		if (processingKey && processingKey === key) {
			reset();
		}

		// Always run the cleanup method in case it wasn't started yet
		cleanup();

		return result;
	};
	cleanup();

	return map;
}