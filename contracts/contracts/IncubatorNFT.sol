// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract IncubatorNFT is ERC721Enumerable, Ownable {
    uint256 public nextTokenId = 1;
    address public game;

    error NotGame();

    constructor(address initialOwner) ERC721("Chicken Protocol Incubator", "CPINC") {
        transferOwnership(initialOwner);
    }

    modifier onlyGame() {
        if (msg.sender != game) revert NotGame();
        _;
    }

    function setGame(address gameAddress) external onlyOwner {
        game = gameAddress;
    }

    function mintIncubator(address to) external onlyGame returns (uint256 tokenId) {
        tokenId = nextTokenId;
        nextTokenId += 1;
        _safeMint(to, tokenId);
    }
}