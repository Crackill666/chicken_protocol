import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import type { Address } from "viem";
import { createPublicClient, decodeEventLog, http, parseEther, parseGwei } from "viem";
import {
  useAccount,
  useBalance,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { simulateContract, waitForTransactionReceipt } from "wagmi/actions";
import { polygonAmoy } from "wagmi/chains";
import logo2mn from "../../../assets/Logo2MN.png";

import FarmScene from "@/components/FarmScene";
import type { DragAsset, FarmSlot, IncubatorSlotStatus } from "@/components/FarmScene";
import OwnerPanel from "@/components/OwnerPanel";
import { useOwnedTokenIds } from "@/hooks/useOwnedTokenIds";
import { addresses, farmAbi, gameAbi, genesisAbi, incubatorAbi, isContractsConfigured, offspringAbi } from "@/lib/contracts";
import { formatCountdown, formatPOL, shortAddress } from "@/lib/format";
import { supportedChainId, wagmiConfig } from "@/lib/wagmi";

type Lang = "es" | "en";

type AssetSelection = DragAsset;

type LeaderboardEntry = {
  wallet: Address;
  points: bigint;
  cooked: bigint;
};
type IncubatorProcessTuple = readonly [bigint, bigint, bigint, bigint, boolean];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

const DEFAULT_MIN_MAX_FEE_GWEI = "48.663500086";
const DEFAULT_MIN_PRIORITY_FEE_GWEI = "25";
const MIN_MAX_FEE_GWEI = (import.meta.env.VITE_MIN_MAX_FEE_GWEI as string | undefined) ?? DEFAULT_MIN_MAX_FEE_GWEI;
const MIN_PRIORITY_FEE_GWEI = (import.meta.env.VITE_MIN_PRIORITY_FEE_GWEI as string | undefined) ?? DEFAULT_MIN_PRIORITY_FEE_GWEI;
const DEFAULT_TX_GAS_LIMIT = (import.meta.env.VITE_SPIN_GAS_LIMIT as string | undefined) ?? "300000";
const DISABLE_FEE_FLOOR = String(import.meta.env.VITE_DISABLE_FEE_FLOOR ?? "false").toLowerCase() === "true";
const AMOY_RPC_URL = import.meta.env.VITE_AMOY_RPC_URL ?? "https://rpc-amoy.polygon.technology";
const EMPTY_INCUBATOR_PROCESS: IncubatorProcessTuple = [0n, 0n, 0n, 0n, false];
const APP_VERSION = "V.0.0.3";

const gasEstimatorClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(AMOY_RPC_URL),
});
const GAME_ART = {
  farmBase: "/game-art/baseGranja.png",
  farmNft: "/game-art/granjaNFT.png",
  genesis: "/game-art/genesis.png",
  offspring: "/game-art/crias.png",
  incubator: "/game-art/incubadora.png",
  chickenItem: "/game-art/chicken_item.png",
} as const;

const TEXT = {
  en: {
    title: "Chicken Protocol",
    subtitle: "Connect your wallet to log in and play on Polygon Amoy.",
    language: "Language",
    connect: "Connect",
    connected: "Connected",
    wrongNetwork: "Wrong network. Switch to Polygon Amoy",
    correctNetwork: "Connected to Polygon Amoy",
    energyToday: "Energy Today",
    eggStorage: "Egg Storage",
    chickenItems: "Chicken Items",
    poolAccum: "Pool Accumulated",
    walletPol: "Wallet POL",
    turn: "Turn",
    season: "Season",
    nearCap: "Near cap",
    farm: "Farm",
    newFarm: "+ New Farm",
    profile: "Profile",
    avatar: "JPG Avatar",
    minting: "Minting",
    actions: "Actions",
    inventory: "Inventory (drag to slot or tap then tap slot)",
    dragHint: "Drag to slot",
    mintFarm: "Mint Farm",
    mintGenesis: "Mint Genesis",
    mintIncubator: "Mint Incubator",
    expandFarm: "Expand Farm",
    collectEggs: "Collect Eggs",
    collectedWait: "Collected. Next in",
    buyEnergy: "Buy Energy (+4)",
    startIncubation: "Start Incubation",
    startCooking: "Start Cooking",
    settleIncubator: "Settle Incubator",
    breed: "Breed",
    selectIncubator: "Select incubator",
    genesisA: "Genesis A",
    genesisB: "Genesis B",
    rankingTitle: "Global Ranking & Estimated Rewards",
    rank: "Rank",
    wallet: "Wallet",
    points: "Points",
    cooked: "Cooked",
    estPrize: "Estimated POL",
    noEntries: "No entries yet",
    selectedAsset: "Selected",
    seasonEnded: "Season ended for current period. Waiting finalization for rewards.",
    claimRewards: "Claim Rewards",
    ownerPanel: "Owner Panel",
    connectedOwner: "Connected owner",
    pool: "Pool",
    treasury: "Treasury",
    poolControls: "Pool Controls",
    treasuryControls: "Treasury Controls",
    deposit: "Deposit",
    withdraw: "Withdraw",
    copy: "Copy",
    amount: "POL amount",
    lock: "LOCKED",
    slot: "Slot",
    dropHere: "Drop here",
    fire: "FIRE",
    chooseAsset: "Select an asset from inventory first.",
    collectFromSlot: "Collect",
    removeFromSlot: "Remove",
    finalizeFromSlot: "Finish",
    congratsIncubation: "Congratulations! Incubation completed (+1 Chicken Item).",
    congratsCooking: "Congratulations! Cooking completed and points were added.",
    incubatorIdle: "Incubator idle",
    incubatorBusy: "Busy for 30m",
    incubatorReady: "Ready to settle",
    incubatorIncubating: "Incubating",
    incubatorCooking: "Cooking",
    releaseIn: "Ready in",
    incubatingBadge: "INCUBATING",
    readyBadge: "READY",
  },
  es: {
    title: "Chicken Protocol",
    subtitle: "Conecta tu wallet para ingresar y jugar en Polygon Amoy.",
    language: "Idioma",
    connect: "Conectar",
    connected: "Conectado",
    wrongNetwork: "Red incorrecta. Cambia a Polygon Amoy",
    correctNetwork: "Conectado a Polygon Amoy",
    energyToday: "Energia Hoy",
    eggStorage: "Huevos",
    chickenItems: "Chicken Items",
    poolAccum: "Pool Acumulado",
    walletPol: "Wallet POL",
    turn: "Turno",
    season: "Temporada",
    nearCap: "Cerca del limite",
    farm: "Granja",
    newFarm: "+ Nueva Granja",
    profile: "Perfil",
    avatar: "Avatar JPG",
    minting: "Minteo",
    actions: "Acciones",
    inventory: "Inventario (arrastra al slot o toca item y luego slot)",
    dragHint: "Arrastrar al slot",
    mintFarm: "Mintear Granja",
    mintGenesis: "Mintear Genesis",
    mintIncubator: "Mintear Incubadora",
    expandFarm: "Expandir Granja",
    collectEggs: "Recolectar Huevos",
    collectedWait: "Recolectado. Proximo en",
    buyEnergy: "Comprar Energia (+4)",
    startIncubation: "Iniciar Incubacion",
    startCooking: "Iniciar Coccion",
    settleIncubator: "Liquidar Incubadora",
    breed: "Criar",
    selectIncubator: "Elegir incubadora",
    genesisA: "Genesis A",
    genesisB: "Genesis B",
    rankingTitle: "Ranking Global y Ganancias Estimadas",
    rank: "Posicion",
    wallet: "Wallet",
    points: "Puntos",
    cooked: "Cocciones",
    estPrize: "Premio Estimado POL",
    noEntries: "Sin entradas aun",
    selectedAsset: "Seleccionado",
    seasonEnded: "Temporada terminada para este periodo. Esperando finalizacion para premios.",
    claimRewards: "Reclamar Premios",
    ownerPanel: "Panel Owner",
    connectedOwner: "Owner conectado",
    pool: "Pool",
    treasury: "Tesoreria",
    poolControls: "Controles de Pool",
    treasuryControls: "Controles de Tesoreria",
    deposit: "Depositar",
    withdraw: "Retirar",
    copy: "Copiar",
    amount: "Monto POL",
    lock: "BLOQUEADO",
    slot: "Slot",
    dropHere: "Soltar aqui",
    fire: "FUEGO",
    chooseAsset: "Primero selecciona un asset del inventario.",
    collectFromSlot: "Recolectar",
    removeFromSlot: "Quitar",
    finalizeFromSlot: "Finalizar",
    congratsIncubation: "Felicitaciones! Incubacion completada (+1 Chicken Item).",
    congratsCooking: "Felicitaciones! Coccion completada y puntos sumados.",
    incubatorIdle: "Incubadora libre",
    incubatorBusy: "Ocupada por 30m",
    incubatorReady: "Lista para liquidar",
    incubatorIncubating: "Incubando",
    incubatorCooking: "Cocinando",
    releaseIn: "Lista en",
    incubatingBadge: "INCUBANDO",
    readyBadge: "LISTA",
  },
} as const;

