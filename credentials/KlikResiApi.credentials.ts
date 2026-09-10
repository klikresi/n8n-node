import type { IAuthenticateGeneric, ICredentialType, INodeProperties, Icon } from 'n8n-workflow';

export class KlikResiApi implements ICredentialType {
	name = 'klikResiApi';

	displayName = 'Klik Resi API';

	icon: Icon = { light: 'file:../icons/klikresi.svg', dark: 'file:../icons/klikresi.dark.svg' };

	documentationUrl = 'https://docs.klikresi.com';

	// The credential is validated by the node via methods.credentialTest,
	// which calls the free GET /api/me endpoint to verify the API key.
	testedBy = 'klikResi';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your Klik Resi API key. Every API call is billed: Tracking Rp 15, Rates Rp 5, Location Rp 1 per request.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};
}
