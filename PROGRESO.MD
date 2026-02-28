# PROGRESO - Chicken Protocol
Actualizado: 2026-02-28

## Arquitectura general
- Monorepo NPM workspaces con 3 paquetes: `contracts`, `packages/shared`, `apps/web`.
- Juego 100% on-chain en `ChickenProtocolGame` (sin backend). El frontend solo lee estado y envia transacciones.
- `contracts` contiene Solidity + Hardhat + scripts de deploy/seed + tests unitarios basicos.
- `packages/shared` centraliza ABIs generadas, direcciones por red, snapshot tipado de direcciones y constantes economicas/temporales.
- `apps/web` (Vite + React + Tailwind + wagmi + viem) consume direcciones/ABIs y ejecuta UX de juego.
- Automatizacion de deploy:
- Despliega contratos en orden.
- Conecta `setGame(...)` en cada NFT.
- Opcionalmente arranca temporada 1 en deploy.
- Escribe direcciones en `packages/shared/addresses/amoy.json`.
- Exporta ABIs a `packages/shared/abis`.
- Actualiza `apps/web/.env` con `VITE_*` de contratos/red.

## Contratos desplegados y sus funciones
Red activa: Polygon Amoy (`chainId 80002`)

Direcciones actuales:
- `FarmNFT`: `0xeFFb1F2ED25c1A62A21C92A04937ECC95A7c5edc`
- `GenesisChickenNFT`: `0x1435cFb7811CF3f4fb4d967c677A40479237DF5E`
- `OffspringChickenNFT`: `0x7753978F30266D491dF3C680287869461055EDfC`
- `IncubatorNFT`: `0xa206CB5bbA79A08796df566B4Cb2A0E0BC1FAC74`
- `ChickenProtocolGame`: `0xDb2AeCCE7716Fc04014D5F6CF3a8B4291be0b10B`

### ChickenProtocolGame (core)
Funciones publicas/externas principales:
- Setup/admin: `startFirstSeason`, `finalizeSeason`, `depositPool`, `withdrawPool`, `depositTreasury`, `withdrawTreasury`.
- Minting y upgrades: `mintFarm`, `mintGenesis`, `mintIncubator`, `expandFarm`, `buyEnergyPack`.
- Gestion de slots: `placeGenesis`, `placeOffspring`, `placeIncubator`, `removeFromSlot`.
- Bucle de juego: `collectEggs`, `startIncubation`, `startCooking`, `settleIncubator`, `settleIncubators`, `breed`.
- Rewards: `claimReward`.
- Getters criticos: `getGenesisMintPrice`, `getExpansionPrice`, `farmCapacity`, `getFarmSlots`, `getFarmOverview`, `availableEnergy`, `walletPoints`, `walletCookedCount`, `walletRank`, `getSeasonParticipants`, `getTurnInfo`, `getSeasonInfo`, `currentSeasonId`, `seasonStartTimestamp`, `seasonEndTimestamp`, `estimateCurrentRewardForRank`, `rewardWeightForRank`.

Eventos relevantes emitidos:
- `FarmMinted`, `GenesisMinted`, `IncubatorMinted`, `SlotsExpanded`.
- `AssetPlaced`, `AssetRemoved`.
- `EggsCollected`.
- `IncubationStarted/Completed/Cancelled`.
- `CookingStarted/Completed/Cancelled`.
- `Bred`, `PointsAdded`.
- `SeasonFinalized`, `RewardClaimed`.
- `PoolDeposited/Withdrawn`, `TreasuryDeposited/Withdrawn`.
- `EnergyPackBought`.

### FarmNFT
- `setGame`, `mintFarm`, `addExpansion`, `expansions`.

### GenesisChickenNFT
- `setGame`, `mintGenesis`, `useForBreeding`.
- Estado on-chain por token: `offspringCount`, `breedingCooldownUntil`.