const ACTION_HELP = {
  en: {
    mintFarm: "Mint a Farm NFT (10 POL fixed). Required to play.",
    mintGenesis: "Mint a Genesis Chicken NFT using the bonding curve price.",
    mintIncubator: "Mint an Incubator NFT (5 POL fixed).",
    expandFarm: "Expand current farm slots (+5 each expansion, geometric price).",
    collectEggs: "Collect eggs for this 30m turn. Costs 1 energy and can be done once per turn.",
    buyEnergy: "Buy one energy pack for this farm (1 POL -> +4 energy, max 2 packs per game day).",
    startIncubation: "Use selected incubator. Costs 1 energy + 24 eggs. Completes 30m after start.",
    startCooking: "Use selected incubator. Costs 1 energy + 1 chicken item. Completes 30m after start.",
    settleIncubator: "Settle one incubator to complete/cancel its in-progress process.",
    breed: "Breed two Genesis in this farm. Costs 2 energy and applies cooldown/limits.",
  },
  es: {
    mintFarm: "Mintea una Granja NFT (10 POL fijo). Es obligatoria para jugar.",
    mintGenesis: "Mintea un Genesis Chicken NFT con precio de curva de bonding.",
    mintIncubator: "Mintea una Incubadora NFT (5 POL fijo).",
    expandFarm: "Expande slots de la granja actual (+5 por expansion, precio geometrico).",
    collectEggs: "Recolecta huevos del turno actual de 30m. Cuesta 1 energia y es una vez por turno.",
    buyEnergy: "Compra un pack de energia para esta granja (1 POL -> +4 energia, max 2 packs por dia de juego).",
    startIncubation: "Usa la incubadora elegida. Cuesta 1 energia + 24 huevos. Termina 30m despues de iniciar.",
    startCooking: "Usa la incubadora elegida. Cuesta 1 energia + 1 chicken item. Termina 30m despues de iniciar.",
    settleIncubator: "Liquida una incubadora para completar/cancelar su proceso en curso.",
    breed: "Cria dos Genesis en la granja. Cuesta 2 energia y aplica cooldown/limites.",
  },
} as const;

function parsePolInput(input: string): bigint {
  const normalized = input.trim();
  if (!normalized) return 0n;
  return parseEther(normalized);
}

function parseTxError(error: unknown): string {
  const generic = "Transaction failed";
  if (!error || typeof error !== "object") return generic;

  const seen = new Set<object>();
  const queue: Array<Record<string, unknown>> = [error as Record<string, unknown>];
  const candidates: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);

    const shortMessage = current.shortMessage;
    const details = current.details;
    const reason = current.reason;
    const message = current.message;

    [shortMessage, details, reason, message].forEach((value) => {
      if (typeof value === "string" && value.trim().length > 0) {
        candidates.push(value.trim());
      }
    });

    const cause = current.cause;
    if (cause && typeof cause === "object") {
      queue.push(cause as Record<string, unknown>);
    }
  }

  const best =
    candidates.find((msg) => msg.includes("custom error")) ??
    candidates.find((msg) => msg.toLowerCase().includes("revert")) ??
    candidates.find((msg) => msg.length > 0);

  if (!best) return generic;
  return best.replace(/^execution reverted:?/i, "Execution reverted:").trim();
}

function rewardBpsForRank(rank: number): number {
  if (rank <= 0 || rank > 100) return 0;
  if (rank === 1) return 1500;
  if (rank === 2) return 1000;
  if (rank === 3) return 700;
  if (rank <= 10) return 300;
  if (rank <= 25) return 100;
  if (rank <= 50) return 50;
  return 20;
}

function labelForAsset(assetType: number, tokenId: number, lang: Lang) {
  const base = assetType === 1 ? (lang === "es" ? "Genesis" : "Genesis") : assetType === 2 ? "Offspring" : "Incubator";
  return `${base} #${tokenId}`;
}

function imageForAsset(assetType: number) {
  if (assetType === 1) return GAME_ART.genesis;
  if (assetType === 2) return GAME_ART.offspring;
  if (assetType === 3) return GAME_ART.incubator;
  return "";
}

function minGasForFunction(functionName: string, envFloor: bigint) {
  let floor = envFloor;
  if (functionName === "breed" && floor < 450000n) floor = 450000n;
  if ((functionName === "startIncubation" || functionName === "startCooking") && floor < 350000n) floor = 350000n;
  return floor;
}

function secondsUntilTimestamp(readyTimestamp: number, nowTimestamp: number): number {
  if (readyTimestamp <= nowTimestamp) return 0;
  return readyTimestamp - nowTimestamp;
}

function secondsUntilTurnReady(readyTurnKey: number, currentTurnKey: number, secondsToNextTurn: number, turnSeconds: number): number {
  const turnsRemaining = readyTurnKey - currentTurnKey;
  if (turnsRemaining <= 0) return 0;
  const safeToNextTurn = Math.max(0, secondsToNextTurn);
  return safeToNextTurn + Math.max(0, turnsRemaining - 1) * Math.max(1, turnSeconds);
}

function isTimestampReadyValue(rawReady: number): boolean {
  return rawReady >= 1_000_000_000;
}

function parseGweiOrDefault(value: string | undefined, fallback: string): bigint {
  try {
    return parseGwei((value ?? fallback).trim());
  } catch {
    return parseGwei(fallback);
  }
}

