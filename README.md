# Chicken Protocol (Web3 MVP)

Chicken Protocol is an on-chain farm strategy game MVP for **Polygon Amoy**.

- Gameplay logic is 100% on-chain (no backend service)
- Currency is native **POL** only
- NFTs are required to play (Farm, Genesis Chicken, Incubator, Offspring)
- Monorepo includes contracts, shared artifacts/constants, and React web app

## Monorepo

- `contracts/` Hardhat + Solidity + deploy scripts + tests
- `packages/shared/` generated ABIs, addresses, shared constants/types
- `apps/web/` Vite + React + Tailwind + wagmi frontend

## Core Features Implemented

- NFT contracts: `FarmNFT`, `GenesisChickenNFT`, `OffspringChickenNFT` (soulbound), `IncubatorNFT`
- Main game contract: `ChickenProtocolGame`
- Turn/day/season logic on-chain (30m turns, 6 turns per game day, 14 game-day seasons)
- Energy system + energy packs
- Egg production and capped storage (600)
- Slot placement/removal with capacity expansion formula using fixed-point math
- Breeding with cooldown, max offspring per genesis, rarity RNG
- Incubation and cooking pipelines bound to incubators
- Seasonal points/cooked tracking and tie-breaker
- Season finalization for Top 100 (owner submits list, on-chain ordering checks)
- Reward claim flow with pool distribution (90.5% distributed, 9.5% carryover)
- Pool/treasury accounting and owner deposit/withdraw actions
- Owner-only frontend panel at page bottom for pool/treasury operations

## Tech Stack

- Solidity `0.8.24`
- Hardhat + ethers v6 + OpenZeppelin
- React + TypeScript + Vite + Tailwind
- wagmi + WalletConnect + MetaMask connectors

## Install

```bash
npm install
```

## Environment

### Contracts (Amoy deploy)

Copy and edit:

```bash
cp contracts/.env.example contracts/.env
```

Set:

- `AMOY_RPC_URL`
- `PRIVATE_KEY` (deployer/owner)
- optional: `START_SEASON_ON_DEPLOY=true`

### Web

`apps/web/.env` is auto-updated by deploy script. A template exists at `apps/web/.env.example`.

Recommended gas safety settings for Amoy transactions:

- `VITE_MIN_MAX_FEE_GWEI=48.663500086`
- `VITE_MIN_PRIORITY_FEE_GWEI=48.6635`
- `VITE_SPIN_GAS_LIMIT=300000`

## Commands

### Local development

Terminal 1:

```bash
npm run dev
```

This starts:

- Hardhat local chain
- Vite web app

Terminal 2 (after chain starts):

```bash
npm run deploy:local
```

This deploys locally and updates:

- `packages/shared/addresses/chain-31337.json`
- `packages/shared/abis/*.json`
- `packages/shared/types/deployed.ts`
- `apps/web/.env`

### Amoy deployment (one command)

```bash
npm run deploy:amoy
```

This deploys to Amoy and automatically:

- deploys all contracts in order
- wires game address into NFT contracts
- optionally starts first season
- writes addresses to `packages/shared/addresses/amoy.json`
- exports ABIs to `packages/shared/abis`
- writes deployed address snapshot to `packages/shared/types/deployed.ts`
- updates frontend env variables in `apps/web/.env`

### Tests

```bash
npm run test
```

### Frontend production build

```bash
npm run build
```

## GitHub Upload (minimal)

Do not upload the full local workspace size. Most of it is generated or local-only.

Include in repo:

- `apps/`
- `contracts/`
- `packages/`
- `assets/`
- root configs (`package.json`, `package-lock.json`, `README.md`, `PROGRESO.MD`, `.gitignore`)

Do not include:

- `node_modules/`
- `**/dist/`
- `contracts/artifacts/`, `contracts/cache/`, `contracts/typechain-types/`
- local env files (`contracts/.env`, `apps/web/.env`)
- logs and IDE files

Quick start to publish:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

Recommended hosting:

- Frontend: Vercel or Netlify from GitHub (`apps/web`)
- Contracts: deploy with `npm run deploy:amoy` and keep generated addresses/ABIs versioned in `packages/shared`

## How To Play (MVP)

1. Connect wallet (MetaMask or WalletConnect) on Polygon Amoy.
2. Mint a Farm.
3. Mint Genesis Chickens and Incubators.
4. Place assets into Farm slots.
5. Collect eggs once per turn (costs energy).
6. Use incubators for incubation/cooking cycles.
7. Breed genesis pairs (cooldown + lifetime offspring limits apply).
8. Accumulate points and climb global rank.
9. After season end and owner finalization, claim rewards if eligible.

## Important Notes

- Offspring NFTs are soulbound and non-transferable.
- Missed turn collection is lost.
- In-progress incubator jobs from an ended season are cancelled (no refund).
- Rank claim data is verified against on-chain points/cooked counters during finalization.
- Owner panel is hidden for non-owner wallets.

## Output Paths Used By Automation

- Addresses: `packages/shared/addresses/*.json`
- ABIs: `packages/shared/abis/*.json`
- Frontend runtime env: `apps/web/.env`
- Shared deployed snapshot: `packages/shared/types/deployed.ts`
