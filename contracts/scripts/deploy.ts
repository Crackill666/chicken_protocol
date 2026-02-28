import { promises as fs } from "fs";
import path from "path";
import hre from "hardhat";

const CONTRACT_NAMES = [
  "ChickenProtocolGame",
  "FarmNFT",
  "GenesisChickenNFT",
  "OffspringChickenNFT",
  "IncubatorNFT",
] as const;

type AddressBook = {
  chainId: number;
  farmNFT: string;
  genesisNFT: string;
  offspringNFT: string;
  incubatorNFT: string;
  game: string;
};

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function writeJson(filePath: string, value: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function upsertEnv(filePath: string, updates: Record<string, string>) {
  let current = "";
  try {
    current = await fs.readFile(filePath, "utf8");
  } catch {
    current = "";
  }

  const map = new Map<string, string>();
  for (const line of current.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    map.set(line.slice(0, idx).trim(), line.slice(idx + 1));
  }

  for (const [k, v] of Object.entries(updates)) {
    map.set(k, v);
  }

  const body = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, body + "\n", "utf8");
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const owner = deployer.address;
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);

  console.log(`Deploying Chicken Protocol with owner ${owner} on chain ${chainId}`);

  const FarmNFT = await hre.ethers.getContractFactory("FarmNFT");
  const farmNFT = await FarmNFT.deploy(owner);
  await farmNFT.waitForDeployment();

  const GenesisChickenNFT = await hre.ethers.getContractFactory("GenesisChickenNFT");
  const genesisNFT = await GenesisChickenNFT.deploy(owner);
  await genesisNFT.waitForDeployment();

  const OffspringChickenNFT = await hre.ethers.getContractFactory("OffspringChickenNFT");
  const offspringNFT = await OffspringChickenNFT.deploy(owner);
  await offspringNFT.waitForDeployment();

  const IncubatorNFT = await hre.ethers.getContractFactory("IncubatorNFT");
  const incubatorNFT = await IncubatorNFT.deploy(owner);
  await incubatorNFT.waitForDeployment();

  const ChickenProtocolGame = await hre.ethers.getContractFactory("ChickenProtocolGame");
  const game = await ChickenProtocolGame.deploy(
    owner,
    await farmNFT.getAddress(),
    await genesisNFT.getAddress(),
    await offspringNFT.getAddress(),
    await incubatorNFT.getAddress(),
  );
  await game.waitForDeployment();

  await (await farmNFT.setGame(await game.getAddress())).wait();
  await (await genesisNFT.setGame(await game.getAddress())).wait();
  await (await offspringNFT.setGame(await game.getAddress())).wait();
  await (await incubatorNFT.setGame(await game.getAddress())).wait();

  const startSeason = parseBoolean(process.env.START_SEASON_ON_DEPLOY, true);
  if (startSeason) {
    await (await game.startFirstSeason(0)).wait();
  }

  const addresses: AddressBook = {
    chainId,
    farmNFT: await farmNFT.getAddress(),
    genesisNFT: await genesisNFT.getAddress(),
    offspringNFT: await offspringNFT.getAddress(),
    incubatorNFT: await incubatorNFT.getAddress(),
    game: await game.getAddress(),
  };

  const repoRoot = path.resolve(__dirname, "..", "..");
  const sharedRoot = path.join(repoRoot, "packages", "shared");
  const addressFile = path.join(sharedRoot, "addresses", chainId === 80002 ? "amoy.json" : `chain-${chainId}.json`);
  await writeJson(addressFile, addresses);

  const abiDir = path.join(sharedRoot, "abis");
  await ensureDir(abiDir);
  for (const name of CONTRACT_NAMES) {
    const artifact = await hre.artifacts.readArtifact(name);
    await writeJson(path.join(abiDir, `${name}.json`), artifact.abi);
  }

  const typeFile = path.join(sharedRoot, "types", "deployed.ts");
  const typeBody = `export const deployed = ${JSON.stringify(addresses, null, 2)} as const;\n`;
  await ensureDir(path.dirname(typeFile));
  await fs.writeFile(typeFile, typeBody, "utf8");

  const webEnv = path.join(repoRoot, "apps", "web", ".env");
  await upsertEnv(webEnv, {
    VITE_CHAIN_ID: String(chainId),
    VITE_FARM_NFT: addresses.farmNFT,
    VITE_GENESIS_NFT: addresses.genesisNFT,
    VITE_OFFSPRING_NFT: addresses.offspringNFT,
    VITE_INCUBATOR_NFT: addresses.incubatorNFT,
    VITE_GAME_ADDRESS: addresses.game,
  });

  console.log("Deployment complete:");
  console.table(addresses);
  console.log(`Addresses written to ${addressFile}`);
  console.log(`ABIs written to ${abiDir}`);
  console.log(`Frontend env updated at ${webEnv}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
