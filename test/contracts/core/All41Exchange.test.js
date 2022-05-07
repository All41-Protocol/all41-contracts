const { expect } = require('chai')
const { BigNumber } = require('ethers')
const { ethers } = require('hardhat')

describe('core/All41Exchange', () => {
	let TestERC20
	let TestCDai
	let InterestManagerCompound
	let TestComptroller
	let All41Exchange

	const tenPow18 = BigNumber.from('10').pow(BigNumber.from('18'))

	let userAccount
	let userAccount2
	let adminAccount
	let interestReceiverAccount
	const oneAddress = '0x0000000000000000000000000000000000000001'

	let dai
	let comp
	let cDai
	let interestManagerCompound
	let comptroller
	let all41Exchange

	before(async () => {
		const accounts = await ethers.getSigners()
		userAccount = accounts[0] // This is also address that is deploying all these contracts and calling the methods (msg.sender) in the tests if caller is not specified using connect()
		userAccount2 = accounts[1]
    adminAccount = accounts[2]
		interestReceiverAccount = accounts[3]

		TestERC20 = await ethers.getContractFactory('TestERC20')
		TestCDai = await ethers.getContractFactory('TestCDai')
		InterestManagerCompound = await ethers.getContractFactory('InterestManagerCompound')
		TestComptroller = await ethers.getContractFactory('TestComptroller')
		All41Exchange = await ethers.getContractFactory('All41Exchange')
	})

	beforeEach(async () => {
		dai = await TestERC20.deploy('DAI', 'DAI')
		await dai.deployed()

		comp = await TestERC20.deploy('COMP', 'COMP')
		await comp.deployed()

		comptroller = await TestComptroller.deploy()
		await comptroller.deployed()

		cDai = await TestCDai.deploy(dai.address, comp.address, comptroller.address)
		await cDai.deployed()
    // Starting exchange rate
		await cDai.setExchangeRate(tenPow18.mul(BigNumber.from('1')))

		interestManagerCompound = await InterestManagerCompound.deploy()
		await interestManagerCompound.deployed()

		all41Exchange = await All41Exchange.deploy()
		await all41Exchange.deployed()

		await interestManagerCompound
			.connect(adminAccount)
      // initialize(address owner, address dai, address cDai, address comp, address compRecipient)
			.initialize(all41Exchange.address, dai.address, cDai.address, comp.address, oneAddress)

    const tradingFeeRate = BigNumber.from('0')

		await all41Exchange
			.connect(adminAccount)
      // initialize(address owner, address interestManager, address dai, uint tradingFeeRate)
			.initialize(
				adminAccount.address,
				interestManagerCompound.address,
				dai.address,
        tradingFeeRate
			)
	})

	it('admin is owner of deployed All41Exchange contract', async () => {
		expect(adminAccount.address).to.be.equal(await all41Exchange.getOwner())
	})

	it('fail depositToWalletPool - user did not give enough allowance to All41Exchange contract', async () => {
		const amount = BigNumber.from('50').mul(tenPow18)
		await dai.mint(userAccount.address, amount)

		await expect(
			all41Exchange.depositToWalletPool(userAccount.address, amount)
		).to.be.revertedWith('insufficient-allowance')
	})

	it('fail depositToWalletPool - user does not have enough DAI', async () => {
		const amount = BigNumber.from('50').mul(tenPow18) // Amount of DAI user is trying to deposit
    // Give userAccount 1 less DAI than amount they are trying to deposit
		await dai.mint(userAccount.address, amount.sub(BigNumber.from('1')))

    // User approves all41Exchange to transfer amount of DAI
    await dai.approve(all41Exchange.address, amount)

		await expect(
			all41Exchange.depositToWalletPool(userAccount.address, amount)
		).to.be.revertedWith('ERC20: transfer amount exceeds balance')
	})

	it('fail withdrawWalletInterest not authorized', async () => {
    // userAccount is trying to withdraw userAccount2's $
		await expect(all41Exchange.connect(userAccount).withdrawWalletInterest(userAccount2.address)).to.be.revertedWith('not-authorized')
	})

  it('fail withdrawAmount not authorized', async () => {
    // userAccount is trying to withdraw userAccount2's $
		await expect(all41Exchange.connect(userAccount).withdrawAmount(userAccount2.address, 50)).to.be.revertedWith('not-authorized')
	})

  it('no interest available to withdraw', async () => {
		expect((await all41Exchange.getInterestPayable(interestReceiverAccount.address)).eq(BigNumber.from('0'))).to.be.true
		// Do not get not-authorized error because msg.sender == wallet
    await all41Exchange.connect(interestReceiverAccount).withdrawWalletInterest(interestReceiverAccount.address)
		expect((await dai.balanceOf(interestReceiverAccount.address)).eq(BigNumber.from('0'))).to.be.true
	})

  it('no DAI available to withdraw', async () => {
    // Withdraw 1 DAI
    await all41Exchange.connect(interestReceiverAccount).withdrawAmount(interestReceiverAccount.address, 1)
		expect((await dai.balanceOf(interestReceiverAccount.address)).eq(BigNumber.from('0'))).to.be.true
	})

  // deposit some DAI, do not gain any interest. Try withdrawing it
  it('userAccount deposits and interestReceiverAccount withdraws it all', async () => {
    const amount = BigNumber.from('50').mul(tenPow18) // Amount of DAI user is trying to deposit
		await dai.mint(userAccount.address, amount)
    // User approves all41Exchange to transfer amount of DAI
    await dai.approve(all41Exchange.address, amount)
    // userAccount deposits 50 DAI into interestReceiverAccount wallet
    await all41Exchange.connect(userAccount).depositToWalletPool(interestReceiverAccount.address, amount)
    
    expect((await all41Exchange.getInterestPayable(interestReceiverAccount.address)).eq(BigNumber.from('0'))).to.be.true
    expect((await all41Exchange.getAmountInvested(interestReceiverAccount.address)).eq(amount)).to.be.true
    expect((await all41Exchange.getAmountInvestedWithInterest(interestReceiverAccount.address)).eq(amount)).to.be.true

    // They have not withdrawn yet, so they have no DAI
		expect((await dai.balanceOf(interestReceiverAccount.address)).eq(BigNumber.from('0'))).to.be.true
    await all41Exchange.connect(interestReceiverAccount).withdrawWalletInterest(interestReceiverAccount.address)
    // They gained no interest yet, so they withdrew nothing
		expect((await dai.balanceOf(interestReceiverAccount.address)).eq(BigNumber.from('0'))).to.be.true
    await all41Exchange.connect(interestReceiverAccount).withdrawAmount(interestReceiverAccount.address, amount)
    // They withdrew all DAI deposited by userAccount
		expect((await dai.balanceOf(interestReceiverAccount.address)).eq(amount)).to.be.true
	
    expect((await all41Exchange.getInterestPayable(interestReceiverAccount.address)).eq(BigNumber.from('0'))).to.be.true
    expect((await all41Exchange.getAmountInvested(interestReceiverAccount.address)).eq(BigNumber.from('0'))).to.be.true
    expect((await all41Exchange.getAmountInvestedWithInterest(interestReceiverAccount.address)).eq(BigNumber.from('0'))).to.be.true
  })

  it('Deposit some DAI. Gain some interest. Try withdrawing some interest. Try withdrawing all interest, but not all DAI invested. Make sure interest comes out first', async () => {
    const amount = BigNumber.from('50').mul(tenPow18) // Amount of DAI user is trying to deposit
		await dai.mint(userAccount.address, amount)
    // User approves all41Exchange to transfer amount of DAI
    await dai.approve(all41Exchange.address, amount)
    // userAccount deposits 50 DAI into interestReceiverAccount wallet
    await all41Exchange.connect(userAccount).depositToWalletPool(interestReceiverAccount.address, amount)
  
    // This artificially adds interest to interestReceiverAccount wallet pool
    await cDai.setExchangeRate(tenPow18.mul(BigNumber.from('2')))

    let balanceOfReceiver = await dai.balanceOf(interestReceiverAccount.address)
    let interestPayable = await all41Exchange.getInterestPayable(interestReceiverAccount.address)
    let amountInvested = await all41Exchange.getAmountInvested(interestReceiverAccount.address)
    let amountInvestedWithInterest = await all41Exchange.getAmountInvestedWithInterest(interestReceiverAccount.address)

    expect((interestPayable).eq(amount)).to.be.true
    expect((amountInvested).eq(amount)).to.be.true
    expect((amountInvestedWithInterest).eq(tenPow18.mul(BigNumber.from('100')))).to.be.true

    await all41Exchange.connect(interestReceiverAccount).withdrawAmount(interestReceiverAccount.address, amount.div(BigNumber.from('2')))

    balanceOfReceiver = await dai.balanceOf(interestReceiverAccount.address)
    interestPayable = await all41Exchange.getInterestPayable(interestReceiverAccount.address)
    amountInvested = await all41Exchange.getAmountInvested(interestReceiverAccount.address)
    amountInvestedWithInterest = await all41Exchange.getAmountInvestedWithInterest(interestReceiverAccount.address)

    expect((balanceOfReceiver).eq(tenPow18.mul(BigNumber.from('25')))).to.be.true
    expect((interestPayable).eq(tenPow18.mul(BigNumber.from('25')))).to.be.true
    expect((amountInvested).eq(tenPow18.mul(BigNumber.from('50')))).to.be.true
    expect((amountInvestedWithInterest).eq(tenPow18.mul(BigNumber.from('75')))).to.be.true

    // Lets withdraw ALL 25 remaining interest and 10 of DAI deposited. This tests that interest is withdrawn first, then deposited DAI
    await all41Exchange.connect(interestReceiverAccount).withdrawAmount(interestReceiverAccount.address, tenPow18.mul(BigNumber.from('35')))

    balanceOfReceiver = await dai.balanceOf(interestReceiverAccount.address)
    interestPayable = await all41Exchange.getInterestPayable(interestReceiverAccount.address)
    amountInvested = await all41Exchange.getAmountInvested(interestReceiverAccount.address)
    amountInvestedWithInterest = await all41Exchange.getAmountInvestedWithInterest(interestReceiverAccount.address)

    expect((balanceOfReceiver).eq(tenPow18.mul(BigNumber.from('60')))).to.be.true
    expect((interestPayable).eq(tenPow18.mul(BigNumber.from('0')))).to.be.true
    expect((amountInvested).eq(tenPow18.mul(BigNumber.from('40')))).to.be.true
    expect((amountInvestedWithInterest).eq(tenPow18.mul(BigNumber.from('40')))).to.be.true
  })

  it('Set trading fee on contract creation correctly', async () => {
    const tradingFeeRate = await all41Exchange._tradingFeeRate()
    expect(tradingFeeRate).to.be.equal(BigNumber.from('0'))
  })

  it('Fail setTradingFeeRate - Only owner can set the trading fee', async () => {
    await expect(all41Exchange.connect(userAccount).setTradingFeeRate('0')).to.be.revertedWith('only-owner')
  })

  it('Successfully setTradingFeeRate as owner', async () => {
    let tradingFeeRate = await all41Exchange._tradingFeeRate()
    expect(tradingFeeRate).to.be.equal(BigNumber.from('0'))
    await all41Exchange.connect(adminAccount).setTradingFeeRate('200')
    tradingFeeRate = await all41Exchange._tradingFeeRate()
    expect(tradingFeeRate).to.be.equal(BigNumber.from('200'))
  })
})
