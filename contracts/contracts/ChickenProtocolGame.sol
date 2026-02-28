// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import {FarmNFT} from "./FarmNFT.sol";
import {GenesisChickenNFT} from "./GenesisChickenNFT.sol";
import {OffspringChickenNFT} from "./OffspringChickenNFT.sol";
import {IncubatorNFT} from "./IncubatorNFT.sol";
import {FixedPointMath} from "./lib/FixedPointMath.sol";

contract ChickenProtocolGame is Ownable, ReentrancyGuard {
    using Address for address payable;

    enum AssetType {
        None,
        Genesis,
        Offspring,
        Incubator
    }

    enum ProcessType {
        None,
        Incubation,
        Cooking
    }

    struct SlotAsset {
        AssetType assetType;
        uint256 tokenId;
    }

    struct AssetLocation {
        uint256 farmId;
        uint256 slotIndex;
        bool placed;
    }

    struct DailyFarmState {
        uint64 dayIndex;
        uint64 energyTurnKey;
        uint8 packsBought;
        uint16 energySpent;
        uint8 collectedMask;
    }

    struct FarmState {
        uint256 eggs;
        uint256 chickenItems;
        uint256 genesisInSlots;
        uint256 offspringInSlots;
        uint256 incubatorsInSlots;
    }

    struct IncubatorProcess {
        ProcessType processType;
        uint256 farmId;
        uint256 readyTimestamp;
        uint256 seasonId;
        bool active;
    }

    struct FarmOverview {
        uint256 eggs;
        uint256 chickenItems;
        uint256 capacity;
        uint256 expansions;
        uint256 genesisInSlots;
        uint256 offspringInSlots;
        uint256 incubatorsInSlots;
        uint256 availableEnergy;
        uint256 totalEnergy;
        uint256 energySpent;
        uint256 packsBought;
        uint256 collectedMask;
    }

    uint256 public constant WAD = 1e18;

    uint256 public constant FARM_MINT_PRICE = 10 ether;
    uint256 public constant INCUBATOR_MINT_PRICE = 5 ether;
    uint256 public constant ENERGY_PACK_PRICE = 1 ether;

    uint256 public constant GENESIS_BASE_PRICE = 5 ether;
    uint256 public constant GENESIS_K_PRICE = 2e16;

    uint256 public constant EXPANSION_BASE_PRICE = 5 ether;
    uint256 public constant EXPANSION_MULTIPLIER_WAD = 15e17;

    uint256 public constant SLOT_BASE_CAPACITY = 10;
    uint256 public constant SLOT_EXPANSION_STEP = 5;

    uint256 public constant BASE_DAILY_ENERGY = 4;
    uint256 public constant ENERGY_PACK_BONUS = 4;
    uint256 public constant ENERGY_PACK_LIMIT_PER_DAY = 2;

    uint256 public constant GENESIS_EGGS_PER_TURN = 5;
    uint256 public constant OFFSPRING_EGGS_PER_TURN = 3;
    uint256 public constant EGG_CAPACITY = 600;

    uint256 public constant INCUBATION_EGG_COST = 24;
    uint256 public constant COOKING_BASE_POINTS = 50;

    uint256 public constant TURN_DURATION = 30 minutes;
    uint256 public constant TURNS_PER_DAY = 6;
    uint256 public constant GAME_DAY_DURATION = TURN_DURATION * TURNS_PER_DAY;
    uint256 public constant INCUBATOR_ACTION_DURATION = 30 minutes;
    uint256 public constant BREEDING_COOLDOWN_DURATION = 3 hours;
    uint256 public constant SEASON_GAME_DAYS = 14;
    uint256 public constant SEASON_DURATION = SEASON_GAME_DAYS * GAME_DAY_DURATION;

    uint256 public constant POOL_BPS = 8000;
    uint256 public constant TREASURY_BPS = 2000;
    uint256 public constant TOTAL_BPS = 10000;
    uint256 public constant TOP_DISTRIBUTION_BPS = 9050;

    FarmNFT public immutable farmNFT;
    GenesisChickenNFT public immutable genesisNFT;
    OffspringChickenNFT public immutable offspringNFT;
    IncubatorNFT public immutable incubatorNFT;

    uint64 public seasonGenesisTimestamp;
    uint256 public rngNonce;

    uint256 public poolBalance;
    uint256 public treasuryBalance;

    mapping(uint256 => FarmState) private _farmStates;
    mapping(uint256 => DailyFarmState) private _farmDaily;
    mapping(uint256 => mapping(uint256 => SlotAsset)) private _farmSlots;

    mapping(bytes32 => AssetLocation) public assetLocations;
    mapping(uint256 => mapping(uint256 => bool)) public eggsCollectedForTurn;
    mapping(uint256 => IncubatorProcess) public incubatorProcesses;

    mapping(uint256 => mapping(address => uint256)) private _walletPoints;
    mapping(uint256 => mapping(address => uint256)) private _walletCooked;

    mapping(uint256 => address[]) private _seasonParticipants;
    mapping(uint256 => mapping(address => bool)) private _seasonParticipantSeen;

    mapping(uint256 => bool) public seasonFinalized;
    mapping(uint256 => uint256) public seasonDistributable;
    mapping(uint256 => uint256) public seasonUnclaimed;
    mapping(uint256 => mapping(address => uint256)) public seasonRewardWeight;
    mapping(uint256 => mapping(address => uint256)) public seasonRankByWallet;
    mapping(uint256 => mapping(address => bool)) public seasonClaimed;
    mapping(uint256 => mapping(uint256 => address)) public seasonTopAddress;
    mapping(uint256 => uint256) public seasonTopCount;

    error InvalidPayment();
    error NotFarmOwner();
    error SeasonNotStarted();
    error InvalidSeason();
    error SeasonNotEnded();
    error SeasonAlreadyFinalized();
    error InvalidLeaderboard();
    error SlotOutOfRange();
    error SlotOccupied();
    error SlotEmpty();
    error AssetAlreadyPlaced();
    error AssetNotInFarm();
    error InsufficientEnergy();
    error AlreadyCollectedTurn();
    error NotEnoughEggs();
    error NotEnoughChickenItems();
    error EnergyPackLimitReached();
    error IncubatorBusy();
    error ProcessNotClaimable();
    error BreedingCooldown();
    error BreedingLimitReached();
    error NotEligible();
    error AlreadyClaimed();
    error InvalidOwnerAction();
    error ActiveIncubatorProcess();

    event FirstSeasonStarted(uint64 timestamp);

    event FarmMinted(address indexed player, uint256 indexed farmId, uint256 price);
    event GenesisMinted(address indexed player, uint256 indexed tokenId, uint256 price);
    event IncubatorMinted(address indexed player, uint256 indexed tokenId, uint256 price);
    event SlotsExpanded(uint256 indexed farmId, uint256 expansions, uint256 newCapacity, uint256 price);

    event AssetPlaced(uint256 indexed farmId, uint256 indexed slotIndex, AssetType assetType, uint256 tokenId);
    event AssetRemoved(uint256 indexed farmId, uint256 indexed slotIndex, AssetType assetType, uint256 tokenId);

    event EggsCollected(uint256 indexed farmId, uint256 indexed dayIndex, uint256 indexed turnIndex, uint256 eggsAdded);

    event IncubationStarted(uint256 indexed farmId, uint256 indexed incubatorId, uint256 readyTimestamp, uint256 seasonId);
    event IncubationCompleted(uint256 indexed farmId, uint256 indexed incubatorId, uint256 chickensAdded, uint256 seasonId);
    event IncubationCancelled(uint256 indexed farmId, uint256 indexed incubatorId, uint256 seasonId);

    event CookingStarted(uint256 indexed farmId, uint256 indexed incubatorId, uint256 readyTimestamp, uint256 seasonId);
    event CookingCompleted(
        uint256 indexed farmId,
        uint256 indexed incubatorId,
        address indexed wallet,
        uint256 pointsAdded,
        uint256 multiplierWad,
        uint256 seasonId
    );
    event CookingCancelled(uint256 indexed farmId, uint256 indexed incubatorId, uint256 seasonId);

    event Bred(address indexed wallet, uint256 indexed offspringId, uint8 rarity, uint256 farmId, uint256 genesisA, uint256 genesisB);
    event PointsAdded(address indexed wallet, uint256 indexed seasonId, uint256 points, uint256 multiplierWad);

    event SeasonFinalized(uint256 indexed seasonId);
    event RewardClaimed(address indexed wallet, uint256 indexed seasonId, uint256 amount);

    event PoolDeposited(address indexed sender, uint256 amount);
    event PoolWithdrawn(address indexed recipient, uint256 amount);
    event TreasuryDeposited(address indexed sender, uint256 amount);
    event TreasuryWithdrawn(address indexed recipient, uint256 amount);

    event EnergyPackBought(uint256 indexed farmId, uint256 indexed dayIndex, uint256 packsBought);

    constructor(
        address owner_,
        address farmNFT_,
        address genesisNFT_,
        address offspringNFT_,
        address incubatorNFT_
    ) {
        farmNFT = FarmNFT(farmNFT_);
        genesisNFT = GenesisChickenNFT(genesisNFT_);
        offspringNFT = OffspringChickenNFT(offspringNFT_);
        incubatorNFT = IncubatorNFT(incubatorNFT_);
        transferOwnership(owner_);
    }

    modifier onlyFarmOwner(uint256 farmId) {
        if (farmNFT.ownerOf(farmId) != msg.sender) revert NotFarmOwner();
        _;
    }

    function startFirstSeason(uint64 timestamp) external onlyOwner {
        if (seasonGenesisTimestamp != 0) revert InvalidOwnerAction();
        if (timestamp == 0) {
            seasonGenesisTimestamp = uint64(block.timestamp);
        } else {
            seasonGenesisTimestamp = timestamp;
        }
        emit FirstSeasonStarted(seasonGenesisTimestamp);
    }

    function mintFarm() external payable returns (uint256 farmId) {
        if (msg.value != FARM_MINT_PRICE) revert InvalidPayment();
        farmId = farmNFT.mintFarm(msg.sender);
        _splitRevenue(msg.value);
        emit FarmMinted(msg.sender, farmId, msg.value);
    }

    function mintIncubator() external payable returns (uint256 tokenId) {
        if (msg.value != INCUBATOR_MINT_PRICE) revert InvalidPayment();
        tokenId = incubatorNFT.mintIncubator(msg.sender);
        _splitRevenue(msg.value);
        emit IncubatorMinted(msg.sender, tokenId, msg.value);
    }

    function mintGenesis() external payable returns (uint256 tokenId) {
        uint256 price = getGenesisMintPrice();
        if (msg.value != price) revert InvalidPayment();
        tokenId = genesisNFT.mintGenesis(msg.sender);
        _splitRevenue(msg.value);
        emit GenesisMinted(msg.sender, tokenId, msg.value);
    }

    function expandFarm(uint256 farmId) external payable onlyFarmOwner(farmId) {
        uint256 n = farmNFT.expansions(farmId);
        uint256 price = getExpansionPrice(n);
        if (msg.value != price) revert InvalidPayment();
        farmNFT.addExpansion(farmId);
        _splitRevenue(msg.value);
        emit SlotsExpanded(farmId, n + 1, farmCapacity(farmId), msg.value);
    }

    function buyEnergyPack(uint256 farmId) external payable onlyFarmOwner(farmId) {
        if (msg.value != ENERGY_PACK_PRICE) revert InvalidPayment();
        DailyFarmState storage daily = _syncDaily(farmId);
        if (daily.packsBought >= ENERGY_PACK_LIMIT_PER_DAY) revert EnergyPackLimitReached();
        daily.packsBought += 1;
        _splitRevenue(msg.value);
        emit EnergyPackBought(farmId, daily.dayIndex, daily.packsBought);
    }

    function placeGenesis(uint256 farmId, uint256 tokenId, uint256 slotIndex) external onlyFarmOwner(farmId) {
        if (genesisNFT.ownerOf(tokenId) != msg.sender) revert NotFarmOwner();
        _placeAsset(farmId, tokenId, slotIndex, AssetType.Genesis);
    }

    function placeOffspring(uint256 farmId, uint256 tokenId, uint256 slotIndex) external onlyFarmOwner(farmId) {
        if (offspringNFT.ownerOf(tokenId) != msg.sender) revert NotFarmOwner();
        _placeAsset(farmId, tokenId, slotIndex, AssetType.Offspring);
    }

    function placeIncubator(uint256 farmId, uint256 tokenId, uint256 slotIndex) external onlyFarmOwner(farmId) {
        if (incubatorNFT.ownerOf(tokenId) != msg.sender) revert NotFarmOwner();
        _placeAsset(farmId, tokenId, slotIndex, AssetType.Incubator);
    }

    function removeFromSlot(uint256 farmId, uint256 slotIndex) external onlyFarmOwner(farmId) {
        if (slotIndex >= farmCapacity(farmId)) revert SlotOutOfRange();
        SlotAsset memory slot = _farmSlots[farmId][slotIndex];
        if (slot.assetType == AssetType.None) revert SlotEmpty();

        if (slot.assetType == AssetType.Incubator) {
            _settleIncubator(slot.tokenId);
            if (incubatorProcesses[slot.tokenId].active) revert ActiveIncubatorProcess();
        }

        delete _farmSlots[farmId][slotIndex];
        delete assetLocations[_assetKey(slot.assetType, slot.tokenId)];

        FarmState storage farmState = _farmStates[farmId];
        if (slot.assetType == AssetType.Genesis) {
            farmState.genesisInSlots -= 1;
        } else if (slot.assetType == AssetType.Offspring) {
            farmState.offspringInSlots -= 1;
        } else if (slot.assetType == AssetType.Incubator) {
            farmState.incubatorsInSlots -= 1;
        }

        emit AssetRemoved(farmId, slotIndex, slot.assetType, slot.tokenId);
    }

    function collectEggs(uint256 farmId) external onlyFarmOwner(farmId) {
        uint256 seasonId = currentSeasonId();
        if (seasonId == 0) revert SeasonNotStarted();

        (, uint8 turnIndex, uint256 turnKey, ) = _turnData(block.timestamp);
        if (eggsCollectedForTurn[farmId][turnKey]) revert AlreadyCollectedTurn();

        _consumeEnergy(farmId, 1);
        DailyFarmState storage daily = _syncDaily(farmId);
        daily.collectedMask = daily.collectedMask | uint8(1 << (turnIndex - 1));
        eggsCollectedForTurn[farmId][turnKey] = true;

        uint256 eggsProduced = _farmStates[farmId].genesisInSlots * GENESIS_EGGS_PER_TURN;
        eggsProduced += _offspringEggsForFarm(farmId, seasonId);

        FarmState storage state = _farmStates[farmId];
        uint256 eggsBefore = state.eggs;
        uint256 eggsAfter = eggsBefore + eggsProduced;
        uint256 eggsAdded;

        if (eggsBefore >= EGG_CAPACITY) {
            eggsAdded = 0;
            state.eggs = EGG_CAPACITY;
        } else if (eggsAfter > EGG_CAPACITY) {
            eggsAdded = EGG_CAPACITY - eggsBefore;
            state.eggs = EGG_CAPACITY;
        } else {
            eggsAdded = eggsProduced;
            state.eggs = eggsAfter;
        }

        emit EggsCollected(farmId, daily.dayIndex, turnIndex, eggsAdded);
    }

    function startIncubation(uint256 farmId, uint256 incubatorId) external onlyFarmOwner(farmId) {
        uint256 seasonId = currentSeasonId();
        if (seasonId == 0) revert SeasonNotStarted();

        _requireIncubatorInFarm(farmId, incubatorId);
        _settleIncubator(incubatorId);

        if (incubatorProcesses[incubatorId].active) revert IncubatorBusy();
        if (_farmStates[farmId].eggs < INCUBATION_EGG_COST) revert NotEnoughEggs();

        _consumeEnergy(farmId, 1);
        _farmStates[farmId].eggs -= INCUBATION_EGG_COST;

        uint256 readyTimestamp = block.timestamp + INCUBATOR_ACTION_DURATION;
        incubatorProcesses[incubatorId] = IncubatorProcess({
            processType: ProcessType.Incubation,
            farmId: farmId,
            readyTimestamp: readyTimestamp,
            seasonId: seasonId,
            active: true
        });

        emit IncubationStarted(farmId, incubatorId, readyTimestamp, seasonId);
    }

    function startCooking(uint256 farmId, uint256 incubatorId) external onlyFarmOwner(farmId) {
        uint256 seasonId = currentSeasonId();
        if (seasonId == 0) revert SeasonNotStarted();

        _requireIncubatorInFarm(farmId, incubatorId);
        _settleIncubator(incubatorId);

        if (incubatorProcesses[incubatorId].active) revert IncubatorBusy();
        if (_farmStates[farmId].chickenItems < 1) revert NotEnoughChickenItems();

        _consumeEnergy(farmId, 1);
        _farmStates[farmId].chickenItems -= 1;

        uint256 readyTimestamp = block.timestamp + INCUBATOR_ACTION_DURATION;
        incubatorProcesses[incubatorId] = IncubatorProcess({
            processType: ProcessType.Cooking,
            farmId: farmId,
            readyTimestamp: readyTimestamp,
            seasonId: seasonId,
            active: true
        });

        emit CookingStarted(farmId, incubatorId, readyTimestamp, seasonId);
    }

    function settleIncubator(uint256 incubatorId) external {
        _settleIncubator(incubatorId);
    }

    function settleIncubators(uint256[] calldata incubatorIds) external {
        for (uint256 i = 0; i < incubatorIds.length; i++) {
            _settleIncubator(incubatorIds[i]);
        }
    }

    function breed(
        uint256 farmId,
        uint256 genesisA,
        uint256 genesisB
    ) external onlyFarmOwner(farmId) returns (uint256 offspringId) {
        uint256 seasonId = currentSeasonId();
        if (seasonId == 0) revert SeasonNotStarted();
        if (genesisA == genesisB) revert InvalidLeaderboard();

        _requireGenesisInFarm(farmId, genesisA);
        _requireGenesisInFarm(farmId, genesisB);

        if (genesisNFT.ownerOf(genesisA) != msg.sender || genesisNFT.ownerOf(genesisB) != msg.sender) {
            revert NotFarmOwner();
        }

        if (genesisNFT.offspringCount(genesisA) >= 3 || genesisNFT.offspringCount(genesisB) >= 3) {
            revert BreedingLimitReached();
        }

        if (genesisNFT.breedingCooldownUntil(genesisA) > block.timestamp) revert BreedingCooldown();
        if (genesisNFT.breedingCooldownUntil(genesisB) > block.timestamp) revert BreedingCooldown();

        _consumeEnergy(farmId, 2);

        uint64 nextCooldown = uint64(block.timestamp + BREEDING_COOLDOWN_DURATION);
        genesisNFT.useForBreeding(genesisA, nextCooldown);
        genesisNFT.useForBreeding(genesisB, nextCooldown);

        uint8 rarity = _rollRarity(farmId, genesisA, genesisB, seasonId);
        offspringId = offspringNFT.mintOffspring(msg.sender, OffspringChickenNFT.Rarity(rarity), seasonId);

        emit Bred(msg.sender, offspringId, rarity, farmId, genesisA, genesisB);
    }

    function finalizeSeason(uint256 seasonId, address[] calldata top100Addresses) external onlyOwner {
        if (seasonId == 0) revert InvalidSeason();
        if (seasonFinalized[seasonId]) revert SeasonAlreadyFinalized();
        if (top100Addresses.length == 0 || top100Addresses.length > 100) revert InvalidLeaderboard();
        if (seasonGenesisTimestamp == 0) revert SeasonNotStarted();
        if (seasonId >= currentSeasonId()) revert SeasonNotEnded();
        if (block.timestamp < seasonEndTimestamp(seasonId)) revert SeasonNotEnded();

        uint256 prevPoints = type(uint256).max;
        uint256 prevCooked = type(uint256).max;

        for (uint256 i = 0; i < top100Addresses.length; i++) {
            address wallet = top100Addresses[i];
            if (wallet == address(0)) revert InvalidLeaderboard();

            for (uint256 j = 0; j < i; j++) {
                if (top100Addresses[j] == wallet) revert InvalidLeaderboard();
            }

            uint256 points = _walletPoints[seasonId][wallet];
            uint256 cooked = _walletCooked[seasonId][wallet];

            if (i > 0) {
                bool validOrder =
                    (prevPoints > points) ||
                    (prevPoints == points && prevCooked >= cooked);
                if (!validOrder) revert InvalidLeaderboard();
            }

            prevPoints = points;
            prevCooked = cooked;

            uint256 rank = i + 1;
            uint256 rewardWeight = rewardWeightForRank(rank);
            seasonRewardWeight[seasonId][wallet] = rewardWeight;
            seasonRankByWallet[seasonId][wallet] = rank;
            seasonTopAddress[seasonId][rank] = wallet;
        }

        seasonTopCount[seasonId] = top100Addresses.length;
        seasonFinalized[seasonId] = true;

        uint256 distributable = (poolBalance * TOP_DISTRIBUTION_BPS) / TOTAL_BPS;
        poolBalance -= distributable;
        seasonDistributable[seasonId] = distributable;
        seasonUnclaimed[seasonId] = distributable;

        emit SeasonFinalized(seasonId);
    }

    function claimReward(uint256 seasonId) external nonReentrant {
        if (!seasonFinalized[seasonId]) revert ProcessNotClaimable();
        if (seasonClaimed[seasonId][msg.sender]) revert AlreadyClaimed();

        uint256 rewardWeight = seasonRewardWeight[seasonId][msg.sender];
        if (rewardWeight == 0) revert NotEligible();

        seasonClaimed[seasonId][msg.sender] = true;

        uint256 amount = (seasonDistributable[seasonId] * rewardWeight) / TOP_DISTRIBUTION_BPS;
        if (amount > seasonUnclaimed[seasonId]) {
            amount = seasonUnclaimed[seasonId];
        }
        seasonUnclaimed[seasonId] -= amount;

        payable(msg.sender).sendValue(amount);
        emit RewardClaimed(msg.sender, seasonId, amount);
    }

    function depositPool() external payable onlyOwner {
        if (msg.value == 0) revert InvalidPayment();
        poolBalance += msg.value;
        emit PoolDeposited(msg.sender, msg.value);
    }

    function withdrawPool(uint256 amount) external onlyOwner nonReentrant {
        if (amount > poolBalance) revert InvalidOwnerAction();
        poolBalance -= amount;
        payable(msg.sender).sendValue(amount);
        emit PoolWithdrawn(msg.sender, amount);
    }

    function depositTreasury() external payable onlyOwner {
        if (msg.value == 0) revert InvalidPayment();
        treasuryBalance += msg.value;
        emit TreasuryDeposited(msg.sender, msg.value);
    }

    function withdrawTreasury(uint256 amount) external onlyOwner nonReentrant {
        if (amount > treasuryBalance) revert InvalidOwnerAction();
        treasuryBalance -= amount;
        payable(msg.sender).sendValue(amount);
        emit TreasuryWithdrawn(msg.sender, amount);
    }

    function getGenesisMintPrice() public view returns (uint256) {
        return GENESIS_BASE_PRICE + (GENESIS_K_PRICE * genesisNFT.totalSupply());
    }

    function getExpansionPrice(uint256 expansionsAlreadyOwned) public pure returns (uint256) {
        uint256 multiplier = FixedPointMath.powWadUp(EXPANSION_MULTIPLIER_WAD, expansionsAlreadyOwned);
        return FixedPointMath.mulWadUp(EXPANSION_BASE_PRICE, multiplier);
    }

    function farmCapacity(uint256 farmId) public view returns (uint256) {
        return SLOT_BASE_CAPACITY + (farmNFT.expansions(farmId) * SLOT_EXPANSION_STEP);
    }

    function getSlot(uint256 farmId, uint256 slotIndex) external view returns (AssetType assetType, uint256 tokenId) {
        SlotAsset storage slot = _farmSlots[farmId][slotIndex];
        return (slot.assetType, slot.tokenId);
    }

    function getFarmSlots(
        uint256 farmId
    ) external view returns (AssetType[] memory assetTypes, uint256[] memory tokenIds) {
        uint256 capacity = farmCapacity(farmId);
        assetTypes = new AssetType[](capacity);
        tokenIds = new uint256[](capacity);

        for (uint256 i = 0; i < capacity; i++) {
            SlotAsset storage slot = _farmSlots[farmId][i];
            assetTypes[i] = slot.assetType;
            tokenIds[i] = slot.tokenId;
        }
    }

    function getFarmOverview(uint256 farmId) external view returns (FarmOverview memory overview) {
        FarmState storage fs = _farmStates[farmId];
        (, uint8 packsBought, uint16 energySpent, uint8 collectedMask) = _dailySnapshot(farmId);
        uint256 totalEnergy = BASE_DAILY_ENERGY + fs.genesisInSlots + (uint256(packsBought) * ENERGY_PACK_BONUS);
        uint256 availableEnergyNow = totalEnergy > energySpent ? totalEnergy - energySpent : 0;

        overview = FarmOverview({
            eggs: fs.eggs,
            chickenItems: fs.chickenItems,
            capacity: farmCapacity(farmId),
            expansions: farmNFT.expansions(farmId),
            genesisInSlots: fs.genesisInSlots,
            offspringInSlots: fs.offspringInSlots,
            incubatorsInSlots: fs.incubatorsInSlots,
            availableEnergy: availableEnergyNow,
            totalEnergy: totalEnergy,
            energySpent: energySpent,
            packsBought: packsBought,
            collectedMask: collectedMask
        });
    }

    function availableEnergy(uint256 farmId) external view returns (uint256) {
        (, uint8 packsBought, uint16 energySpent, ) = _dailySnapshot(farmId);
        uint256 totalEnergy = BASE_DAILY_ENERGY + _farmStates[farmId].genesisInSlots + (uint256(packsBought) * ENERGY_PACK_BONUS);
        if (energySpent >= totalEnergy) {
            return 0;
        }
        return totalEnergy - energySpent;
    }

    function walletPoints(uint256 seasonId, address wallet) external view returns (uint256) {
        return _walletPoints[seasonId][wallet];
    }

    function walletCookedCount(uint256 seasonId, address wallet) external view returns (uint256) {
        return _walletCooked[seasonId][wallet];
    }

    function walletRank(uint256 seasonId, address wallet) external view returns (uint256) {
        return seasonRankByWallet[seasonId][wallet];
    }

    function getSeasonParticipants(uint256 seasonId) external view returns (address[] memory) {
        return _seasonParticipants[seasonId];
    }

    function getTurnInfo()
        external
        view
        returns (uint256 dayIndex, uint8 turnIndex, uint256 turnKey, uint256 nextTurnTimestamp)
    {
        return _turnData(block.timestamp);
    }

    function getSeasonInfo()
        external
        view
        returns (uint256 seasonId, uint256 seasonDay, uint256 seasonEnd, uint256 secondsToSeasonEnd)
    {
        seasonId = currentSeasonId();
        if (seasonId == 0) {
            return (0, 0, 0, 0);
        }

        uint256 seasonStart = seasonStartTimestamp(seasonId);
        seasonDay = ((block.timestamp - seasonStart) / GAME_DAY_DURATION) + 1;
        if (seasonDay > SEASON_GAME_DAYS) {
            seasonDay = SEASON_GAME_DAYS;
        }

        seasonEnd = seasonEndTimestamp(seasonId);
        secondsToSeasonEnd = seasonEnd > block.timestamp ? seasonEnd - block.timestamp : 0;
    }

    function currentSeasonId() public view returns (uint256) {
        if (seasonGenesisTimestamp == 0 || block.timestamp < seasonGenesisTimestamp) {
            return 0;
        }
        return ((block.timestamp - seasonGenesisTimestamp) / SEASON_DURATION) + 1;
    }

    function seasonStartTimestamp(uint256 seasonId) public view returns (uint256) {
        if (seasonGenesisTimestamp == 0 || seasonId == 0) revert InvalidSeason();
        return seasonGenesisTimestamp + ((seasonId - 1) * SEASON_DURATION);
    }

    function seasonEndTimestamp(uint256 seasonId) public view returns (uint256) {
        return seasonStartTimestamp(seasonId) + SEASON_DURATION;
    }

    function estimateCurrentRewardForRank(uint256 rank) external view returns (uint256) {
        uint256 rewardWeight = rewardWeightForRank(rank);
        if (rewardWeight == 0) {
            return 0;
        }
        uint256 distributableNow = (poolBalance * TOP_DISTRIBUTION_BPS) / TOTAL_BPS;
        return (distributableNow * rewardWeight) / TOP_DISTRIBUTION_BPS;
    }

    function rewardWeightForRank(uint256 rank) public pure returns (uint256) {
        if (rank == 0 || rank > 100) return 0;
        if (rank == 1) return 1500;
        if (rank == 2) return 1000;
        if (rank == 3) return 700;
        if (rank <= 10) return 300;
        if (rank <= 25) return 100;
        if (rank <= 50) return 50;
        return 20;
    }

    function _placeAsset(uint256 farmId, uint256 tokenId, uint256 slotIndex, AssetType assetType) internal {
        uint256 capacity = farmCapacity(farmId);
        if (slotIndex >= capacity) revert SlotOutOfRange();

        SlotAsset storage slot = _farmSlots[farmId][slotIndex];
        if (slot.assetType != AssetType.None) revert SlotOccupied();

        bytes32 key = _assetKey(assetType, tokenId);
        if (assetLocations[key].placed) revert AssetAlreadyPlaced();

        slot.assetType = assetType;
        slot.tokenId = tokenId;
        assetLocations[key] = AssetLocation({farmId: farmId, slotIndex: slotIndex, placed: true});

        FarmState storage farmState = _farmStates[farmId];
        if (assetType == AssetType.Genesis) {
            farmState.genesisInSlots += 1;
        } else if (assetType == AssetType.Offspring) {
            farmState.offspringInSlots += 1;
        } else if (assetType == AssetType.Incubator) {
            farmState.incubatorsInSlots += 1;
        }

        emit AssetPlaced(farmId, slotIndex, assetType, tokenId);
    }

    function _requireIncubatorInFarm(uint256 farmId, uint256 incubatorId) internal view {
        AssetLocation storage location = assetLocations[_assetKey(AssetType.Incubator, incubatorId)];
        if (!location.placed || location.farmId != farmId) revert AssetNotInFarm();
    }

    function _requireGenesisInFarm(uint256 farmId, uint256 genesisId) internal view {
        AssetLocation storage location = assetLocations[_assetKey(AssetType.Genesis, genesisId)];
        if (!location.placed || location.farmId != farmId) revert AssetNotInFarm();
    }

    function _consumeEnergy(uint256 farmId, uint256 amount) internal {
        DailyFarmState storage daily = _syncDaily(farmId);

        uint256 totalEnergy = BASE_DAILY_ENERGY +
            _farmStates[farmId].genesisInSlots +
            (uint256(daily.packsBought) * ENERGY_PACK_BONUS);

        if (uint256(daily.energySpent) + amount > totalEnergy) revert InsufficientEnergy();

        daily.energySpent += uint16(amount);
    }

    function _syncDaily(uint256 farmId) internal returns (DailyFarmState storage daily) {
        daily = _farmDaily[farmId];
        uint64 today = uint64(block.timestamp / GAME_DAY_DURATION);
        (, , uint256 turnKey, ) = _turnData(block.timestamp);
        uint64 currentTurnKey = uint64(turnKey);

        if (daily.dayIndex != today) {
            daily.dayIndex = today;
            daily.energyTurnKey = currentTurnKey;
            daily.packsBought = 0;
            daily.energySpent = 0;
            daily.collectedMask = 0;
            return daily;
        }

        if (daily.energyTurnKey != currentTurnKey) {
            daily.energyTurnKey = currentTurnKey;
            daily.energySpent = 0;
        }
    }

    function _dailySnapshot(uint256 farmId) internal view returns (uint64 dayIndex, uint8 packsBought, uint16 energySpent, uint8 collectedMask) {
        DailyFarmState storage daily = _farmDaily[farmId];
        uint64 today = uint64(block.timestamp / GAME_DAY_DURATION);

        if (daily.dayIndex == today) {
            (, , uint256 turnKey, ) = _turnData(block.timestamp);
            uint16 currentTurnEnergySpent = daily.energyTurnKey == uint64(turnKey) ? daily.energySpent : 0;
            return (daily.dayIndex, daily.packsBought, currentTurnEnergySpent, daily.collectedMask);
        }

        return (today, 0, 0, 0);
    }

    function _splitRevenue(uint256 amount) internal {
        uint256 poolShare = (amount * POOL_BPS) / TOTAL_BPS;
        uint256 treasuryShare = amount - poolShare;

        poolBalance += poolShare;
        treasuryBalance += treasuryShare;
    }

    function _settleIncubator(uint256 incubatorId) internal {
        IncubatorProcess storage process = incubatorProcesses[incubatorId];
        if (!process.active) {
            return;
        }

        uint256 seasonId = currentSeasonId();
        if (seasonId == 0 || seasonId > process.seasonId) {
            process.active = false;

            if (process.processType == ProcessType.Incubation) {
                emit IncubationCancelled(process.farmId, incubatorId, process.seasonId);
            } else if (process.processType == ProcessType.Cooking) {
                emit CookingCancelled(process.farmId, incubatorId, process.seasonId);
            }
            return;
        }

        if (block.timestamp < process.readyTimestamp) {
            return;
        }

        process.active = false;

        if (process.processType == ProcessType.Incubation) {
            _farmStates[process.farmId].chickenItems += 1;
            emit IncubationCompleted(process.farmId, incubatorId, 1, process.seasonId);
            return;
        }

        if (process.processType == ProcessType.Cooking) {
            address wallet = farmNFT.ownerOf(process.farmId);
            uint256 multiplierWad = _efficiencyMultiplierWad(process.farmId);
            uint256 pointsAdded = (COOKING_BASE_POINTS * multiplierWad) / WAD;

            _walletPoints[process.seasonId][wallet] += pointsAdded;
            _walletCooked[process.seasonId][wallet] += 1;

            if (!_seasonParticipantSeen[process.seasonId][wallet]) {
                _seasonParticipantSeen[process.seasonId][wallet] = true;
                _seasonParticipants[process.seasonId].push(wallet);
            }

            emit CookingCompleted(process.farmId, incubatorId, wallet, pointsAdded, multiplierWad, process.seasonId);
            emit PointsAdded(wallet, process.seasonId, pointsAdded, multiplierWad);
        }
    }

    function _offspringEggsForFarm(uint256 farmId, uint256 seasonId) internal view returns (uint256 totalEggs) {
        uint256 capacity = farmCapacity(farmId);

        for (uint256 i = 0; i < capacity; i++) {
            SlotAsset storage slot = _farmSlots[farmId][i];
            if (slot.assetType != AssetType.Offspring) {
                continue;
            }

            uint256 tokenId = slot.tokenId;
            uint256 birthSeason = offspringNFT.birthSeason(tokenId);
            uint256 seasonDelta = seasonId > birthSeason ? seasonId - birthSeason : 0;
            uint256 decayWad = seasonDelta >= 60 ? 0 : (WAD >> seasonDelta);

            if (decayWad == 0) {
                continue;
            }

            uint256 rarityMultiplier = _rarityMultiplierWad(uint8(offspringNFT.rarityOf(tokenId)));
            uint256 eggsWad = OFFSPRING_EGGS_PER_TURN * WAD;
            uint256 output = FixedPointMath.mulWadDown(FixedPointMath.mulWadDown(eggsWad, rarityMultiplier), decayWad) / WAD;

            totalEggs += output;
        }
    }

    function _efficiencyMultiplierWad(uint256 farmId) internal view returns (uint256 multiplierWad) {
        multiplierWad = WAD;
        (, uint8 packsBought, uint16 energySpent, uint8 collectedMask) = _dailySnapshot(farmId);

        uint8 fullCollectedMask = uint8((1 << TURNS_PER_DAY) - 1);
        if (collectedMask == fullCollectedMask) {
            multiplierWad += 5e16;
        }

        uint256 totalEnergy = BASE_DAILY_ENERGY +
            _farmStates[farmId].genesisInSlots +
            (uint256(packsBought) * ENERGY_PACK_BONUS);

        if (totalEnergy > 0 && uint256(energySpent) * 100 >= totalEnergy * 80) {
            multiplierWad += 5e16;
        }

        if (multiplierWad > 15e17) {
            multiplierWad = 15e17;
        }
    }

    function _rarityMultiplierWad(uint8 rarity) internal pure returns (uint256) {
        if (rarity == 1) {
            return 115e16;
        }
        if (rarity == 2) {
            return 13e17;
        }
        return WAD;
    }

    function _rollRarity(
        uint256 farmId,
        uint256 genesisA,
        uint256 genesisB,
        uint256 seasonId
    ) internal returns (uint8) {
        bytes32 randomHash = keccak256(
            abi.encodePacked(
                block.prevrandao,
                block.timestamp,
                msg.sender,
                farmId,
                genesisA,
                genesisB,
                seasonId,
                rngNonce
            )
        );

        rngNonce += 1;
        uint256 roll = uint256(randomHash) % 100;

        if (roll < 70) {
            return 0;
        }
        if (roll < 95) {
            return 1;
        }
        return 2;
    }

    function _turnData(
        uint256 timestamp
    ) internal pure returns (uint256 dayIndex, uint8 turnIndex, uint256 turnKey, uint256 nextTurnTimestamp) {
        dayIndex = timestamp / GAME_DAY_DURATION;
        uint256 secondsInDay = timestamp % GAME_DAY_DURATION;

        uint256 turnZeroIndexed = secondsInDay / TURN_DURATION;
        turnIndex = uint8(turnZeroIndexed + 1);
        turnKey = (dayIndex * TURNS_PER_DAY) + turnZeroIndexed;

        uint256 secondsIntoTurn = secondsInDay % TURN_DURATION;
        nextTurnTimestamp = timestamp + (TURN_DURATION - secondsIntoTurn);
    }

    function _assetKey(AssetType assetType, uint256 tokenId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(assetType, tokenId));
    }

    receive() external payable {
        revert InvalidOwnerAction();
    }
}
