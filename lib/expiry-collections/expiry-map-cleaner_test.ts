import { assertEquals, assertFalse } from "@std/assert";
import { mapAgeCleaner } from "./expiry-map-cleaner.ts";
import { delay } from "@std/async/delay";


Deno.test('auto removal on initial Map', async _t => {
    const map = new Map([
        ['unicorn', {maxAge: Date.now() + 1000, data: '🦄'}]
    ]);
    mapAgeCleaner(map);

    assertEquals(true, map.has('unicorn'));

    await delay(400);
    assertEquals(true, map.has('unicorn'));

    await delay(605);

    assertEquals(false, map.has('unicorn'));
});

Deno.test('auto removal', async _t => {
	const map = new Map();
	map.set('unicorn', {maxAge: Date.now() + 1000, data: '🦄'});

	assertEquals(true, map.has('unicorn'));
	await delay(400);

	assertEquals(true, map.has('unicorn'));
	await delay(605);

	assertFalse(map.has('unicorn'));
});
