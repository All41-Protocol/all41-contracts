// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ICToken
 * @author Shmoj
 *
 * @dev A simplified interface for Compound's cToken
 */
interface ICToken is IERC20 {
    function exchangeRateStored() external view returns (uint);
    function accrueInterest() external returns (uint);
    function mint(uint mintAmount) external returns (uint);
    function redeemUnderlying(uint redeemAmount) external returns (uint);
    function redeem(uint redeemTokens) external returns (uint);
    function comptroller() external view returns (address);
}