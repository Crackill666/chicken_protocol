export type Address = `0x${string}`;

export type DeployedAddresses = {
  chainId: number;
  farmNFT: Address;
  genesisNFT: Address;
  offspringNFT: Address;
  incubatorNFT: Address;
  game: Address;
};

export enum AssetType {
  None = 0,
  Genesis = 1,
  Offspring = 2,
  Incubator = 3,
}

export enum ProcessType {
  None = 0,
  Incubation = 1,
  Cooking = 2,
}

export enum OffspringRarity {
  Common = 0,
  Rare = 1,
  Epic = 2,
}

export { deployed } from "./deployed";
