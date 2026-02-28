import type { Abi, Address } from "viem";

import gameAbiJson from "@chicken-protocol/shared/abis/ChickenProtocolGame";
import farmAbiJson from "@chicken-protocol/shared/abis/FarmNFT";
import genesisAbiJson from "@chicken-protocol/shared/abis/GenesisChickenNFT";
import offspringAbiJson from "@chicken-protocol/shared/abis/OffspringChickenNFT";
import incubatorAbiJson from "@chicken-protocol/shared/abis/IncubatorNFT";

export const addresses = {
  game: (import.meta.env.VITE_GAME_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address,
  farmNFT: (import.meta.env.VITE_FARM_NFT ?? "0x0000000000000000000000000000000000000000") as Address,
  genesisNFT: (import.meta.env.VITE_GENESIS_NFT ?? "0x0000000000000000000000000000000000000000") as Address,
  offspringNFT: (import.meta.env.VITE_OFFSPRING_NFT ?? "0x0000000000000000000000000000000000000000") as Address,
  incubatorNFT: (import.meta.env.VITE_INCUBATOR_NFT ?? "0x0000000000000000000000000000000000000000") as Address,
};

export const gameAbi = gameAbiJson as Abi;
export const farmAbi = farmAbiJson as Abi;
export const genesisAbi = genesisAbiJson as Abi;
export const offspringAbi = offspringAbiJson as Abi;
export const incubatorAbi = incubatorAbiJson as Abi;

export const isContractsConfigured =
  addresses.game !== "0x0000000000000000000000000000000000000000" &&
  addresses.farmNFT !== "0x0000000000000000000000000000000000000000";