### OffspringChickenNFT (soulbound)
- `setGame`, `mintOffspring`.
- Estado on-chain por token: `rarityOf`, `birthSeason`.
- Transferencias bloqueadas:
- `approve` revert.
- `setApprovalForAll` revert.
- Transfer entre wallets revert (solo mint/burn permitido por hook).

### IncubatorNFT
- `setGame`, `mintIncubator`.

## Permisos del owner
`ChickenProtocolGame` (`onlyOwner`):
- `startFirstSeason(uint64)` (solo una vez).
- `finalizeSeason(uint256,address[])`.
- `depositPool() payable`.
- `withdrawPool(uint256)`.
- `depositTreasury() payable`.
- `withdrawTreasury(uint256)`.

NFT contracts (`onlyOwner` de cada NFT):
- `setGame(address)` en Farm/Genesis/Offspring/Incubator.

Frontend:
- Owner Panel se muestra solo si `connectedWallet.toLowerCase() == game.owner().toLowerCase()`.
- No-owner no ve panel.

## Logica economica
Valores base:
- Farm mint: `10 POL`.
- Incubator mint: `5 POL`.
- Energy pack: `1 POL`.
- Genesis mint curve: `price = 5 + 0.02 * supply` (POL).
- Expansion: `5 * 1.5^n` con fixed-point WAD y redondeo hacia arriba (`powWadUp`, `mulWadUp`).

Split de ingresos:
- `80%` a `poolBalance`.
- `20%` a `treasuryBalance`.
- Aplica a mints, expansiones y energy packs.

Timing:
- Turno global (huevos/energia): `30 minutos`.
- Dia: `6 turnos`.
- Dia de juego: `3 horas` (6 turnos x 30m).
- Temporada: `14 dias de juego` (`42 horas` reales).
- Calculo deterministic con `block.timestamp`, basado en turnos y dia de juego.

Energia por granja:
- Por turno, no acumulable (se reinicia cada turno de 30m).
- `4 + genesisInSlots + packs*4`.
- Limite packs: `2` por dia de juego por granja.

Produccion:
- Genesis: `5 huevos/turno`.
- Offspring: `3 * rarityMultiplier * seasonalDecay`.
- Colecta manual por turno (`collectEggs`) una vez por turno, costo `1 energia`.
- Cap de huevos por granja: `600`.

Incubacion y coccion:
- `startIncubation`: `24 huevos + 1 energia`, disponible `30m` despues de iniciar, output `chickenItems +1`.
- `startCooking`: `1 chickenItem + 1 energia`, disponible `30m` despues de iniciar, suma puntos.
- Si cambia temporada o termina, procesos activos se cancelan sin refund.

Puntos y eficiencia:
- Base cooking: `50`.
- Multiplicador eficiencia on-chain:
- `+0.05` si recolecto 6/6 turnos del dia (`collectedMask == 0x3F`).
- `+0.05` si gasto energetico >=80% del total diario.
- Cap `1.5x`.

Rewards de temporada:
- Owner finaliza top100 validando orden on-chain por `(points desc, cooked desc)` y unicidad.
- Distribucion total: `90.5%` del pool al cerrar (`TOP_DISTRIBUTION_BPS=9050`), `9.5%` queda carry-over.
- Pesos por rank:
- 1: 15%, 2: 10%, 3: 7%.
- 4-10: 3% c/u.
- 11-25: 1% c/u.
- 26-50: 0.5% c/u.
- 51-100: 0.2% c/u.

## Rarezas NFT
Offspring rarity (`OffspringChickenNFT.Rarity`):
- `Common` (0): 70%.
- `Rare` (1): 25%.
- `Epic` (2): 5%.

RNG en breed:
- `keccak256(block.prevrandao, block.timestamp, msg.sender, farmId, genesisA, genesisB, seasonId, rngNonce) % 100`.