export default function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  const [lang, setLang] = useState<Lang>(() => {
    const saved = window.localStorage.getItem("cp.lang");
    return saved === "en" || saved === "es" ? saved : "es";
  });

  const [selectedFarm, setSelectedFarm] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | undefined>(undefined);
  const [selectedAsset, setSelectedAsset] = useState<AssetSelection | null>(null);
  const [selectedIncubator, setSelectedIncubator] = useState<number>(0);
  const [breedA, setBreedA] = useState<number>(0);
  const [breedB, setBreedB] = useState<number>(0);

  const [profileName, setProfileName] = useState("Farmer");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>("");

  const [toast, setToast] = useState<string>("");
  const [busyLabel, setBusyLabel] = useState<string>("");
  const [celebration, setCelebration] = useState<string>("");

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  const [depositPoolAmount, setDepositPoolAmount] = useState("0.1");
  const [withdrawPoolAmount, setWithdrawPoolAmount] = useState("0.1");
  const [depositTreasuryAmount, setDepositTreasuryAmount] = useState("0.1");
  const [withdrawTreasuryAmount, setWithdrawTreasuryAmount] = useState("0.1");

  const t = TEXT[lang];
  const help = ACTION_HELP[lang];

  useEffect(() => {
    window.localStorage.setItem("cp.lang", lang);
  }, [lang]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const cachedName = window.localStorage.getItem("cp.profile.name");
    const cachedAvatar = window.localStorage.getItem("cp.profile.avatar");
    if (cachedName) setProfileName(cachedName);
    if (cachedAvatar) setAvatarDataUrl(cachedAvatar);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("cp.profile.name", profileName);
  }, [profileName]);

  const { data: walletBalance, refetch: refetchWalletBalance } = useBalance({
    address,
    query: { enabled: Boolean(address) },
  });

  const { writeContractAsync } = useWriteContract();

  const { data: ownerAddressData, refetch: refetchOwner } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "owner",
    query: { enabled: isContractsConfigured },
  });

  const { data: poolBalanceData, refetch: refetchPool } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "poolBalance",
    query: { enabled: isContractsConfigured },
  });

  const { data: treasuryBalanceData, refetch: refetchTreasury } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "treasuryBalance",
    query: { enabled: isContractsConfigured },
  });

  const { tokenIds: farmIds, refresh: refreshFarmIds } = useOwnedTokenIds(address, addresses.farmNFT, farmAbi);
  const { tokenIds: genesisIds, refresh: refreshGenesisIds } = useOwnedTokenIds(address, addresses.genesisNFT, genesisAbi);
  const { tokenIds: offspringIds, refresh: refreshOffspringIds } = useOwnedTokenIds(address, addresses.offspringNFT, offspringAbi);
  const { tokenIds: incubatorIds, refresh: refreshIncubators } = useOwnedTokenIds(address, addresses.incubatorNFT, incubatorAbi);

  useEffect(() => {
    if (!farmIds.length) {
      setSelectedFarm(null);
      return;
    }

    setSelectedFarm((prev) => {
      if (prev && farmIds.includes(prev)) return prev;
      return farmIds[0];
    });
  }, [farmIds]);

  const selectedFarmBigInt = selectedFarm ? BigInt(selectedFarm) : undefined;

  const { data: farmOverviewData, refetch: refetchOverview } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "getFarmOverview",
    args: selectedFarmBigInt ? [selectedFarmBigInt] : undefined,
    query: { enabled: Boolean(selectedFarmBigInt) },
  });

  const farmExpansions = ((farmOverviewData as { expansions: bigint } | undefined)?.expansions ?? 0n);

  const { data: genesisMintPriceData, refetch: refetchGenesisPrice } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "getGenesisMintPrice",
    query: { enabled: isContractsConfigured },
  });

  const { data: expansionPriceData, refetch: refetchExpansionPrice } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "getExpansionPrice",
    args: [farmExpansions],
    query: { enabled: Boolean(selectedFarmBigInt) },
  });

  const { data: farmSlotsData, refetch: refetchSlots } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "getFarmSlots",
    args: selectedFarmBigInt ? [selectedFarmBigInt] : undefined,
    query: { enabled: Boolean(selectedFarmBigInt) },
  });

  const { data: turnInfoData, refetch: refetchTurnInfo } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "getTurnInfo",
    query: { enabled: isContractsConfigured },
  });

  const { data: turnDurationData } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "TURN_DURATION",
    query: { enabled: isContractsConfigured },
  });

  const { data: seasonInfoData, refetch: refetchSeasonInfo } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "getSeasonInfo",
    query: { enabled: isContractsConfigured },
  });

  const turnInfo = (turnInfoData as readonly [bigint, bigint, bigint, bigint] | undefined) ?? [0n, 1n, 0n, 0n];
  const seasonInfo = (seasonInfoData as readonly [bigint, bigint, bigint, bigint] | undefined) ?? [0n, 0n, 0n, 0n];
  const turnDurationSeconds = Number((turnDurationData as bigint | undefined) ?? 30n * 60n);

  const turnKey = Number(turnInfo[2] ?? 0n);

  const { data: eggsCollectedData, refetch: refetchCollectedFlag } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "eggsCollectedForTurn",
    args: selectedFarmBigInt ? [selectedFarmBigInt, BigInt(turnKey)] : undefined,
    query: { enabled: Boolean(selectedFarmBigInt) },
  });

  const currentSeason = Number((seasonInfo[0] as bigint | undefined) ?? 0n);
  const currentSeasonBigInt = BigInt(currentSeason || 0);

  const { data: myPointsData, refetch: refetchMyPoints } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "walletPoints",
    args: address ? [currentSeasonBigInt, address] : undefined,
    query: { enabled: Boolean(address && currentSeason > 0) },
  });

  const { data: myCookedData, refetch: refetchMyCooked } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "walletCookedCount",
    args: address ? [currentSeasonBigInt, address] : undefined,
    query: { enabled: Boolean(address && currentSeason > 0) },
  });

  const { data: participantsData, refetch: refetchParticipants } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "getSeasonParticipants",
    args: [currentSeasonBigInt],
    query: { enabled: currentSeason > 0 },
  });

  const participants = (participantsData as Address[] | undefined) ?? [];

  const participantCalls = useMemo(
    () =>
      participants.flatMap((wallet) => [
        { address: addresses.game, abi: gameAbi, functionName: "walletPoints", args: [currentSeasonBigInt, wallet] },
        { address: addresses.game, abi: gameAbi, functionName: "walletCookedCount", args: [currentSeasonBigInt, wallet] },
      ]),
    [participants, currentSeasonBigInt],
  );

  const { data: participantStatsData, refetch: refetchParticipantStats } = useReadContracts({
    contracts: participantCalls,
    query: { enabled: participantCalls.length > 0 },
  });

  const { data: farmCards, refetch: refetchFarmCards } = useReadContracts({
    contracts: farmIds.map((farmId) => ({
      address: addresses.game,
      abi: gameAbi,
      functionName: "getFarmOverview",
      args: [BigInt(farmId)],
    })),
    query: { enabled: farmIds.length > 0 },
  });

  const { data: allFarmSlotsData, refetch: refetchAllFarmSlots } = useReadContracts({
    contracts: farmIds.map((farmId) => ({
      address: addresses.game,
      abi: gameAbi,
      functionName: "getFarmSlots",
      args: [BigInt(farmId)],
    })),
    query: { enabled: farmIds.length > 0 },
  });

  const previousSeason = currentSeason > 0 ? currentSeason - 1 : 0;

  const { data: previousFinalizedData, refetch: refetchPrevFinalized } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "seasonFinalized",
    args: [BigInt(previousSeason)],
    query: { enabled: previousSeason > 0 },
  });

  const { data: previousRewardWeightData, refetch: refetchPrevReward } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "seasonRewardWeight",
    args: address ? [BigInt(previousSeason), address] : undefined,
    query: { enabled: Boolean(address && previousSeason > 0) },
  });

  const { data: previousClaimedData, refetch: refetchPrevClaimed } = useReadContract({
    address: addresses.game,
    abi: gameAbi,
    functionName: "seasonClaimed",
    args: address ? [BigInt(previousSeason), address] : undefined,
    query: { enabled: Boolean(address && previousSeason > 0) },
  });

  const ownerAddress = (ownerAddressData as Address | undefined) ?? ZERO_ADDRESS;
  const isOwner = Boolean(address && ownerAddress && address.toLowerCase() === ownerAddress.toLowerCase());

  const nextTurnTimestamp = Number(turnInfo[3]);
  const seasonEndTimestamp = Number(seasonInfo[2]);
  const turnCountdown = nextTurnTimestamp > 0 ? nextTurnTimestamp - now : 0;
  const seasonCountdown = seasonEndTimestamp > 0 ? seasonEndTimestamp - now : 0;
  const isSeasonLive = currentSeason > 0 && seasonCountdown > 0;

  const overview = (farmOverviewData as {
    eggs: bigint;
    chickenItems: bigint;
    capacity: bigint;
    expansions: bigint;
    genesisInSlots: bigint;
    offspringInSlots: bigint;
    incubatorsInSlots: bigint;
    availableEnergy: bigint;
    totalEnergy: bigint;
    energySpent: bigint;
    packsBought: bigint;
    collectedMask: bigint;
  } | undefined) ?? {
    eggs: 0n,
    chickenItems: 0n,
    capacity: 0n,
    expansions: 0n,
    genesisInSlots: 0n,
    offspringInSlots: 0n,
    incubatorsInSlots: 0n,
    availableEnergy: 0n,
    totalEnergy: 0n,
    energySpent: 0n,
    packsBought: 0n,
    collectedMask: 0n,
  };

  const slotTuple = (farmSlotsData as readonly [readonly bigint[], readonly bigint[]] | undefined) ?? [[], []];
  const capacity = Number(overview.capacity);

  const placedGenesis = useMemo(
    () =>
      slotTuple[0]
        .map((assetType, idx) => ({ assetType: Number(assetType), tokenId: Number(slotTuple[1][idx] ?? 0n) }))
        .filter((entry) => entry.assetType === 1 && entry.tokenId > 0)
        .map((entry) => entry.tokenId),
    [slotTuple],
  );

  const placedOffspring = useMemo(
    () =>
      slotTuple[0]
        .map((assetType, idx) => ({ assetType: Number(assetType), tokenId: Number(slotTuple[1][idx] ?? 0n) }))
        .filter((entry) => entry.assetType === 2 && entry.tokenId > 0)
        .map((entry) => entry.tokenId),
    [slotTuple],
  );

  const placedIncubators = useMemo(
    () =>
      slotTuple[0]
        .map((assetType, idx) => ({ assetType: Number(assetType), tokenId: Number(slotTuple[1][idx] ?? 0n) }))
        .filter((entry) => entry.assetType === 3 && entry.tokenId > 0)
        .map((entry) => entry.tokenId),
    [slotTuple],
  );

  const { data: incubatorProcessesData, refetch: refetchIncubatorProcesses } = useReadContracts({
    contracts: placedIncubators.map((incubatorId) => ({
      address: addresses.game,
      abi: gameAbi,
      functionName: "incubatorProcesses",
      args: [BigInt(incubatorId)],
    })),
    query: { enabled: placedIncubators.length > 0 },
  });

  const incubatorProcessMap = useMemo(() => {
    const map = new Map<number, IncubatorProcessTuple>();
    placedIncubators.forEach((incubatorId, index) => {
      const tuple = (incubatorProcessesData?.[index]?.result as IncubatorProcessTuple | undefined) ?? EMPTY_INCUBATOR_PROCESS;
      map.set(incubatorId, tuple);
    });
    return map;
  }, [incubatorProcessesData, placedIncubators]);

  const placedGenesisSet = useMemo(() => new Set<number>(placedGenesis), [placedGenesis]);
  const placedOffspringSet = useMemo(() => new Set<number>(placedOffspring), [placedOffspring]);
  const placedIncubatorsSet = useMemo(() => new Set<number>(placedIncubators), [placedIncubators]);

  const globallyPlaced = useMemo(() => {
    const genesis = new Set<number>();
    const offspring = new Set<number>();
    const incubators = new Set<number>();

    allFarmSlotsData?.forEach((entry) => {
      const tuple = entry?.result as readonly [readonly bigint[], readonly bigint[]] | undefined;
      if (!tuple) return;
      const [assetTypes, tokenIds] = tuple;

      for (let i = 0; i < assetTypes.length; i++) {
        const assetType = Number(assetTypes[i] ?? 0n);
        const tokenId = Number(tokenIds[i] ?? 0n);
        if (tokenId <= 0) continue;

        if (assetType === 1) genesis.add(tokenId);
        else if (assetType === 2) offspring.add(tokenId);
        else if (assetType === 3) incubators.add(tokenId);
      }
    });

    return { genesis, offspring, incubators };
  }, [allFarmSlotsData]);

  useEffect(() => {
    if (selectedIncubator !== 0 && !placedIncubatorsSet.has(selectedIncubator)) {
      setSelectedIncubator(0);
    }
    if (breedA !== 0 && !placedGenesisSet.has(breedA)) {
      setBreedA(0);
    }
    if (breedB !== 0 && !placedGenesisSet.has(breedB)) {
      setBreedB(0);
    }
  }, [placedIncubatorsSet, placedGenesisSet, selectedIncubator, breedA, breedB]);

  useEffect(() => {
    if (selectedIncubator === 0 && placedIncubators.length > 0) {
      setSelectedIncubator(placedIncubators[0]);
    }
  }, [selectedIncubator, placedIncubators]);

  const inventoryGenesis = genesisIds.filter((id) => !globallyPlaced.genesis.has(id));
  const inventoryOffspring = offspringIds.filter((id) => !globallyPlaced.offspring.has(id));
  const inventoryIncubators = incubatorIds.filter((id) => !globallyPlaced.incubators.has(id));
  const chickenItemsVisualCap = 120n;
  const chickenItemsToRender = Number(overview.chickenItems > chickenItemsVisualCap ? chickenItemsVisualCap : overview.chickenItems);
  const chickenItemsRemaining = overview.chickenItems > chickenItemsVisualCap ? overview.chickenItems - chickenItemsVisualCap : 0n;

  const selectedIncubatorProcess = selectedIncubator > 0 ? incubatorProcessMap.get(selectedIncubator) ?? EMPTY_INCUBATOR_PROCESS : EMPTY_INCUBATOR_PROCESS;
  const selectedIncubatorProcessType = Number(selectedIncubatorProcess[0] ?? 0n);
  const selectedIncubatorReadyRaw = Number(selectedIncubatorProcess[2] ?? 0n);
  const selectedIncubatorReadyIsTimestamp = isTimestampReadyValue(selectedIncubatorReadyRaw);
  const selectedIncubatorProcessSeason = Number(selectedIncubatorProcess[3] ?? 0n);
  const selectedIncubatorActive = Boolean(selectedIncubatorProcess[4]);
  const selectedIncubatorReadyToSettle =
    selectedIncubator > 0 &&
    selectedIncubatorActive &&
    ((selectedIncubatorReadyIsTimestamp ? now >= selectedIncubatorReadyRaw : turnKey >= selectedIncubatorReadyRaw) ||
      currentSeason > selectedIncubatorProcessSeason ||
      !isSeasonLive);
  const selectedIncubatorSecondsToReady = selectedIncubatorReadyToSettle
    ? 0
    : selectedIncubatorReadyIsTimestamp
      ? secondsUntilTimestamp(selectedIncubatorReadyRaw, now)
      : secondsUntilTurnReady(selectedIncubatorReadyRaw, turnKey, turnCountdown, turnDurationSeconds);

  const incubatorStatusByTokenId = useMemo(() => {
    const map = new Map<number, IncubatorSlotStatus>();

    placedIncubators.forEach((incubatorId) => {
      const process = incubatorProcessMap.get(incubatorId) ?? EMPTY_INCUBATOR_PROCESS;
      const processType = Number(process[0] ?? 0n);
      const readyRaw = Number(process[2] ?? 0n);
      const readyIsTimestamp = isTimestampReadyValue(readyRaw);
      const processSeason = Number(process[3] ?? 0n);
      const active = Boolean(process[4]);

      if (!active) return;

      const readyToSettle = (readyIsTimestamp ? now >= readyRaw : turnKey >= readyRaw) || currentSeason > processSeason || !isSeasonLive;
      if (readyToSettle) {
        map.set(incubatorId, { badge: t.readyBadge, tone: "ready" });
        return;
      }

      const secondsToReady = readyIsTimestamp
        ? secondsUntilTimestamp(readyRaw, now)
        : secondsUntilTurnReady(readyRaw, turnKey, turnCountdown, turnDurationSeconds);
      const countdown = formatCountdown(secondsToReady);
      if (processType === 2) {
        map.set(incubatorId, { badge: t.fire, tone: "cooking", countdown });
        return;
      }

      map.set(incubatorId, { badge: t.incubatingBadge, tone: "incubating", countdown });
    });

    return map;
  }, [placedIncubators, incubatorProcessMap, now, turnKey, turnCountdown, turnDurationSeconds, currentSeason, isSeasonLive, t.readyBadge, t.fire, t.incubatingBadge]);

  const visualSlotCount = Math.max(12, capacity);

  const sceneSlots = useMemo<FarmSlot[]>(
    () =>
      Array.from({ length: visualSlotCount }, (_, index) => {
        const unlocked = index < capacity;
        if (unlocked) {
          return {
            index,
            unlocked,
            assetType: Number(slotTuple[0][index] ?? 0n),
            tokenId: Number(slotTuple[1][index] ?? 0n),
          };
        }
        return { index, unlocked: false, assetType: 0, tokenId: 0 };
      }),
    [visualSlotCount, capacity, slotTuple],
  );

  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    if (!participantStatsData || !participants.length) return [];

    const rows: LeaderboardEntry[] = [];
    for (let i = 0; i < participants.length; i++) {
      const pointEntry = participantStatsData[i * 2];
      const cookedEntry = participantStatsData[i * 2 + 1];

      rows.push({
        wallet: participants[i],
        points: (pointEntry?.result as bigint | undefined) ?? 0n,
        cooked: (cookedEntry?.result as bigint | undefined) ?? 0n,
      });
    }

    rows.sort((a, b) => {
      if (a.points !== b.points) return a.points > b.points ? -1 : 1;
      if (a.cooked !== b.cooked) return a.cooked > b.cooked ? -1 : 1;
      return a.wallet.localeCompare(b.wallet);
    });

    return rows;
  }, [participantStatsData, participants]);

  const myRank = useMemo(() => {
    if (!address) return 0;
    const idx = leaderboard.findIndex((entry) => entry.wallet.toLowerCase() === address.toLowerCase());
    return idx === -1 ? 0 : idx + 1;
  }, [address, leaderboard]);

  const canClaimPrevious = Boolean(previousFinalizedData && (previousRewardWeightData as bigint | undefined) && !previousClaimedData);

  const farmBadgeMap = useMemo(() => {
    const map = new Map<number, { eggs: bigint; energy: bigint }>();
    if (!farmCards) return map;

    farmCards.forEach((entry, i) => {
      const ov = entry.result as { eggs: bigint; availableEnergy: bigint } | undefined;
      map.set(farmIds[i], { eggs: ov?.eggs ?? 0n, energy: ov?.availableEnergy ?? 0n });
    });

    return map;
  }, [farmCards, farmIds]);

  const poolBalance = (poolBalanceData as bigint | undefined) ?? 0n;

  function rewardEstimateForRank(rank: number) {
    const bps = rewardBpsForRank(rank);
    if (bps === 0) return 0n;
    return (poolBalance * BigInt(bps)) / 10000n;
  }

  const wrongNetwork = isConnected && chainId !== supportedChainId;
  const collectedThisTurn = Boolean(eggsCollectedData);

  const canCollectEggs = Boolean(selectedFarm && isSeasonLive && overview.availableEnergy >= 1n && !collectedThisTurn);
  const incubatorReadyForNewProcess = selectedIncubator > 0 && (!selectedIncubatorActive || selectedIncubatorReadyToSettle);
  const hasChickenItemForCooking = Boolean(
    overview.chickenItems >= 1n || (selectedIncubatorReadyToSettle && selectedIncubatorProcessType === 1),
  );
  const canStartIncubation = Boolean(
    selectedFarm && isSeasonLive && incubatorReadyForNewProcess && overview.availableEnergy >= 1n && overview.eggs >= 24n,
  );
  const canStartCooking = Boolean(
    selectedFarm && isSeasonLive && incubatorReadyForNewProcess && overview.availableEnergy >= 1n && hasChickenItemForCooking,
  );
  const canAttemptStartCooking = Boolean(selectedFarm && isSeasonLive && selectedIncubator > 0);
  const canSettleIncubator = selectedIncubatorReadyToSettle;
  const canBreed = Boolean(
    selectedFarm &&
      isSeasonLive &&
      breedA > 0 &&
      breedB > 0 &&
      breedA !== breedB &&
      overview.availableEnergy >= 2n &&
      placedGenesisSet.has(breedA) &&
      placedGenesisSet.has(breedB),
  );

  function buildGasOverrides() {
    if (DISABLE_FEE_FLOOR || chainId !== supportedChainId) {
      return {};
    }

    const priorityFloor = parseGweiOrDefault(MIN_PRIORITY_FEE_GWEI, DEFAULT_MIN_PRIORITY_FEE_GWEI);
    const requestedMaxFee = parseGweiOrDefault(MIN_MAX_FEE_GWEI, DEFAULT_MIN_MAX_FEE_GWEI);
    const minMaxFee = requestedMaxFee > priorityFloor ? requestedMaxFee : priorityFloor + parseGwei("1");

    return {
      maxPriorityFeePerGas: priorityFloor,
      maxFeePerGas: minMaxFee,
    } as const;
  }

  async function refreshAll() {
    await Promise.allSettled([
      refetchWalletBalance(),
      refetchOwner(),
      refetchPool(),
      refetchTreasury(),
      refreshFarmIds(),
      refreshGenesisIds(),
      refreshOffspringIds(),
      refreshIncubators(),
      refetchOverview(),
      refetchGenesisPrice(),
      refetchExpansionPrice(),
      refetchSlots(),
      refetchTurnInfo(),
      refetchSeasonInfo(),
      refetchCollectedFlag(),
      refetchIncubatorProcesses(),
      refetchMyPoints(),
      refetchMyCooked(),
      refetchParticipants(),
      refetchParticipantStats(),
      refetchFarmCards(),
      refetchAllFarmSlots(),
      refetchPrevFinalized(),
      refetchPrevReward(),
      refetchPrevClaimed(),
    ]);
  }

  async function runTx(label: string, request: any) {
    try {
      setBusyLabel(label);
      setToast(`${label}: validating transaction...`);
      const baseRequest = { ...request, ...buildGasOverrides() };
      const envFloor = DEFAULT_TX_GAS_LIMIT ? BigInt(DEFAULT_TX_GAS_LIMIT) : 0n;
      const fnName = String(request?.functionName ?? "");
      const minGas = minGasForFunction(fnName, envFloor);
      const simulationRequest = minGas > 0n ? { ...baseRequest, gas: minGas } : baseRequest;

      const simulated = address
        ? await simulateContract(wagmiConfig, {
            ...(simulationRequest as any),
            account: address,
          })
        : undefined;
      let finalGas = minGas;

      if (address && simulated?.request) {
        try {
          const estimateRequest = { ...(simulated.request as any) };
          if ("gas" in estimateRequest) {
            delete estimateRequest.gas;
          }
          const estimatedGas = await gasEstimatorClient.estimateContractGas({
            ...estimateRequest,
            account: address,
          });
          const bufferedGas = estimatedGas + (estimatedGas * 25n) / 100n + 30000n;
          finalGas = bufferedGas > minGas ? bufferedGas : minGas;
        } catch {
          finalGas = minGas;
        }
      }

      const txRequest = finalGas > 0n ? { ...baseRequest, gas: finalGas } : baseRequest;

      setToast(`${label}: waiting wallet signature`);
      const hash = await writeContractAsync(txRequest);
      setToast(`${label}: pending (${shortAddress(hash)})`);
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
      await refreshAll();

      let completionBanner = "";
      if (request?.functionName === "settleIncubator") {
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: gameAbi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === "IncubationCompleted") {
              completionBanner = t.congratsIncubation;
              break;
            }
            if (decoded.eventName === "CookingCompleted") {
              completionBanner = t.congratsCooking;
              break;
            }
          } catch {
            // Ignore non-game logs.
          }
        }
      }

      if (completionBanner) {
        setCelebration(completionBanner);
        setToast(completionBanner);
        window.setTimeout(() => setCelebration(""), 4200);
      } else {
        setToast(`${label}: confirmed`);
      }
      window.setTimeout(() => setToast(""), 2500);
    } catch (error) {
      const message = parseTxError(error);
      if (message.toLowerCase().includes("exceeds the balance")) {
        setToast(
          lang === "es"
            ? `${label}: saldo insuficiente (precio + gas). Para mint Genesis hoy necesitas aprox > 5.06 POL.`
            : `${label}: insufficient balance (value + gas). For Genesis mint right now you need about > 5.06 POL.`,
        );
        return;
      }
      setToast(`${label}: ${message}`);
    } finally {
      setBusyLabel("");
    }
  }

  async function placeAssetInSlot(slotIndex: number, asset: AssetSelection) {
    if (!selectedFarm) return;

    const fn = asset.assetType === 1 ? "placeGenesis" : asset.assetType === 2 ? "placeOffspring" : "placeIncubator";

    await runTx(lang === "es" ? "Colocar asset" : "Place asset", {
      address: addresses.game,
      abi: gameAbi,
      functionName: fn,
      args: [BigInt(selectedFarm), BigInt(asset.tokenId), BigInt(slotIndex)],
    });
  }

  async function handleSlotClick(slotIndex: number) {
    setSelectedSlot(slotIndex);

    if (!selectedFarm) return;

    const slot = sceneSlots[slotIndex];
    if (!slot || !slot.unlocked) return;

    if (slot.assetType !== 0) {
      return;
    }

    if (!selectedAsset) {
      setToast(t.chooseAsset);
      return;
    }

    await placeAssetInSlot(slotIndex, selectedAsset);
  }

  async function handleSlotDrop(slotIndex: number, asset: DragAsset) {
    setSelectedAsset(asset);
    await placeAssetInSlot(slotIndex, asset);
  }

  async function handleSlotRemove(slotIndex: number) {
    if (!selectedFarm) return;
    await runTx(lang === "es" ? "Quitar asset" : "Remove asset", {
      address: addresses.game,
      abi: gameAbi,
      functionName: "removeFromSlot",
      args: [BigInt(selectedFarm), BigInt(slotIndex)],
    });
  }

  async function handleCollectFromSlot() {
    if (!selectedFarm) return;
    if (!canCollectEggs) {
      setToast(
        collectedThisTurn
          ? `${t.collectedWait} ${formatCountdown(turnCountdown)}`
          : lang === "es"
            ? "No puedes recolectar ahora."
            : "You cannot collect right now.",
      );
      return;
    }

    await runTx(t.collectEggs, {
      address: addresses.game,
      abi: gameAbi,
      functionName: "collectEggs",
      args: [BigInt(selectedFarm)],
    });
  }

  async function handleSettleFromSlot(incubatorId: number) {
    await runTx(t.settleIncubator, {
      address: addresses.game,
      abi: gameAbi,
      functionName: "settleIncubator",
      args: [BigInt(incubatorId)],
    });
  }

  function handleInventoryDragStart(event: DragEvent<HTMLButtonElement>, asset: AssetSelection) {
    setSelectedAsset(asset);
    event.dataTransfer.setData("application/x-chicken-asset", JSON.stringify(asset));
    event.dataTransfer.effectAllowed = "move";
  }

  function handleAvatarFile(file?: File) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      setAvatarDataUrl(result);
      window.localStorage.setItem("cp.profile.avatar", result);
    };

    reader.readAsDataURL(file);
  }

  useEffect(() => {
    refetchCollectedFlag();
  }, [turnKey, refetchCollectedFlag]);

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFarm]);

  const top3 = leaderboard.slice(0, 3);
  const genesisMintPrice = (genesisMintPriceData as bigint | undefined) ?? 0n;
  const expansionPrice = (expansionPriceData as bigint | undefined) ?? 0n;

  if (!isConnected) {
    return (
      <div className="min-h-screen font-body text-[#fff8ef]">
        <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4 py-10">
          <div className="pixel-shell w-full p-7 text-center">
            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="text-sm text-[#edd6b6]">{t.language}</span>
              <button
                type="button"
                onClick={() => setLang(lang === "es" ? "en" : "es")}
                className="pixel-btn pixel-btn-blue !px-3 !py-2 !text-[0.52rem]"
              >
                {lang === "es" ? "EN" : "ES"}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-center gap-3">
              <img src={logo2mn} alt="Logo 2MN" className="h-10 w-10 object-contain" loading="eager" style={{ imageRendering: "pixelated" }} />
              <h1 className="font-display text-3xl md:text-4xl">{t.title}</h1>
            </div>
            <p className="mt-2 text-xs text-[#edd6b6]">{APP_VERSION}</p>
            <p className="mx-auto mt-3 max-w-xl text-[#f1dfc7]">{t.subtitle}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  className="pixel-btn pixel-btn-gold !text-[0.55rem]"
                >
                  {t.connect} {connector.name}
                </button>
              ))}
            </div>
            <p className="mt-5 text-xs text-[#e5cfaf]">
              Gas mode: {DISABLE_FEE_FLOOR ? "manual" : `floor maxFee ${MIN_MAX_FEE_GWEI} gwei | floor priority ${MIN_PRIORITY_FEE_GWEI} gwei | `}
              limit {DEFAULT_TX_GAS_LIMIT ?? "auto"} {DISABLE_FEE_FLOOR ? "" : "| auto +25% buffer"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-body text-[#fff8ef]">
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-3 py-4 md:px-6 md:py-6">
        <header className="pixel-shell p-3 md:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-3">
                <img src={logo2mn} alt="Logo 2MN" className="h-10 w-10 object-contain md:h-12 md:w-12" loading="eager" style={{ imageRendering: "pixelated" }} />
                <h1 className="font-display text-xl md:text-2xl">{t.title}</h1>
                <span className="rounded border border-[#6d4228] bg-[#2f1d12]/80 px-2 py-1 font-display text-[0.45rem] text-[#ffe6be] md:text-[0.5rem]">
                  {APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-[#efd7b6]">{profileName}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="pixel-tag">{shortAddress(address)}</span>
              <button onClick={() => disconnect()} className="pixel-btn pixel-btn-rose !px-2 !py-2 !text-[0.5rem]">
                Disconnect
              </button>
              <span className="text-xs text-[#efd7b6]">{t.language}</span>
              <button
                type="button"
                onClick={() => setLang(lang === "es" ? "en" : "es")}
                className="pixel-btn pixel-btn-blue !px-2 !py-2 !text-[0.5rem]"
              >
                {lang === "es" ? "EN" : "ES"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-7">
            <div className="pixel-stat">
              <div className="pixel-stat-label">{t.energyToday}</div>
              <div className="pixel-stat-value font-display">{overview.availableEnergy.toString()}</div>
            </div>
            <div className="pixel-stat">
              <div className="pixel-stat-label">{t.eggStorage}</div>
              <div className="pixel-stat-value font-display">
                {overview.eggs.toString()}/600 {overview.eggs >= 550n ? <span className="text-[0.55rem] text-amber-300">{t.nearCap}</span> : null}
              </div>
            </div>
            <div className="pixel-stat">
              <div className="pixel-stat-label">{t.chickenItems}</div>
              <div className="pixel-stat-value font-display">{overview.chickenItems.toString()}</div>
            </div>
            <div className="pixel-stat">
              <div className="pixel-stat-label">{t.poolAccum}</div>
              <div className="pixel-stat-value font-display">{formatPOL(poolBalance)} POL</div>
            </div>
            <div className="pixel-stat">
              <div className="pixel-stat-label">{t.walletPol}</div>
              <div className="pixel-stat-value font-display">{walletBalance?.formatted ? Number(walletBalance.formatted).toFixed(3) : "0.000"}</div>
            </div>
            <div className="pixel-stat">
              <div className="pixel-stat-label">{t.turn}</div>
              <div className="pixel-stat-value font-display">
                {Number(turnInfo[1])}/6 | {formatCountdown(turnCountdown)}
              </div>
            </div>
            <div className="pixel-stat">
              <div className="pixel-stat-label">{t.season}</div>
              <div className="pixel-stat-value font-display">
                D{Number(seasonInfo[1])}/14 | {formatCountdown(seasonCountdown)}
              </div>
            </div>
          </div>
        </header>

        <section className="pixel-panel flex flex-col gap-2 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {farmIds.map((farmId, idx) => {
              const badge = farmBadgeMap.get(farmId);
              return (
                <button
                  key={farmId}
                  onClick={() => setSelectedFarm(farmId)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    selectedFarm === farmId
                      ? "border-[#ffe6c2] bg-[#ffdfab]/25 text-[#fff7ea]"
                      : "border-[#6c4228] bg-[#2e1a10]/55 text-[#ffe3bc]"
                  }`}
                >
                  {t.farm} {idx + 1}
                  <span className="ml-2 rounded bg-[#2f1d12]/70 px-1 text-xs">EGG {badge?.eggs.toString() ?? "0"}</span>
                  <span className="ml-1 rounded bg-[#2f1d12]/70 px-1 text-xs">ENG {badge?.energy.toString() ?? "0"}</span>
                </button>
              );
            })}

            <button
              title={help.mintFarm}
              onClick={() => runTx(t.mintFarm, { address: addresses.game, abi: gameAbi, functionName: "mintFarm", value: parseEther("10") })}
              className="pixel-btn pixel-btn-gold inline-flex items-center gap-2 !text-[0.53rem]"
            >
              <img src={GAME_ART.farmNft} alt="Farm NFT" className="h-5 w-5 rounded object-cover" loading="lazy" />
              {t.newFarm}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <img
              src={avatarDataUrl || "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Chicken"}
              alt="avatar"
              className="h-10 w-10 rounded-full border-2 border-[#ffefcc] object-cover"
            />
            <input
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              className="pixel-input max-w-[220px]"
            />
            <label className="pixel-btn pixel-btn-blue cursor-pointer !px-2 !py-2 !text-[0.5rem]">
              {t.avatar}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                className="hidden"
                onChange={(event) => handleAvatarFile(event.target.files?.[0])}
              />
            </label>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(320px,1fr)]">
          <FarmScene
            slots={sceneSlots}
            selectedSlot={selectedSlot}
            onSlotClick={handleSlotClick}
            onSlotDrop={handleSlotDrop}
            onSlotRemove={handleSlotRemove}
            onCollectFromSlot={handleCollectFromSlot}
            onSettleFromSlot={handleSettleFromSlot}
            canCollectEggs={canCollectEggs}
            assetTurnCountdown={isSeasonLive ? formatCountdown(turnCountdown) : undefined}
            assetImages={GAME_ART}
            incubatorStatusByTokenId={incubatorStatusByTokenId}
            labels={{
              slot: t.slot,
              locked: t.lock,
              dropHere: t.dropHere,
              fire: t.fire,
              collect: t.collectFromSlot,
              remove: t.removeFromSlot,
              finalize: t.finalizeFromSlot,
            }}
          />

          <div className="space-y-3">
            <div className="pixel-panel p-3">
              <h2 className="mb-2 font-display text-xl">{t.minting}</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  title={help.mintGenesis}
                  onClick={() => {
                    if (genesisMintPrice === 0n) {
                      setToast("Genesis price unavailable");
                      return;
                    }
                    runTx(t.mintGenesis, {
                      address: addresses.game,
                      abi: gameAbi,
                      functionName: "mintGenesis",
                      value: genesisMintPrice,
                    });
                  }}
                  className="pixel-btn pixel-btn-gold w-full"
                >
                  {t.mintGenesis}
                </button>

                <button
                  title={help.mintIncubator}
                  onClick={() =>
                    runTx(t.mintIncubator, {
                      address: addresses.game,
                      abi: gameAbi,
                      functionName: "mintIncubator",
                      value: parseEther("5"),
                    })
                  }
                  className="pixel-btn pixel-btn-gold w-full"
                >
                  {t.mintIncubator}
                </button>

                <button
                  title={help.expandFarm}
                  onClick={() => {
                    if (!selectedFarm) {
                      setToast("Select a farm first");
                      return;
                    }
                    if (expansionPrice === 0n) {
                      setToast("Expansion price unavailable");
                      return;
                    }
                    runTx(t.expandFarm, {
                      address: addresses.game,
                      abi: gameAbi,
                      functionName: "expandFarm",
                      args: [BigInt(selectedFarm)],
                      value: expansionPrice,
                    });
                  }}
                  className="pixel-btn pixel-btn-gold w-full"
                >
                  {t.expandFarm}
                </button>
              </div>
            </div>

            <div className="pixel-panel p-3">
              <h2 className="mb-2 font-display text-xl">{t.actions}</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  title={help.collectEggs}
                  disabled={!canCollectEggs}
                  onClick={() =>
                    selectedFarm &&
                    runTx(t.collectEggs, {
                      address: addresses.game,
                      abi: gameAbi,
                      functionName: "collectEggs",
                      args: [BigInt(selectedFarm)],
                    })
                  }
                  className="pixel-btn pixel-btn-green w-full"
                >
                  {collectedThisTurn ? `${t.collectedWait} ${formatCountdown(turnCountdown)}` : t.collectEggs}
                </button>

                <button
                  title={help.buyEnergy}
                  disabled={!selectedFarm || !isSeasonLive}
                  onClick={() =>
                    selectedFarm &&
                    runTx(t.buyEnergy, {
                      address: addresses.game,
                      abi: gameAbi,
                      functionName: "buyEnergyPack",
                      args: [BigInt(selectedFarm)],
                      value: parseEther("1"),
                    })
                  }
                  className="pixel-btn pixel-btn-green w-full"
                >
                  {t.buyEnergy}
                </button>

                <button
                  title={help.startIncubation}
                  disabled={!canStartIncubation}
                  onClick={() =>
                    selectedFarm &&
                    runTx(t.startIncubation, {
                      address: addresses.game,
                      abi: gameAbi,
                      functionName: "startIncubation",
                      args: [BigInt(selectedFarm), BigInt(selectedIncubator)],
                    })
                  }
                  className="pixel-btn pixel-btn-gold w-full"
                >
                  {t.startIncubation}
                </button>

                <button
                  title={help.startCooking}
                  disabled={!canAttemptStartCooking}
                  onClick={() =>
                    selectedFarm &&
                    runTx(t.startCooking, {
                      address: addresses.game,
                      abi: gameAbi,
                      functionName: "startCooking",
                      args: [BigInt(selectedFarm), BigInt(selectedIncubator)],
                    })
                  }
                  className="pixel-btn pixel-btn-gold w-full"
                >
                  {t.startCooking}
                </button>

                {!canStartCooking && canAttemptStartCooking && (
                  <p className="col-span-1 text-[11px] text-[#f5d9b3] sm:col-span-2">
                    Debug cook: season={isSeasonLive ? "ok" : "no"} incubator={incubatorReadyForNewProcess ? "ok" : "no"} energy=
                    {overview.availableEnergy >= 1n ? "ok" : "no"} chickenItem={hasChickenItemForCooking ? "ok" : "no"} selectedIncubator=
                    {selectedIncubator}
                  </p>
                )}

                <button
                  title={help.settleIncubator}
                  disabled={!canSettleIncubator}
                  onClick={() =>
                    runTx(t.settleIncubator, {
                      address: addresses.game,
                      abi: gameAbi,
                      functionName: "settleIncubator",
                      args: [BigInt(selectedIncubator)],
                    })
                  }
                  className="pixel-btn pixel-btn-blue w-full"
                >
                  {t.settleIncubator}
                </button>

                <button
                  title={help.breed}
                  disabled={!canBreed}
                  onClick={() =>
                    selectedFarm &&
                    runTx(t.breed, {
                      address: addresses.game,
                      abi: gameAbi,
                      functionName: "breed",
                      args: [BigInt(selectedFarm), BigInt(breedA), BigInt(breedB)],
                    })
                  }
                  className="pixel-btn pixel-btn-blue w-full"
                >
                  {t.breed}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  className="pixel-select"
                  value={selectedIncubator}
                  onChange={(event) => setSelectedIncubator(Number(event.target.value))}
                >
                  <option value={0}>{t.selectIncubator}</option>
                  {placedIncubators.map((id) => (
                    <option key={id} value={id}>{`Incubator #${id}`}</option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <select className="pixel-select" value={breedA} onChange={(event) => setBreedA(Number(event.target.value))}>
                    <option value={0}>{t.genesisA}</option>
                    {placedGenesis.map((id) => (
                      <option key={`a-${id}`} value={id}>{`#${id}`}</option>
                    ))}
                  </select>
                  <select className="pixel-select" value={breedB} onChange={(event) => setBreedB(Number(event.target.value))}>
                    <option value={0}>{t.genesisB}</option>
                    {placedGenesis.map((id) => (
                      <option key={`b-${id}`} value={id}>{`#${id}`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="mt-2 text-xs text-[#efd9be]">
                {selectedIncubator === 0
                  ? t.incubatorIdle
                  : selectedIncubatorReadyToSettle
                    ? t.incubatorReady
                    : selectedIncubatorActive
                      ? `${selectedIncubatorProcessType === 2 ? t.incubatorCooking : t.incubatorIncubating} - ${t.releaseIn} ${formatCountdown(selectedIncubatorSecondsToReady)}`
                      : t.incubatorIdle}
              </p>
            </div>

            <div className="pixel-panel p-3">
              <h3 className="mb-2 font-semibold">{t.inventory}</h3>

              <div className="mb-2 rounded-md border border-[#9f7a54]/40 bg-[#2c180f]/45 p-2">
                <div className="mb-1 text-[11px] font-semibold text-[#f2dbbd]">
                  {t.chickenItems}: {overview.chickenItems.toString()}
                </div>
                {chickenItemsToRender > 0 ? (
                  <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto pr-1">
                    {Array.from({ length: chickenItemsToRender }, (_, idx) => (
                      <span key={`ci-${idx}`} className="chicken-item-chip" title={`${t.chickenItems} #${idx + 1}`}>
                        <img src={GAME_ART.chickenItem} alt="Chicken Item" className="chicken-item-sprite" loading="lazy" />
                      </span>
                    ))}
                    {chickenItemsRemaining > 0n && (
                      <span className="chicken-item-more">{`+${chickenItemsRemaining.toString()}`}</span>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-[#cfb796]/85">0</div>
                )}
              </div>

              {selectedAsset && (
                <div className="pixel-tag mb-2 inline-flex">
                  {t.selectedAsset}: {labelForAsset(selectedAsset.assetType, selectedAsset.tokenId, lang)}
                </div>
              )}

              <div className="space-y-2 text-xs">
                <div className="flex flex-wrap gap-1">
                  {inventoryGenesis.map((id) => (
                    <button
                      key={`g-${id}`}
                      type="button"
                      draggable
                      onDragStart={(event) => handleInventoryDragStart(event, { assetType: 1, tokenId: id })}
                      onClick={() => setSelectedAsset({ assetType: 1, tokenId: id })}
                      className={`inventory-chip inline-flex items-center gap-1 ${selectedAsset?.assetType === 1 && selectedAsset.tokenId === id ? "is-selected" : ""}`}
                      title={t.dragHint}
                    >
                      <img src={imageForAsset(1)} alt="Genesis" className="h-5 w-5 rounded object-cover" loading="lazy" />
                      Genesis #{id}
                    </button>
                  ))}

                  {inventoryOffspring.map((id) => (
                    <button
                      key={`o-${id}`}
                      type="button"
                      draggable
                      onDragStart={(event) => handleInventoryDragStart(event, { assetType: 2, tokenId: id })}
                      onClick={() => setSelectedAsset({ assetType: 2, tokenId: id })}
                      className={`inventory-chip inline-flex items-center gap-1 ${selectedAsset?.assetType === 2 && selectedAsset.tokenId === id ? "is-selected" : ""}`}
                      title={t.dragHint}
                    >
                      <img src={imageForAsset(2)} alt="Offspring" className="h-5 w-5 rounded object-cover" loading="lazy" />
                      Offspring #{id}
                    </button>
                  ))}

                  {inventoryIncubators.map((id) => (
                    <button
                      key={`i-${id}`}
                      type="button"
                      draggable
                      onDragStart={(event) => handleInventoryDragStart(event, { assetType: 3, tokenId: id })}
                      onClick={() => setSelectedAsset({ assetType: 3, tokenId: id })}
                      className={`inventory-chip inline-flex items-center gap-1 ${selectedAsset?.assetType === 3 && selectedAsset.tokenId === id ? "is-selected" : ""}`}
                      title={t.dragHint}
                    >
                      <img src={imageForAsset(3)} alt="Incubator" className="h-5 w-5 rounded object-cover" loading="lazy" />
                      Incubator #{id}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pixel-panel p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-xl">{t.rankingTitle}</h3>
            <div className="text-sm text-[#f0ddc2]">
              {t.rank}: #{myRank || "-"} | {t.points}: {(myPointsData as bigint | undefined)?.toString() ?? "0"} | {t.cooked}: {(myCookedData as bigint | undefined)?.toString() ?? "0"}
            </div>
          </div>

          <div className="pixel-table-wrap">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#9a7550] text-[#f7dfbf]">
                  <th className="px-2 py-2">{t.rank}</th>
                  <th className="px-2 py-2">{t.wallet}</th>
                  <th className="px-2 py-2">{t.points}</th>
                  <th className="px-2 py-2">{t.cooked}</th>
                  <th className="px-2 py-2">{t.estPrize}</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-[#f1dabd]/80">{t.noEntries}</td>
                  </tr>
                ) : (
                  leaderboard.slice(0, 100).map((entry, idx) => {
                    const rank = idx + 1;
                    const isMe = Boolean(address && entry.wallet.toLowerCase() === address.toLowerCase());
                    const est = rewardEstimateForRank(rank);
                    return (
                      <tr key={entry.wallet} className={`border-b border-[#8d6943]/50 ${isMe ? "bg-[#f7d58e]/25" : "bg-transparent"}`}>
                        <td className="px-2 py-2 font-semibold">#{rank}</td>
                        <td className="px-2 py-2">{entry.wallet}</td>
                        <td className="px-2 py-2">{entry.points.toString()}</td>
                        <td className="px-2 py-2">{entry.cooked.toString()}</td>
                        <td className="px-2 py-2">{formatPOL(est)} POL</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#f2ddc2]">
            <span>Top 3:</span>
            {top3.length === 0 && <span>{t.noEntries}</span>}
            {top3.map((entry, idx) => (
              <span key={entry.wallet} className="pixel-tag">
                #{idx + 1} {shortAddress(entry.wallet)} ({entry.points.toString()})
              </span>
            ))}
          </div>
        </section>

        {!isSeasonLive && currentSeason > 0 && (
          <section className="pixel-panel border-[#a6805a] p-3 text-amber-100">
            <p>{t.seasonEnded}</p>
            {canClaimPrevious && (
              <button
                onClick={() =>
                  runTx(t.claimRewards, {
                    address: addresses.game,
                    abi: gameAbi,
                    functionName: "claimReward",
                    args: [BigInt(previousSeason)],
                  })
                }
                className="pixel-btn pixel-btn-gold mt-2"
              >
                {t.claimRewards}
              </button>
            )}
          </section>
        )}

        {isOwner && (
          <OwnerPanel
            visible={isOwner}
            owner={ownerAddress}
            poolBalance={poolBalanceData as bigint | undefined}
            treasuryBalance={treasuryBalanceData as bigint | undefined}
            addresses={{
              game: addresses.game,
              farm: addresses.farmNFT,
              genesis: addresses.genesisNFT,
              offspring: addresses.offspringNFT,
              incubator: addresses.incubatorNFT,
            }}
            labels={{
              ownerPanel: t.ownerPanel,
              connectedOwner: t.connectedOwner,
              pool: t.pool,
              treasury: t.treasury,
              poolControls: t.poolControls,
              treasuryControls: t.treasuryControls,
              deposit: t.deposit,
              withdraw: t.withdraw,
              copy: t.copy,
              amountPlaceholder: t.amount,
            }}
            depositPoolAmount={depositPoolAmount}
            setDepositPoolAmount={setDepositPoolAmount}
            withdrawPoolAmount={withdrawPoolAmount}
            setWithdrawPoolAmount={setWithdrawPoolAmount}
            depositTreasuryAmount={depositTreasuryAmount}
            setDepositTreasuryAmount={setDepositTreasuryAmount}
            withdrawTreasuryAmount={withdrawTreasuryAmount}
            setWithdrawTreasuryAmount={setWithdrawTreasuryAmount}
            onDepositPool={() => runTx(t.deposit, { address: addresses.game, abi: gameAbi, functionName: "depositPool", value: parsePolInput(depositPoolAmount) })}
            onWithdrawPool={() => runTx(t.withdraw, { address: addresses.game, abi: gameAbi, functionName: "withdrawPool", args: [parsePolInput(withdrawPoolAmount)] })}
            onDepositTreasury={() => runTx(t.deposit, { address: addresses.game, abi: gameAbi, functionName: "depositTreasury", value: parsePolInput(depositTreasuryAmount) })}
            onWithdrawTreasury={() => runTx(t.withdraw, { address: addresses.game, abi: gameAbi, functionName: "withdrawTreasury", args: [parsePolInput(withdrawTreasuryAmount)] })}
          />
        )}
      </div>

      {celebration && (
        <div className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center px-3">
          <div className="pixel-shell max-w-xl bg-[#2a170d]/95 p-5 text-center">
            <p className="font-display text-sm leading-6 text-[#fff2d8]">{celebration}</p>
          </div>
        </div>
      )}

      {(toast || busyLabel || isConnecting || !isContractsConfigured || wrongNetwork) && (
        <div className="pixel-toast fixed left-1/2 top-4 z-[80] -translate-x-1/2 px-4 py-2 text-sm">
          {!isContractsConfigured && "Deploy contracts first to populate .env addresses."}
          {isConnecting && ` ${t.connect}...`}
          {busyLabel && ` ${busyLabel}...`}
          {wrongNetwork ? ` ${t.wrongNetwork} (${supportedChainId})` : ` ${t.correctNetwork}`}
          {toast && ` ${toast}`}
        </div>
      )}
    </div>
  );
}
