import type {
	IDataObject,
	IExecuteFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { ApiError, COURIERS, COURIER_LABELS, KlikResiApi } from '../../api/klikresi';

const courierOptions: Array<{ name: string; value: string }> = Object.values(COURIERS).map((code) => ({
	name: `${COURIER_LABELS[code]} (${code})`,
	value: code,
}));

export class KlikResi implements INodeType {
	methods = {
		credentialTest: {
			async klikResi(credential: { data?: { apiKey?: string } }): Promise<INodeCredentialTestResult> {
				const apiKey = credential.data?.apiKey ?? '';
				if (apiKey.trim().length < 8) {
					return {
						status: 'Error',
						message: 'API key is missing or too short.',
					};
				}
				try {
					const account = await new KlikResiApi(apiKey).me();
					if (!account || !account.name) {
						return { status: 'OK', message: 'API key is valid.' };
					}
					const balance = new Intl.NumberFormat('id-ID', {
						style: 'currency',
						currency: 'IDR',
						maximumFractionDigits: 0,
					}).format(account.balance ?? 0);
					return {
						status: 'OK',
						message: `Connected as ${account.name} (${account.email}). Balance: ${balance}`,
					};
				} catch (error) {
					if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
						return {
							status: 'Error',
							message: 'Invalid API key.',
						};
					}
					if (error instanceof ApiError) {
						return {
							status: 'Error',
							message: `Klik Resi API error (HTTP ${error.status}): ${error.message}`,
						};
					}
					const detail = error instanceof Error ? error.message : String(error);
					return {
						status: 'Error',
						message: `Could not reach the Klik Resi API: ${detail}`,
					};
				}
			},
		},
	};

	description: INodeTypeDescription = {
		displayName: 'Klik Resi',
		name: 'klikResi',
		icon: { light: 'file:../../icons/klikresi.svg', dark: 'file:../../icons/klikresi.dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Track shipments, calculate shipping rates, and look up Indonesian locations via the Klik Resi API',
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		defaults: {
			name: 'Klik Resi',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'klikResiApi',
				required: true,
				testedBy: 'klikResi',
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Tracking',
						value: 'tracking',
						description: 'Track a shipment by AWB number and courier. Billed Rp 15 per request.',
					},
					{
						name: 'Rate',
						value: 'rates',
						description: 'Compare shipping rates across couriers. Billed Rp 5 per request.',
					},
					{
						name: 'Location',
						value: 'location',
						description: 'Search locations, provinces, cities, and districts. Billed Rp 1 per request.',
					},
				],
				default: 'tracking',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['tracking'],
					},
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get tracking information by AWB number and courier code',
						action: 'Get tracking information',
					},
				],
				default: 'get',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['rates'],
					},
				},
				options: [
					{
						name: 'Calculate By ID',
						value: 'byId',
						description: 'Calculate rates using district IDs',
						action: 'Calculate rates by ID',
					},
					{
						name: 'Calculate By Name',
						value: 'byName',
						description: 'Calculate rates using location names',
						action: 'Calculate rates by name',
					},
					{
						name: 'Calculate By Postal Code',
						value: 'byPostalCode',
						description: 'Calculate rates using postal codes',
						action: 'Calculate rates by postal code',
					},
				],
				default: 'byId',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['location'],
					},
				},
				options: [
					{
						name: 'Search',
						value: 'search',
						description: 'Search locations by keyword',
						action: 'Search locations',
					},
					{
						name: 'Provinces',
						value: 'provinces',
						description: 'List provinces',
						action: 'List provinces',
					},
					{
						name: 'Cities',
						value: 'cities',
						description: 'List cities within a province',
						action: 'List cities',
					},
					{
						name: 'Districts',
						value: 'districts',
						description: 'List districts within a city',
						action: 'List districts',
					},
				],
				default: 'search',
			},
			// Tracking fields
			{
				displayName: 'Tracking Number (AWB)',
				name: 'trackingNumber',
				type: 'string',
				required: true,
				default: '',
				description: 'The air waybill (resi) number to track',
				displayOptions: {
					show: {
						resource: ['tracking'],
						operation: ['get'],
					},
				},
			},
			{
				displayName: 'Courier',
				name: 'courierCode',
				type: 'options',
				noDataExpression: true,
				required: true,
				options: courierOptions,
				default: 'jne',
				description: 'The courier that ships the package',
				displayOptions: {
					show: {
						resource: ['tracking'],
						operation: ['get'],
					},
				},
			},
			{
				displayName: 'Sender Phone Number',
				name: 'number',
				type: 'string',
				default: '',
				description:
					'Sender phone number. Required by ID Express (ide). When provided, it is passed through as a query parameter for any courier.',
				displayOptions: {
					show: {
						resource: ['tracking'],
						operation: ['get'],
					},
				},
			},
			// Rates fields
			{
				displayName: 'Weight (Kg)',
				name: 'weight',
				type: 'number',
				typeOptions: {
					minValue: 0.01,
					numberPrecision: 2,
				},
				required: true,
				default: 1,
				description: 'The package weight in kilograms',
				displayOptions: {
					show: {
						resource: ['rates'],
					},
				},
			},
			{
				displayName: 'Origin District ID',
				name: 'originId',
				type: 'string',
				required: true,
				default: '',
				placeholder: '33.08.20',
				description: 'The origin district ID (province.city.district)',
				displayOptions: {
					show: {
						resource: ['rates'],
						operation: ['byId'],
					},
				},
			},
			{
				displayName: 'Destination District ID',
				name: 'destinationId',
				type: 'string',
				required: true,
				default: '',
				placeholder: '32.09.31',
				description: 'The destination district ID (province.city.district)',
				displayOptions: {
					show: {
						resource: ['rates'],
						operation: ['byId'],
					},
				},
			},
			{
				displayName: 'Couriers Filter',
				name: 'couriers',
				type: 'multiOptions',
				noDataExpression: true,
				options: courierOptions,
				default: [],
				description: 'Only return rates from these couriers. Leave empty to return all couriers.',
				displayOptions: {
					show: {
						resource: ['rates'],
						operation: ['byId'],
					},
				},
			},
			{
				displayName: 'Origin Name',
				name: 'originName',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'Secang, Kabupaten Magelang, Jawa Tengah',
				description: 'The origin location name',
				displayOptions: {
					show: {
						resource: ['rates'],
						operation: ['byName'],
					},
				},
			},
			{
				displayName: 'Destination Name',
				name: 'destinationName',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'Depok, Kabupaten Cirebon, Jawa Barat',
				description: 'The destination location name',
				displayOptions: {
					show: {
						resource: ['rates'],
						operation: ['byName'],
					},
				},
			},
			{
				displayName: 'Origin Postal Code',
				name: 'originPostalCode',
				type: 'number',
				typeOptions: {
					numberPrecision: 0,
				},
				required: true,
				default: 0,
				displayOptions: {
					show: {
						resource: ['rates'],
						operation: ['byPostalCode'],
					},
				},
			},
			{
				displayName: 'Destination Postal Code',
				name: 'destinationPostalCode',
				type: 'number',
				typeOptions: {
					numberPrecision: 0,
				},
				required: true,
				default: 0,
				displayOptions: {
					show: {
						resource: ['rates'],
						operation: ['byPostalCode'],
					},
				},
			},
			// Location fields
			{
				displayName: 'Keyword',
				name: 'keyword',
				type: 'string',
				required: true,
				default: '',
				description: 'Search locations by keyword (e.g. "depok")',
				displayOptions: {
					show: {
						resource: ['location'],
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Province ID',
				name: 'provinceId',
				type: 'string',
				required: true,
				default: '',
				placeholder: '33',
				description: 'The province ID to list cities from',
				displayOptions: {
					show: {
						resource: ['location'],
						operation: ['cities'],
					},
				},
			},
			{
				displayName: 'City ID',
				name: 'cityId',
				type: 'string',
				required: true,
				default: '',
				placeholder: '33.08',
				description: 'The city ID to list districts from',
				displayOptions: {
					show: {
						resource: ['location'],
						operation: ['districts'],
					},
				},
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: {
					show: {
						resource: ['location'],
					},
				},
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
					numberPrecision: 0,
				},
				default: 50,
				description: 'Max number of results to return',
				displayOptions: {
					show: {
						resource: ['location'],
						returnAll: [false],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('klikResiApi');
		const api = new KlikResiApi(credentials.apiKey as string);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const responseData = await runOperation.call(this, api, resource, operation, itemIndex);
				returnData.push({
					json: responseData as unknown as IDataObject,
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
						},
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				if (error instanceof ApiError) {
					throw new NodeOperationError(
						this.getNode(),
						`Klik Resi API error (HTTP ${error.status}): ${error.message}`,
						{ itemIndex },
					);
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}

async function runOperation(
	this: IExecuteFunctions,
	api: KlikResiApi,
	resource: string,
	operation: string,
	itemIndex: number,
): Promise<IDataObject | IDataObject[]> {
	if (resource === 'tracking') {
		if (operation === 'get') {
			const trackingNumber = this.getNodeParameter('trackingNumber', itemIndex) as string;
			const courierCode = this.getNodeParameter('courierCode', itemIndex) as string;
			const number = this.getNodeParameter('number', itemIndex, '') as string;
			const tracking = await api.trackingGet(trackingNumber, courierCode, { number });
			return tracking as unknown as IDataObject;
		}
	}

	if (resource === 'rates') {
		const weight = this.getNodeParameter('weight', itemIndex) as number;
		if (operation === 'byId') {
			const originId = this.getNodeParameter('originId', itemIndex) as string;
			const destinationId = this.getNodeParameter('destinationId', itemIndex) as string;
			const couriers = this.getNodeParameter('couriers', itemIndex, []) as string[];
			const result = await api.ratesById(
				originId,
				destinationId,
				weight,
				couriers as Array<(typeof COURIERS)[keyof typeof COURIERS]>,
			);
			return result as unknown as IDataObject;
		}
		if (operation === 'byName') {
			const originName = this.getNodeParameter('originName', itemIndex) as string;
			const destinationName = this.getNodeParameter('destinationName', itemIndex) as string;
			const result = await api.ratesByName(originName, destinationName, weight);
			return result as unknown as IDataObject;
		}
		if (operation === 'byPostalCode') {
			const originPostalCode = this.getNodeParameter('originPostalCode', itemIndex) as number;
			const destinationPostalCode = this.getNodeParameter('destinationPostalCode', itemIndex) as number;
			const result = await api.ratesByPostalCode(originPostalCode, destinationPostalCode, weight);
			return result as unknown as IDataObject;
		}
	}

	if (resource === 'location') {
		const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
		const limit = returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number);

		if (operation === 'search') {
			const keyword = this.getNodeParameter('keyword', itemIndex) as string;
			return returnAll
				? ((await api.allLocations(keyword, limit)) as unknown as IDataObject[])
				: ((await api.locationSearch(keyword, limit)) as unknown as IDataObject);
		}
		if (operation === 'provinces') {
			return returnAll
				? ((await api.allProvinces(limit)) as unknown as IDataObject[])
				: ((await api.provinces(limit)) as unknown as IDataObject);
		}
		if (operation === 'cities') {
			const provinceId = this.getNodeParameter('provinceId', itemIndex) as string;
			return returnAll
				? ((await api.allCities(provinceId, limit)) as unknown as IDataObject[])
				: ((await api.cities(provinceId, limit)) as unknown as IDataObject);
		}
		if (operation === 'districts') {
			const cityId = this.getNodeParameter('cityId', itemIndex) as string;
			return returnAll
				? ((await api.allDistricts(cityId, limit)) as unknown as IDataObject[])
				: ((await api.districts(cityId, limit)) as unknown as IDataObject);
		}
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for resource "${resource}"`,
	);
}
