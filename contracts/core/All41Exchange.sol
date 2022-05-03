// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "./interfaces/IAll41Exchange.sol";
import "./interfaces/IInterestManager.sol";
import "../util/Ownable.sol";
import "../util/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "hardhat/console.sol";

/**
 * @title All41Exchange
 * @author Shmoji
 *
 * Transfers Dai to a chosen wallet's interest pool and tracks amounts for each wallet here. Sits behind a proxy
 */
contract All41Exchange is IAll41Exchange, Initializable, Ownable {
    // Stored for every wallet that has any deposits.
    // Keeps track of the amount of invested dai in this wallet, and the amount of investment tokens (e.g. cDai).
    struct ExchangeInfo {
        // The amount of Dai collected
        uint dai;
        // The amount of "investment tokens", e.g. cDai
        uint cDai; 
    }

    // wallet address => ExchangeInfo. Stores ExchangeInfo structs for wallets
    mapping(address => ExchangeInfo) _walletsExchangeInfo;

    // InterestManager contract
    IInterestManager _interestManager;
    // Dai contract
    IERC20 _dai;

    event DepositedState(address wallet, uint dai, uint cDai, uint daiAmount);
    event WalletAmountRedeemed(address wallet, uint investmentToken, uint daiRedeemed);

    /**
    * Initializes the contract
    *
    * @param owner The owner of the contract
    * @param interestManager The address of the InterestManager
    * @param dai The address of Dai
    */
    function initialize(address owner,
                        address interestManager,
                        address dai) external initializer {
      require(interestManager != address(0) &&
              dai != address(0),
              "invalid-params");

      setOwnerInternal(owner); // Checks owner to be non-zero
      _interestManager = IInterestManager(interestManager);
      _dai = IERC20(dai);
    }

    /**
    * Deposit DAI to a wallet's interest pool
    *
    * @param wallet The wallet that will receive the DAI and start gaining interest on that DAI
    * @param daiAmount The amount of DAI being deposited
    */
    function depositToWalletPool(address wallet, uint daiAmount) external override {
        // _dai.allowance(owner, spender) returns the remaining number of tokens that spender will be allowed to spend on behalf of owner through transferFrom. This is zero by default. This value changes when approve or transferFrom are called.
        require(_dai.allowance(msg.sender, address(this)) >= daiAmount, "insufficient-allowance");
        // Moves daiAmount of DAI from sender to recipient using the allowance mechanism. daiAmount is then deducted from the caller’s allowance. Returns a boolean value indicating whether the operation succeeded. Emits a Transfer event.
        require(_dai.transferFrom(msg.sender, address(_interestManager), daiAmount), "dai-transfer");

        // Doing the Compound logic of investing into pool that generates interest
        _interestManager.accrueInterest();
        _interestManager.invest(daiAmount);

        // Doing the logic of keeping track of how much DAI is in each wallet and how much cDai they have. This info is stored in this contract.
        ExchangeInfo storage exchangeInfo = _walletsExchangeInfo[wallet];
        exchangeInfo.cDai = exchangeInfo.cDai + _interestManager.underlyingToInvestmentToken(daiAmount);
        exchangeInfo.dai = exchangeInfo.dai + daiAmount;

        emit DepositedState(wallet, exchangeInfo.dai, exchangeInfo.cDai, daiAmount);
    }

    /**
     * Withdraws available interest for a wallet
     *
     * @param wallet The wallet from which the generated interest is to be withdrawn
     */
    function withdrawWalletInterest(address wallet) external override {
        require(wallet == msg.sender, "not-authorized");

        _interestManager.accrueInterest();

        uint interestPayable = getInterestPayable(wallet);
        if(interestPayable == 0) {
            return;
        }

        ExchangeInfo storage exchangeInfo = _walletsExchangeInfo[wallet];
        // redeem sends DAI to wallet owner and returns amount of burned cDai
        exchangeInfo.cDai = exchangeInfo.cDai - _interestManager.redeem(msg.sender, interestPayable);

        emit WalletAmountRedeemed(wallet, exchangeInfo.cDai, interestPayable);
    }

    /**
     * Withdraws daiAmount of DAI stored in a wallet pool and sends to owner of wallet
     * Amount that can be withdrawn = DAI invested + DAI gained from interest
     *
     * @param wallet The wallet from which the DAI is to be withdrawn
     * @param daiAmount The amount of DAI to withdraw from this wallet's pool
     */
    function withdrawAmount(address wallet, uint daiAmount) external override {
        require(wallet == msg.sender, "not-authorized");

        _interestManager.accrueInterest();

        uint totalRedeemable = getAmountInvestedWithInterest(wallet);
        uint amountInvested = getAmountInvested(wallet);
        uint interestPayable = getInterestPayable(wallet);

        if(totalRedeemable == 0) {
            return;
        }

        require((totalRedeemable - daiAmount) >= 0, "daiAmount greater than totalRedeemable");

        // Take DAI from interest first, then if that is gone, take DAI from deposited DAI
        ExchangeInfo storage exchangeInfo = _walletsExchangeInfo[wallet];
        // redeem sends DAI to wallet owner and returns amount of burned cDai
        exchangeInfo.cDai = exchangeInfo.cDai - _interestManager.redeem(msg.sender, daiAmount);
        
        // If amountAfterInterest is negative or 0, then no need to change value of DAI deposited because redeeming interest was good enough
        // If positive, then some of DAI deposited will be redeemed too
        if (daiAmount > interestPayable) {
          uint amountAfterInterest = daiAmount - interestPayable;
          exchangeInfo.dai = exchangeInfo.dai - amountAfterInterest;
        }

        emit WalletAmountRedeemed(wallet, exchangeInfo.cDai, daiAmount);
    }

    /**
     * Returns the interest available to be paid out for a wallet
     *
     * @param wallet The wallet from which the generated interest is to be withdrawn
     *
     * @return The interest available to be paid out
     */
    function getInterestPayable(address wallet) public view override returns (uint) {
        ExchangeInfo storage exchangeInfo = _walletsExchangeInfo[wallet];
        return _interestManager.investmentTokenToUnderlying(exchangeInfo.cDai) - exchangeInfo.dai;
    }

    /**
     * Returns the DAI amount invested into a wallet (not including interest gained)
     *
     * @param wallet The wallet to get DAI amount from
     *
     * @return The DAI amount
     */
    function getAmountInvested(address wallet) public view override returns (uint) {
        ExchangeInfo storage exchangeInfo = _walletsExchangeInfo[wallet];
        return exchangeInfo.dai;
    }

    /**
     * Returns the total DAI amount invested into a wallet (including interest gained)
     *
     * @param wallet The wallet to get DAI amount from
     *
     * @return The DAI amount
     */
    function getAmountInvestedWithInterest(address wallet) public view override returns (uint) {
        uint interestPayable = getInterestPayable(wallet);
        ExchangeInfo storage exchangeInfo = _walletsExchangeInfo[wallet];
        return interestPayable + exchangeInfo.dai;
    }

    /**
     * Returns the cDai amount owned by a wallet
     *
     * @param wallet The wallet to get cDai amount from
     *
     * @return The cDai amount
     */
    function getcDaiOwned(address wallet) public view override returns (uint) {
        ExchangeInfo storage exchangeInfo = _walletsExchangeInfo[wallet];
        return exchangeInfo.cDai;
    }
}