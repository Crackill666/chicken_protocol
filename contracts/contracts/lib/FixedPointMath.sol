// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library FixedPointMath {
    uint256 internal constant WAD = 1e18;

    function mulWadDown(uint256 x, uint256 y) internal pure returns (uint256) {
        return (x * y) / WAD;
    }

    function mulWadUp(uint256 x, uint256 y) internal pure returns (uint256) {
        return (x * y + (WAD - 1)) / WAD;
    }

    function powWadUp(uint256 baseWad, uint256 exponent) internal pure returns (uint256 result) {
        result = WAD;
        uint256 base = baseWad;
        uint256 exp = exponent;
        while (exp > 0) {
            if (exp & 1 == 1) {
                result = mulWadUp(result, base);
            }
            exp >>= 1;
            if (exp > 0) {
                base = mulWadUp(base, base);
            }
        }
    }
}
