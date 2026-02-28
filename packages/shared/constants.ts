export const WAD = 10n ** 18n;

export const CHAIN_ID = 80002;
export const TURN_SECONDS = 30 * 60;
export const TURNS_PER_DAY = 6;
export const GAME_DAY_SECONDS = TURN_SECONDS * TURNS_PER_DAY;
export const SEASON_DAYS = 14;
export const SEASON_SECONDS = SEASON_DAYS * GAME_DAY_SECONDS;
export const BREEDING_COOLDOWN_SECONDS = 3 * 60 * 60;

export const FARM_MINT_PRICE = 10n * WAD;
export const INCUBATOR_MINT_PRICE = 5n * WAD;
export const ENERGY_PACK_PRICE = 1n * WAD;

export const GENESIS_BASE_PRICE = 5n * WAD;
export const GENESIS_K_PRICE = 2n * 10n ** 16n; // 0.02 POL in wei

export const EXPANSION_BASE_PRICE = 5n * WAD;
export const EXPANSION_MULTIPLIER_WAD = 15n * 10n ** 17n; // 1.5 WAD

export const SLOT_BASE = 10;
export const SLOT_EXPANSION_STEP = 5;

export const BASE_DAILY_ENERGY = 4;
export const ENERGY_PACK_BONUS = 4;
export const ENERGY_PACK_DAILY_LIMIT = 2;

export const GENESIS_EGGS_PER_TURN = 5;
export const OFFSPRING_EGGS_PER_TURN = 3;
export const EGG_CAPACITY = 600;

export const INCUBATION_EGGS_COST = 24;
export const COOKING_POINTS_BASE = 50;
export const ACTION_ENERGY_COST = {
  collectEggs: 1,
  startIncubation: 1,
  startCooking: 1,
  breed: 2,
} as const;

export const REVENUE_POOL_BPS = 8000;
export const REVENUE_TREASURY_BPS = 2000;

export const TOP_DISTRIBUTION_BPS = 9050;
export const REWARD_BPS_BY_RANK = {
  1: 1500,
  2: 1000,
  3: 700,
} as const;
export const REWARD_BPS_RANGES = [
  { from: 4, to: 10, bps: 300 },
  { from: 11, to: 25, bps: 100 },
  { from: 26, to: 50, bps: 50 },
  { from: 51, to: 100, bps: 20 },
] as const;
export const RARITY_MULTIPLIERS_WAD = {
  common: WAD,
  rare: 115n * 10n ** 16n,
  epic: 130n * 10n ** 16n,
} as const;
