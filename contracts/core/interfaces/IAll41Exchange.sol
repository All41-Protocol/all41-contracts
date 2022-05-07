// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

/**
 * @title IAll41Exchange
 * @author Shmoji
 */

 interface IAll41Exchange {
    function depositToWalletPool(address wallet, uint daiAmount) external;
    function withdrawWalletInterest(address wallet) external;
    function withdrawAmount(address wallet, uint daiAmount) external;
    function setTradingFeeRecipient(address tradingFeeRecipient) external;
    function setTradingFeeRate(uint tradingFee) external;
    function withdrawTradingFee() external;
    function getTradingFeePayable() external view returns (uint);
    function getInterestPayable(address wallet) external view returns (uint);
    function getAmountInvested(address wallet) external view returns (uint);
    function getAmountInvestedWithInterest(address wallet) external view returns (uint);
    function getcDaiOwned(address wallet) external view returns (uint);
 }