# n8n-nodes-klikresi

This is an n8n community node that lets you use the [Klik Resi](https://klikresi.com)
shipping API in your n8n workflows.

Track shipments, compare shipping rates, and look up Indonesian locations
(provinces, cities, districts) across 13 couriers — JNE, J&T, Shopee Express,
SiCepat, TIKI, and more.

API reference: [docs.klikresi.com](https://docs.klikresi.com)

## Pricing

The Klik Resi API is billed per request:

| Operation | Price |
|---|---|
| Tracking (Get) | Rp 15 / request |
| Rates (all operations) | Rp 5 / request |
| Location (Search, Provinces, Cities, Districts) | Rp 1 / request |

`Return All` on location operations follows pagination cursors automatically —
each page counts as one billed request.

## Installation

### Community Nodes (recommended)

1. In n8n, go to **Settings** > **Community Nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-klikresi` as the npm package name.
4. Agree to the risks and select **Install**.

### Manual installation

To get the latest version, run the following on the machine where n8n runs:

```sh
cd ~/.n8n/nodes
npm install n8n-nodes-klikresi
```

Restart n8n.

## Credentials

1. Create a new **Klik Resi API** credential (type: `Klik Resi API`).
2. Paste your API key from the Klik Resi dashboard.

The "Test" button only checks the key format — there is no free validation
endpoint, and every API call is billed.

## Operations

### Tracking

- **Get** — track a shipment by AWB number and courier code.
  - `Tracking Number`: the air waybill (resi) number.
  - `Courier`: one of the 13 supported couriers.
  - `Sender Phone Number`: optional. Required by ID Express (`ide`); passed
    through as a query parameter for any courier when provided.

### Rates

- **Calculate By ID** — origin/destination district IDs
  (`province.city.district`, e.g. `33.08.20`) plus weight and an optional
  couriers filter.
- **Calculate By Name** — origin/destination location names (e.g.
  `Secang, Kabupaten Magelang, Jawa Tengah`).
- **Calculate By Postal Code** — origin/destination postal codes.

### Location

- **Search** — find locations by keyword.
- **Provinces** — list all provinces.
- **Cities** — list cities within a province ID.
- **Districts** — list districts within a city ID.

All location operations support `Limit` (default 50) and `Return All`
(auto-pagination; each page is one billed request).

## Development

```sh
npm install
npm run dev          # develop against a local n8n instance
npm run lint         # n8n community node lint (strict)
npm run typecheck
npm test             # unit tests (offline, mocked fetch)
npm run build        # build into dist/
```

## Release

```sh
# bump version in package.json, commit, then:
git tag v1.0.0 && git push origin main --tags
```

The `publish.yml` workflow publishes to npm with a provenance statement.
See the workflow file for the one-time Trusted Publisher setup.

## License

MIT