Multiplicadores (WAD):
- Common: `1.00x`.
- Rare: `1.15x`.
- Epic: `1.30x`.

Decay estacional offspring:
- Factor `1 / 2^seasonDelta` (bitshift), Genesis no decae.
- `seasonDelta >= 60` se considera output 0 por proteccion de underflow/precision.

## Flujo de juego
1. Conectar wallet (MetaMask/WalletConnect) y validar red Amoy.
2. Mintear `Farm`.
3. Mintear `Genesis` y `Incubator`.
4. Colocar assets en slots (`place*`).
5. Recolectar huevos por turno (`collectEggs`).
6. Iniciar incubacion/coccion en incubadoras y liquidar al cumplir `30m` (`settleIncubator`).
7. Criar (`breed`) con 2 Genesis en misma granja, respetando cooldown `3h` y limite de 3 offspring por Genesis.
8. Sumar puntos globales por wallet.
9. Tras fin de temporada: owner finaliza top100, luego jugadores elegibles hacen `claimReward`.

## Dependencias
Root:
- `npm` workspaces.
- `concurrently`.

Contracts:
- `hardhat`, `@nomicfoundation/hardhat-toolbox`, `ethers v6` (via toolbox), `@openzeppelin/contracts`, `ts-node`, `typescript`, `dotenv`.

Web:
- `react`, `react-dom`, `vite`, `tailwindcss`, `typescript`.
- `wagmi`, `viem`, `@tanstack/react-query`.
- Conectores: `injected(metaMask)` + `walletConnect`.

Shared:
- paquete interno con exports de ABIs, direcciones y tipos.

## Estado actual del frontend
- Pantalla principal operativa con:
- Top bar (energia, huevos, pool acumulado, wallet POL, turno countdown, temporada countdown).
- Escena de granja con fondo `baseGranja.png`, slots interactivos, drag and drop + fallback tap-to-select.
- Bloques separados de minteo, acciones e inventario.
- Ranking global (hasta top 100) con estimacion de premio y highlight de wallet conectada.
- Panel owner al final de la pagina (pool/treasury deposit/withdraw + copiar direcciones).
- i18n ES/EN con switch runtime.
- Perfil local (nombre + avatar en localStorage).
- Estado de incubadora visible con badges y countdown por slot (`INCUBANDO/FUEGO/LISTA`).

Web3/Gas:
- Lecturas on-chain con `useReadContract/useReadContracts`.
- Escrituras con simulacion + `estimateContractGas` + buffer (`+25% + 30000`).
- Floor de fees EIP-1559 para Amoy activo por defecto (desactivable con `VITE_DISABLE_FEE_FLOOR=true`).
- `VITE_SPIN_GAS_LIMIT` con default `300000`.

Despliegue/artefactos:
- Deploy Amoy y wiring automatico ya funcionando.
- ABIs/direcciones sincronizadas en `packages/shared`.
- Frontend consume direcciones desde `apps/web/.env`.

## Pendientes
- Agregar UI owner para `finalizeSeason(seasonId, top100Addresses[])` (actualmente solo contrato).
- Mejorar escalabilidad de ranking frontend para temporadas con gran cantidad de participantes (`getSeasonParticipants` + multicalls puede crecer mucho).
- Configurar `VITE_WALLETCONNECT_PROJECT_ID` real (actualmente puede quedar en `demo/REPLACE_ME` segun entorno).
- Anadir test coverage de contratos para:
- cancelacion de procesos al corte exacto de temporada.
- edge cases de empate en `finalizeSeason`.
- checks de pool carry-over y claims parciales.
- Anadir tests E2E frontend (con wallet real/simulada) para flujos criticos de tx.
- Definir estrategia de metadata NFT (tokenURI/imagenes on-chain o IPFS) si se requiere visualizacion estandar en explorers/marketplaces.
- QA adicional de UX movil en dispositivos reales (latencia, toasts, drag fallback tactil, legibilidad).
