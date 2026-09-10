import { afterEach, vi } from 'vitest';

afterEach(() => {
	vi.unstubAllGlobals();
});

export function mockFetch(response: unknown, status = 200) {
	const fn = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(response), { status }));
	vi.stubGlobal('fetch', fn);
	return fn;
}
