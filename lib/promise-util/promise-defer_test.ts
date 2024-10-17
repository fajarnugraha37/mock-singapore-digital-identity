import { assertEquals } from "@std/assert";
import { pDefer } from "../promise-util/promise-defer.ts";

Deno.test(async function pDeferTest() {
	const fixture = Symbol('fixture');
	function delay(milliseconds: number) {
		const deferred = pDefer();
		setTimeout(deferred.resolve, milliseconds, fixture);
		return deferred.promise;
	}
	
	assertEquals(await delay(50), fixture);
});
