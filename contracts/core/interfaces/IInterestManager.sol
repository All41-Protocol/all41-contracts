// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

/**
 * @title IInterestManager
 * @author Shmoji
 */
interface IInterestManager {
    function invest(uint amount) external returns (uint);
    function redeem(address recipient, uint amount) external returns (uint);
    function redeemInvestmentToken(address recipient, uint amount) external returns (uint);
    function donateInterest(uint amount) external;
    function redeemDonated(uint amount) external;
    function accrueInterest() external;
    function underlyingToInvestmentToken(uint underlyingAmount) external view returns (uint);
    function investmentTokenToUnderlying(uint investmentTokenAmount) external view returns (uint);
}