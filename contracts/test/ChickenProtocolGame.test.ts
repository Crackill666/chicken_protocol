import { expect } from "chai";
import { ethers } from "hardhat";

describe("ChickenProtocolGame", function () {
  async function deployFixture() {
    const [owner, player] = await ethers.getSigners();

    const FarmNFT = await ethers.getContractFactory("FarmNFT");
    const farmNFT = await FarmNFT.deploy(owner.address);
    await farmNFT.waitForDeployment();

    const GenesisChickenNFT = await ethers.getContractFactory("GenesisChickenNFT");
    const genesisNFT = await GenesisChickenNFT.deploy(owner.address);
    await genesisNFT.waitForDeployment();

    const OffspringChickenNFT = await ethers.getContractFactory("OffspringChickenNFT");
    const offspringNFT = await OffspringChickenNFT.deploy(owner.address);
    await offspringNFT.waitForDeployment();

    const IncubatorNFT = await ethers.getContractFactory("IncubatorNFT");
    const incubatorNFT = await IncubatorNFT.deploy(owner.address);
    await incubatorNFT.waitForDeployment();

    const Game = await ethers.getContractFactory("ChickenProtocolGame");
    const game = await Game.deploy(
      owner.address,
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
    await (await game.startFirstSeason(0)).wait();

    return { owner, player, game };
  }

  it("computes expansion prices using 1.5^n with wad rounding up", async function () {
    const { game } = await deployFixture();

    expect(await game.getExpansionPrice(0)).to.equal(ethers.parseEther("5"));
    expect(await game.getExpansionPrice(1)).to.equal(ethers.parseEther("7.5"));
    expect(await game.getExpansionPrice(2)).to.equal(ethers.parseEther("11.25"));
  });

  it("collects eggs once per turn and spends energy", async function () {
    const { game, player } = await deployFixture();

    await (await game.connect(player).mintFarm({ value: await game.FARM_MINT_PRICE() })).wait();

    const genesisPrice = await game.getGenesisMintPrice();
    await (await game.connect(player).mintGenesis({ value: genesisPrice })).wait();

    await (await game.connect(player).placeGenesis(1, 1, 0)).wait();

    await (await game.connect(player).collectEggs(1)).wait();
    const overview = await game.getFarmOverview(1);
    expect(overview.eggs).to.equal(5);

    await expect(game.connect(player).collectEggs(1)).to.be.revertedWithCustomError(game, "AlreadyCollectedTurn");
  });

  it("uses an individual 30m timer for incubation (not aligned to global turn)", async function () {
    const { game, player } = await deployFixture();

    await (await game.connect(player).mintFarm({ value: await game.FARM_MINT_PRICE() })).wait();
    await (await game.connect(player).mintGenesis({ value: await game.getGenesisMintPrice() })).wait();
    await (await game.connect(player).mintIncubator({ value: await game.INCUBATOR_MINT_PRICE() })).wait();

    await (await game.connect(player).placeGenesis(1, 1, 0)).wait();
    await (await game.connect(player).placeIncubator(1, 1, 1)).wait();

    for (let i = 0; i < 5; i++) {
      if (i > 0) {
        await ethers.provider.send("evm_increaseTime", [30 * 60 + 1]);
        await ethers.provider.send("evm_mine", []);
      }
      await (await game.connect(player).collectEggs(1)).wait();
    }

    const latestBeforeAlign = await ethers.provider.getBlock("latest");
    if (!latestBeforeAlign) throw new Error("latest block unavailable");
    const turnInfoBeforeAlign = await game.getTurnInfo();
    const secondsToNextTurn = Number(turnInfoBeforeAlign[3] - BigInt(latestBeforeAlign.timestamp));
    if (secondsToNextTurn > 10) {
      await ethers.provider.send("evm_increaseTime", [secondsToNextTurn - 5]);
      await ethers.provider.send("evm_mine", []);
    }

    const startTx = await game.connect(player).startIncubation(1, 1);
    const startReceipt = await startTx.wait();
    if (!startReceipt) throw new Error("missing start incubation receipt");
    const startBlock = await ethers.provider.getBlock(startReceipt.blockNumber);
    if (!startBlock) throw new Error("missing start incubation block");

    const processAfterStart = await game.incubatorProcesses(1);
    expect(processAfterStart.active).to.equal(true);
    expect(processAfterStart.readyTimestamp).to.equal(BigInt(startBlock.timestamp + 30 * 60));

    const latestAfterStart = await ethers.provider.getBlock("latest");
    if (!latestAfterStart) throw new Error("latest block unavailable after start");
    const turnInfoAfterStart = await game.getTurnInfo();
    const secondsToCrossTurn = Number(turnInfoAfterStart[3] - BigInt(latestAfterStart.timestamp));

    await ethers.provider.send("evm_increaseTime", [secondsToCrossTurn + 2]);
    await ethers.provider.send("evm_mine", []);
    await (await game.connect(player).settleIncubator(1)).wait();

    const processAfterTurnCross = await game.incubatorProcesses(1);
    expect(processAfterTurnCross.active).to.equal(true);
    const midOverview = await game.getFarmOverview(1);
    expect(midOverview.chickenItems).to.equal(0n);

    const latestBeforeReady = await ethers.provider.getBlock("latest");
    if (!latestBeforeReady) throw new Error("latest block unavailable before ready");
    const remaining = Number(processAfterTurnCross.readyTimestamp - BigInt(latestBeforeReady.timestamp));
    if (remaining > 0) {
      await ethers.provider.send("evm_increaseTime", [remaining + 1]);
      await ethers.provider.send("evm_mine", []);
    }

    await (await game.connect(player).settleIncubator(1)).wait();
    const processAfterReady = await game.incubatorProcesses(1);
    expect(processAfterReady.active).to.equal(false);
    const finalOverview = await game.getFarmOverview(1);
    expect(finalOverview.chickenItems).to.equal(1n);
  });

  it("enforces breeding cooldown and 3-offspring lifetime limit on genesis", async function () {
    const { game, player } = await deployFixture();

    await (await game.connect(player).mintFarm({ value: await game.FARM_MINT_PRICE() })).wait();

    await (await game.connect(player).mintGenesis({ value: await game.getGenesisMintPrice() })).wait();
    await (await game.connect(player).mintGenesis({ value: await game.getGenesisMintPrice() })).wait();

    await (await game.connect(player).placeGenesis(1, 1, 0)).wait();
    await (await game.connect(player).placeGenesis(1, 2, 1)).wait();

    await (await game.connect(player).breed(1, 1, 2)).wait();
    await expect(game.connect(player).breed(1, 1, 2)).to.be.revertedWithCustomError(game, "BreedingCooldown");

    for (let i = 0; i < 2; i++) {
      await ethers.provider.send("evm_increaseTime", [3 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);
      await (await game.connect(player).breed(1, 1, 2)).wait();
    }

    await ethers.provider.send("evm_increaseTime", [3 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    await expect(game.connect(player).breed(1, 1, 2)).to.be.revertedWithCustomError(game, "BreedingLimitReached");
  });

  it("finalizes a season and allows claim", async function () {
    const { game, owner } = await deployFixture();

    await (await game.depositPool({ value: ethers.parseEther("10") })).wait();

    const seasonDuration = await game.SEASON_DURATION();
    await ethers.provider.send("evm_increaseTime", [Number(seasonDuration) + 10]);
    await ethers.provider.send("evm_mine", []);

    await (await game.finalizeSeason(1, [owner.address])).wait();

    expect(await game.seasonFinalized(1)).to.equal(true);
    expect(await game.walletRank(1, owner.address)).to.equal(1);

    await (await game.claimReward(1)).wait();
    expect(await game.seasonClaimed(1, owner.address)).to.equal(true);
  });
});
