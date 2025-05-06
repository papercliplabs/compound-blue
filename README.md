# Compound Blue 

An open source [Next.js](https://nextjs.org/) frontend for [Compound](https://compound.finance/)-managed lending, powered by the [Morpho protocol](https://morpho.xyz/) on [Polygon POS](https://polygon.technology/polygon-pos).

---

## Development

Install Dependencies
```bash
bun i
```

Create and populate environment variables
```bash
cp .env.example .env
# Now populate the .env file
```

Start the development server
```bash
bun dev
```

Run tests
```bash
# Run all tests
bun run test

# Vitest only
bun run test:vitest

# Playwright only
bun run test:playwright
```

Build
```bash
bun run build
```

---

## Configuration

All configuration parameters outside of environment variables are set in [`src/config.ts`](./src/config.ts). 

All read-only data is powered by [Whisk](https://www.whisk.so/), and enters the app via the [data layer](src/data/whisk). You can shim this layer out with your own data source, or [reach out](https://paperclip.xyz/contact) if you want to use Whisk.

---

## Licensing

The code is under the GNU AFFERO GENERAL PUBLIC LICENSE v3.0, see [`LICENSE`](./LICENSE).
