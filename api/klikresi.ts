export const KLIKRESI_BASE_URL = 'https://klikresi.com';
const DEFAULT_TIMEOUT_MS = 30_000;

export const COURIERS = {
	SPX: 'spx',
	JNE: 'jne',
	JNT: 'jnt',
	SICEPAT: 'sicepat',
	NINJA: 'ninja',
	POS: 'pos',
	SAP: 'sap',
	LEX: 'lex',
	LION: 'lion',
	ID_EXPRESS: 'ide',
	ANTERAJA: 'anteraja',
	WAHANA: 'wahana',
	TIKI: 'tiki',
} as const;

export type CourierCode = (typeof COURIERS)[keyof typeof COURIERS];

export const COURIER_LABELS: Record<CourierCode, string> = {
	spx: 'Shopee Express',
	jne: 'JNE Express',
	jnt: 'J&T Express',
	sicepat: 'SiCepat Express',
	ninja: 'Ninja Express',
	pos: 'POS Indonesia',
	sap: 'SAP Express',
	lex: 'Lazada Logistics',
	lion: 'Lion Parcel',
	ide: 'ID Express',
	anteraja: 'Anteraja',
	wahana: 'Wahana Prestasi Logistik',
	tiki: 'TIKI',
};

export type TrackingStatus =
	| 'InfoReceived'
	| 'InTransit'
	| 'OutForDelivery'
	| 'FailedAttempt'
	| 'Delivered'
	| 'ReturnToSender'
	| 'Exception'
	| 'Expired'
	| 'Pending';

export interface Address {
	contact_name: string;
	address: string;
}

export interface HistoryEntry {
	status: TrackingStatus;
	message: string;
	date: string;
}

export interface TrackingInfo {
	status: TrackingStatus;
	origin: Address;
	destination: Address;
	histories: HistoryEntry[];
}

export interface Pricing {
	type: string;
	courier_code: string;
	courier_name: string;
	service: string;
	price: number;
	duration: string;
}

export interface RateResult {
	origin: { id: string; name: string };
	destination: { id: string; name: string };
	pricing: Pricing[];
}

export interface LocationInfo {
	id: string;
	name: string;
	district: string;
	city: string;
	province: string;
}

export interface NamedLocation {
	id: string;
	name: string;
}

export interface LocationPage {
	data: LocationInfo[];
	next_cursor: string;
}

export interface NamedLocationPage {
	data: NamedLocation[];
	next_cursor: string;
}

export class ApiError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message || `Klik Resi request failed with HTTP status ${status}`);
		this.name = 'ApiError';
		this.status = status;
	}
}

/**
 * Minimal, dependency-free client for the Klik Resi API.
 */
export class KlikResiApi {
	constructor(private readonly apiKey: string) {}

	private async request<T>(
		method: string,
		path: string,
		query?: Record<string, string>,
		body?: unknown,
	): Promise<T> {
		const url = new URL(KLIKRESI_BASE_URL + path);
		if (query) {
			for (const [key, value] of Object.entries(query)) {
				if (value !== '') {
					url.searchParams.set(key, value);
				}
			}
		}

		const controller = new AbortController();
		const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
		const abort = () => controller.abort();
		timeout.addEventListener('abort', abort);
		try {
			const response = await fetch(url, {
				method,
				headers: {
					'x-api-key': this.apiKey,
					accept: 'application/json',
					...(body !== undefined ? { 'content-type': 'application/json' } : {}),
				},
				...(body !== undefined ? { body: JSON.stringify(body) } : {}),
				signal: controller.signal,
			});

			const text = await response.text();
			const data: unknown = text ? JSON.parse(text) : null;

			if (!response.ok) {
				const message =
					data !== null &&
					typeof data === 'object' &&
					'message' in data &&
					typeof data.message === 'string'
						? data.message
						: '';
				throw new ApiError(response.status, message);
			}

			return data as T;
		} finally {
			timeout.removeEventListener('abort', abort);
		}
	}

