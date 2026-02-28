import hre from "hardhat";

type Addresses = {
  game: string;
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const addressArg = process.env.GAME_ADDRESS;
  if (!addressArg) {
    throw new Error("GAME_ADDRESS env variable is required for seed script.");
  }

  const game = await hre.ethers.getContractAt("ChickenProtocolGame", addressArg);

  const mintFarmTx = await game.mintFarm({ value: await game.FARM_MINT_PRICE() });
  await mintFarmTx.wait();

  const mintGenesisPrice = await game.getGenesisMintPrice();
  const mintGenesisTx = await game.mintGenesis({ value: mintGenesisPrice });
  await mintGenesisTx.wait();

  const mintIncubatorTx = await game.mintIncubator({ value: await game.INCUBATOR_MINT_PRICE() });
  await mintIncubatorTx.wait();

  console.log(`Seeded initial assets for ${deployer.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
