// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract OffspringChickenNFT is ERC721Enumerable, Ownable {
    enum Rarity {
        Common,
        Rare,
        Epic
    }

    uint256 public nextTokenId = 1;
    address public game;

    mapping(uint256 => Rarity) public rarityOf;
    mapping(uint256 => uint256) public birthSeason;

    error NotGame();
    error Soulbound();

    constructor(address initialOwner) ERC721("Chicken Protocol Offspring", "CPOFF") {
        transferOwnership(initialOwner);
    }

    modifier onlyGame() {
        if (msg.sender != game) revert NotGame();
        _;
    }

    function setGame(address gameAddress) external onlyOwner {
        game = gameAddress;
    }

    function mintOffspring(
        address to,
        Rarity rarity,
        uint256 seasonId
    ) external onlyGame returns (uint256 tokenId) {
        tokenId = nextTokenId;
        nextTokenId += 1;
        rarityOf[tokenId] = rarity;
        birthSeason[tokenId] = seasonId;
        _safeMint(to, tokenId);
    }

    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert Soulbound();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override {
        if (from != address(0) && to != address(0)) {
            revert Soulbound();
        }
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }
}
