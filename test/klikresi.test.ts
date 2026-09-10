import { describe, expect, it } from 'vitest';
import { ApiError, COURIERS, KlikResiApi } from '../api/klikresi';
import trackingSuccess from './fixtures/tracking_success.json';
import trackingFailed from './fixtures/tracking_failed.json';
import ratesByID from './fixtures/rates_by_id.json';
import ratesByName from './fixtures/rates_by_name.json';
import ratesCustom from './fixtures/rates_custom.json';
import locations from './fixtures/locations.json';
import locationsPage1 from './fixtures/locations_page1.json';
import locationsPage2 from './fixtures/locations_page2.json';
import provinces from './fixtures/provinces.json';
import cities from './fixtures/cities.json';
import districts from './fixtures/districts.json';
import { mockFetch } from './helpers';

function lastRequest(fetchMock: ReturnType<typeof mockFetch>): { url: URL; init: RequestInit } {
	const [url, init] = fetchMock.mock.calls.at(-1) as [URL, RequestInit];
	return { url, init };
}

describe('trackingGet', () => {
	it('calls the tracking endpoint with the API key header', async () => {
		const fetchMock = mockFetch(trackingSuccess);

		const api = new KlikResiApi('test-key');
		const tracking = await api.trackingGet('1234567890', COURIERS.JNE);

		const { url, init } = lastRequest(fetchMock);
		expect(url.pathname).toBe('/api/trackings/1234567890/couriers/jne');
		expect((init.headers as Record<string, string>)['x-api-key']).toBe('test-key');

		expect(tracking.status).toBe('Delivered');
		expect(tracking.origin.contact_name).toBe('DAMAS AMIRUL KARIM');
		expect(tracking.histories).toHaveLength(11);
		expect(tracking.histories[0]?.date).toBe('2025-04-23T12:24:00+07:00');
	});

	it('passes the number option through as a query parameter', async () => {
		const fetchMock = mockFetch(trackingSuccess);

		const api = new KlikResiApi('test-key');
		await api.trackingGet('1234567890', COURIERS.ID_EXPRESS, { number: '08123456789' });

		const { url } = lastRequest(fetchMock);
		expect(url.searchParams.get('number')).toBe('08123456789');
	});

	it('throws an ApiError with the API message on failure', async () => {
		mockFetch(trackingFailed, 400);

		const api = new KlikResiApi('test-key');
		await expect(api.trackingGet('1234567890', COURIERS.SPX)).rejects.toMatchObject({
			name: 'ApiError',
			status: 400,
			message: "Failed to get tracking information. It's either invalid or expired. Please check again",
		});
		await expect(api.trackingGet('1234567890', COURIERS.SPX)).rejects.toBeInstanceOf(ApiError);
	});
});

describe('rates', () => {
	it('calculates by ID with a couriers filter', async () => {
		const fetchMock = mockFetch(ratesByID);

		const api = new KlikResiApi('test-key');
		const result = await api.ratesById('33.08.20', '32.09.31', 1, [COURIERS.JNE]);

		const { url, init } = lastRequest(fetchMock);
		expect(url.pathname).toBe('/api/rates');
		expect(init.method).toBe('POST');

		const body = JSON.parse(init.body as string) as Record<string, unknown>;
		expect(body.origin_id).toBe('33.08.20');
		expect(body.destination_id).toBe('32.09.31');
		expect(body.weight).toBe(1);
		expect(body.couriers).toEqual(['jne']);

		expect(result.pricing).toHaveLength(7);
		expect(result.pricing[4]).toMatchObject({ courier_code: 'jne', price: 21000 });
	});

	it('calculates by name', async () => {
		const fetchMock = mockFetch(ratesByName);

		const api = new KlikResiApi('test-key');
		const result = await api.ratesByName(
			'Secang, Kabupaten Magelang, Jawa Tengah',
			'Depok, Kabupaten Cirebon, Jawa Barat',
			1,
		);

		const body = JSON.parse(lastRequest(fetchMock).init.body as string) as Record<string, unknown>;
		expect(body.origin).toBe('Secang, Kabupaten Magelang, Jawa Tengah');
		expect(body.destination).toBe('Depok, Kabupaten Cirebon, Jawa Barat');
		expect(result.pricing).toHaveLength(10);
	});

	it('calculates by postal code', async () => {
		const fetchMock = mockFetch(ratesCustom);

		const api = new KlikResiApi('test-key');
		const result = await api.ratesByPostalCode(56195, 45155, 1);

		const body = JSON.parse(lastRequest(fetchMock).init.body as string) as Record<string, unknown>;
		expect(body.origin_postal_code).toBe(56195);
		expect(body.destination_postal_code).toBe(45155);
		expect(result.pricing).toHaveLength(2);
	});
});

describe('location', () => {
	it('searches locations with limit', async () => {
		const fetchMock = mockFetch(locations);

		const api = new KlikResiApi('test-key');
		const page = await api.locationSearch('depok', 10);

		const { url } = lastRequest(fetchMock);
		expect(url.pathname).toBe('/api/locations');
		expect(url.searchParams.get('keyword')).toBe('depok');
		expect(url.searchParams.get('limit')).toBe('10');

		expect(page.data).toHaveLength(10);
		expect(page.data[0]?.id).toBe('32.09.31');
		expect(page.next_cursor).toBe('32.76.09');
	});

	it('lists provinces', async () => {
		mockFetch(provinces);

		const api = new KlikResiApi('test-key');
		const page = await api.provinces();

		expect(page.data).toHaveLength(10);
		expect(page.data[0]).toEqual({ id: '11', name: 'Aceh' });
	});

	it('lists cities by province', async () => {
		const fetchMock = mockFetch(cities);

		const api = new KlikResiApi('test-key');
		const page = await api.cities('33');

		expect(lastRequest(fetchMock).url.searchParams.get('province_id')).toBe('33');
		expect(page.data[7]?.name).toBe('Kabupaten Magelang');
	});

	it('lists districts by city', async () => {
		const fetchMock = mockFetch(districts);

		const api = new KlikResiApi('test-key');
		const page = await api.districts('33.08');

		expect(lastRequest(fetchMock).url.searchParams.get('city_id')).toBe('33.08');
		expect(page.data[9]?.name).toBe('Mertoyudan');
	});

	it('follows cursors automatically with allLocations', async () => {
		const fetchMock = mockFetch(locationsPage2);
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(locationsPage1), { status: 200 }));

		const api = new KlikResiApi('test-key');
		const all = await api.allLocations('depok');

		expect(fetchMock).toHaveBeenCalledTimes(2);
		const secondUrl = fetchMock.mock.calls[1]?.[0] as URL;
		expect(secondUrl.searchParams.get('cursor')).toBe('32.76.01');
		expect(all).toHaveLength(3);
		expect(all[2]?.id).toBe('32.76.09');
	});
});
