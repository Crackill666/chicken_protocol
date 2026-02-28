// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract GenesisChickenNFT is ERC721Enumerable, Ownable {
    uint256 public nextTokenId = 1;
    address public game;

    mapping(uint256 => uint8) public offspringCount;
    mapping(uint256 => uint64) public breedingCooldownUntil;

    error NotGame();
    error MaxOffspringReached();

    constructor(address initialOwner) ERC721("Chicken Protocol Genesis", "CPGEN") {
        transferOwnership(initialOwner);
    }

    modifier onlyGame() {
        if (msg.sender != game) revert NotGame();
        _;
    }

    function setGame(address gameAddress) external onlyOwner {
        game = gameAddress;
    }

    function mintGenesis(address to) external onlyGame returns (uint256 tokenId) {
        tokenId = nextTokenId;
        nextTokenId += 1;
        _safeMint(to, tokenId);
    }

    function useForBreeding(uint256 tokenId, uint64 nextCooldownTimestamp) external onlyGame {
        uint8 currentCount = offspringCount[tokenId];
        if (currentCount >= 3) revert MaxOffspringReached();
        offspringCount[tokenId] = currentCount + 1;
        breedingCooldownUntil[tokenId] = nextCooldownTimestamp;
    }
}