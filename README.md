# Compound Blue 

An open source [Next.js](https://nextjs.org/) frontend for [Compound](https://compound.finance/)-managed lending, powered by the [Morpho protocol](https://morpho.xyz/) on [Polygon POS](https://polygon.technology/polygon-pos).

## Development

Install Dependencies
```bash
pnpm i
```

Create and populate environment variables
```bash
cp .env.example .env
# Now populate the .env file 
```

Start the development server
```bash
pnpm dev
```

Run tests
```bash
# Run all tests
pnpm test

# Vitest only
pnpm test:vitest

# Playwright only
pnpm test:playwright
```

Build
```bash
pnpm build
```

## Configuration

All configuration parameters outside of environment variables are set in [`src/config.ts`](./src/config.ts). 

All read-only data is powered by [Whisk](https://www.whisk.so/), and enters the app via the [data layer](src/data/whisk). You can shim this layer out with your own data source, or [reach out](https://paperclip.xyz/contact) if you want to use Whisk.

## Audits 

Frontend audits are stored in the [audits](/audits/) folder.

## Licensing

The code is under the GNU AFFERO GENERAL PUBLIC LICENSE v3.0, see [`LICENSE`](./LICENSE).
