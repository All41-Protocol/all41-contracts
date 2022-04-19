// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

/**
 * @title ICToken
 * @author Shmoji
 *
 * @dev A simplified interface for Compound's Comptroller
 */
interface IComptroller {
    function claimComp(address holder) external;
}