	async trackingGet(
		trackingNumber: string,
		courierCode: string,
		options: { number?: string } = {},
	): Promise<TrackingInfo> {
		const query: Record<string, string> = {};
		if (options.number) {
			query.number = options.number;
		}
		const path = `/api/trackings/${encodeURIComponent(trackingNumber)}/couriers/${encodeURIComponent(courierCode)}`;
		const envelope = await this.request<{ data: TrackingInfo }>('GET', path, query);
		return envelope.data;
	}

	async ratesById(
		originId: string,
		destinationId: string,
		weight: number,
		couriers?: CourierCode[],
	): Promise<RateResult> {
		const body: Record<string, unknown> = {
			origin_id: originId,
			destination_id: destinationId,
			weight,
		};
		if (couriers && couriers.length > 0) {
			body.couriers = couriers;
		}
		return this.rates(body);
	}

	async ratesByName(origin: string, destination: string, weight: number): Promise<RateResult> {
		return this.rates({ origin, destination, weight });
	}

	async ratesByPostalCode(
		originPostalCode: number,
		destinationPostalCode: number,
		weight: number,
	): Promise<RateResult> {
		return this.rates({
			origin_postal_code: originPostalCode,
			destination_postal_code: destinationPostalCode,
			weight,
		});
	}

	private async rates(body: Record<string, unknown>): Promise<RateResult> {
		const envelope = await this.request<{ data: RateResult }>('POST', '/api/rates', undefined, body);
		return envelope.data;
	}

	async locationSearch(keyword: string, limit?: number, cursor?: string): Promise<LocationPage> {
		return this.request<LocationPage>('GET', '/api/locations', this.pageQuery({ keyword }, limit, cursor));
	}

	async provinces(limit?: number, cursor?: string): Promise<NamedLocationPage> {
		return this.request<NamedLocationPage>('GET', '/api/provinces', this.pageQuery({}, limit, cursor));
	}

	async cities(provinceId: string, limit?: number, cursor?: string): Promise<NamedLocationPage> {
		return this.request<NamedLocationPage>(
			'GET',
			'/api/cities',
			this.pageQuery({ province_id: provinceId }, limit, cursor),
		);
	}

	async districts(cityId: string, limit?: number, cursor?: string): Promise<NamedLocationPage> {
		return this.request<NamedLocationPage>(
			'GET',
			'/api/districts',
			this.pageQuery({ city_id: cityId }, limit, cursor),
		);
	}

	async allLocations(keyword: string, limit?: number): Promise<LocationInfo[]> {
		const all: LocationInfo[] = [];
		let cursor = '';
		for (;;) {
			const page = await this.locationSearch(keyword, limit, cursor);
			all.push(...page.data);
			if (!page.next_cursor || page.next_cursor === cursor) {
				return all;
			}
			cursor = page.next_cursor;
		}
	}

	async allProvinces(limit?: number): Promise<NamedLocation[]> {
		return this.allNamed((l, c) => this.provinces(l, c), limit);
	}

	async allCities(provinceId: string, limit?: number): Promise<NamedLocation[]> {
		return this.allNamed((l, c) => this.cities(provinceId, l, c), limit);
	}

	async allDistricts(cityId: string, limit?: number): Promise<NamedLocation[]> {
		return this.allNamed((l, c) => this.districts(cityId, l, c), limit);
	}

	private async allNamed(
		fetchPage: (limit?: number, cursor?: string) => Promise<NamedLocationPage>,
		limit?: number,
	): Promise<NamedLocation[]> {
		const all: NamedLocation[] = [];
		let cursor = '';
		for (;;) {
			const page = await fetchPage(limit, cursor);
			all.push(...page.data);
			if (!page.next_cursor || page.next_cursor === cursor) {
				return all;
			}
			cursor = page.next_cursor;
		}
	}

	private pageQuery(
		extra: Record<string, string>,
		limit?: number,
		cursor?: string,
	): Record<string, string> {
		const query: Record<string, string> = { ...extra };
		if (limit !== undefined && limit > 0) {
			query.limit = String(limit);
		}
		if (cursor) {
			query.cursor = cursor;
		}
		return query;
	}
}
