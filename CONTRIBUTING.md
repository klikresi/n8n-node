# Contributing

Thanks for helping improve the Klik Resi n8n community node!

## Setup

```sh
git clone git@github.com:klikresi/n8n-node-klikresi.git
cd n8n-node-klikresi
npm install
```

## Checks

Run the following before opening a pull request:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Tests

Tests run entirely offline against recorded API responses stored in
`test/fixtures/` with `fetch` mocked via Vitest. No API key is required.

## Conventions

- This package is built to n8n community node standards (strict mode) and
  is eligible for n8n Creator Portal verification:
  - zero runtime dependencies (`n8n-workflow` is a peer dependency)
  - `n8n-community-node-package` keyword
  - nodes/credentials listed in the `n8n` section of `package.json`
  - published via GitHub Actions with npm provenance
- The HTTP client lives in `api/klikresi.ts`; node and credential logic live
  in `nodes/` and `credentials/` respectively.
