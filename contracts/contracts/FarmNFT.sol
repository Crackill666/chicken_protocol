// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FarmNFT is ERC721Enumerable, Ownable {
    uint256 public nextTokenId = 1;
    address public game;

    mapping(uint256 => uint256) public expansions;

    error NotGame();

    constructor(address initialOwner) ERC721("Chicken Protocol Farm", "CPFARM") {
        transferOwnership(initialOwner);
    }

    modifier onlyGame() {
        if (msg.sender != game) revert NotGame();
        _;
    }

    function setGame(address gameAddress) external onlyOwner {
        game = gameAddress;
    }

    function mintFarm(address to) external onlyGame returns (uint256 tokenId) {
        tokenId = nextTokenId;
        nextTokenId += 1;
        _safeMint(to, tokenId);
    }

    function addExpansion(uint256 farmId) external onlyGame {
        expansions[farmId] += 1;
    }
}
