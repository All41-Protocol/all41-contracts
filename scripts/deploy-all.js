const { run, ethers, artifacts } = require('hardhat')
const fs = require('fs')
const { BigNumber } = require('ethers')

const allDeploymentParams = {
	// mainnet: {
	// 	timelockDelay: '86400', // 24 hours
	// 	gasPrice: 130000000000,
  //  tradingFeeRate: BigNumber.from('200'), // 2%
  // },
	rinkeby: {
		timelockDelay: '1',
		gasPrice: 10000000000, // 10 gwei
    tradingFeeRate: BigNumber.from('200'), // 2%
    authorizer: '', // This is just my random wallet address
    multisig: '0x675c93B9B876CdB1759d3b0bF91cC95E30DC68c4',  // My Gnosis Safe address on rinkeby called test-safe
	},
	goerli: {
		timelockDelay: '1',
		gasPrice: 10000000000, // 10 gwei
    tradingFeeRate: BigNumber.from('200'), // 2%
    authorizer: '', // This is just my random wallet address
    multisig: '0x0Ec02540BfB4F8fa97B97FF0dd8671EBE8CBA2Db',  // My Gnosis Safe address on goerli called test-safe
	},
}

const allExternalContractAddresses = {
	rinkeby: {
    // These all come from Compound's faucets
    dai: '0x31F42841c2db5173425b5223809CF3A38FEde360',
    cDai: '0xbc689667C13FB2a04f09272753760E38a95B998C',
    comp: '0xf76D4a441E4ba86A923ce32B89AFF89dBccAA075',
  },
	goerli: {
    // This comes from Compound's faucets
    dai: '0xdc31Ee1784292379Fbb2964b3B9C4124D8F89C60',
    // These 2 come from me deploying them
    cDai: '0x5A705ea24b8E30Fa0b75D3aEf572a4eF2A64426E',
    comp: '0xD91f542DAEb69Fa1A81D20F30c3D52d5A3f8753E',
  },
}

let deploymentParams
let externalContractAdresses

// Many concepts here. I'll try to explain them step by step in comments
async function main() {

  const deployerAccount = (await ethers.getSigners())[0]
	const deployerAddress = deployerAccount.address
	console.log(`Deploying from ${deployerAddress}`)
	console.log(`deployerAccount.getGasPrice()`, await deployerAccount.getGasPrice())
  console.log("Account balance:", await deployerAccount.getBalance())

	await run('compile')  // Compiles all local contracts that need to be compiled
	console.log('Finished compiling')

  let networkName = (await ethers.provider.getNetwork()).name
	if (networkName === 'rinkeby') {
    console.log('Using rinkeby')
    deploymentParams = allDeploymentParams.rinkeby
    externalContractAdresses = allExternalContractAddresses.rinkeby
	} else if (networkName === 'ropsten') {
    console.log('Using ropsten')
    deploymentParams = allDeploymentParams.rinkeby
    externalContractAdresses = allExternalContractAddresses.rinkeby
	} else if (networkName === 'goerli') {
    console.log('Using goerli')
    deploymentParams = allDeploymentParams.goerli
    externalContractAdresses = allExternalContractAddresses.goerli
	} else if (networkName === 'mainnet') {
		console.log('Using Mainnet')
		deploymentParams = allDeploymentParams.mainnet
		externalContractAdresses = allExternalContractAddresses.mainnet
	} else {
		throw 'cannot deploy to network: ' + networkName
	}

  const STAGE = 4 // TODO: i guess change this # based on which stages you do or dont want to run

	let dsPauseProxyAddress
	if (STAGE <= 1) {
		console.log('1. Deploy Timelock')
		console.log('==============================================')
		const dsPause = await deployContract(
			'DSPause',
			deploymentParams.timelockDelay,
			deploymentParams.multisig // This value will be owner of the DSPause contract
		)
		dsPauseProxyAddress = await dsPause._proxy()
    console.log(`await dsPause._proxy() done`)
		saveDeployedAddress(networkName, 'dsPause', dsPause.address)
		saveDeployedABI(networkName, 'dsPause', artifacts.readArtifactSync('DSPause').abi)
		saveDeployedAddress(networkName, 'dsPauseProxy', dsPauseProxyAddress)
		saveDeployedABI(networkName, 'dsPauseProxy', artifacts.readArtifactSync('DSPauseProxy').abi)
		console.log('Deployed Timelock')
	} else {
		dsPauseProxyAddress = loadDeployedAddress(networkName, 'dsPauseProxy')
	}

  console.log('dsPauseProxyAddress==', dsPauseProxyAddress)

  let proxyAdminAddress
	if (STAGE <= 2) {
		console.log('2. Deploy ProxyAdmin')
		console.log('==============================================')
    // We set the owner of ProxyAdmin to the DSPauseProxy contract address
		proxyAdminAddress = (await deployContract('ProxyAdmin', dsPauseProxyAddress)).address
		saveDeployedAddress(networkName, 'proxyAdmin', proxyAdminAddress)
		saveDeployedABI(networkName, 'proxyAdmin', artifacts.readArtifactSync('ProxyAdmin').abi)
		console.log('Deployed ProxyAdmin')
	} else {
		proxyAdminAddress = loadDeployedAddress(networkName, 'proxyAdmin')
	}

  let interestManagerCompoundProxyAddress
	if (STAGE <= 3) {
		console.log('3. Deploy InterestManagerCompound')
		console.log('==============================================')
		const [interestManagerCompoundProxy, interestManagerCompoundLogic] = await deployProxyContract(
			'InterestManagerCompound',
			proxyAdminAddress,
			deployerAddress, // owner - you can easily change this later (see how in step 5 of IM deploy script)
			externalContractAdresses.dai,
			externalContractAdresses.cDai,
			externalContractAdresses.comp,
			deploymentParams.multisig // The address of the recipient of the Comp tokens
		)

		interestManagerCompoundProxyAddress = interestManagerCompoundProxy.address
		saveDeployedAddress(networkName, 'interestManager', interestManagerCompoundProxyAddress)
		saveDeployedABI(networkName, 'interestManager', artifacts.readArtifactSync('InterestManagerCompound').abi)
		saveDeployedAddress(networkName, 'interestManagerLogic', interestManagerCompoundLogic.address)
		console.log('Deployed InterestManagerCompound')
	} else {
		interestManagerCompoundProxyAddress = loadDeployedAddress(networkName, 'interestManager')
	}

  let all41ExchangeProxyAddress
	if (STAGE <= 4) {
		console.log('4. Deploy All41Exchange')
		console.log('==============================================')
		const [all41ExchangeProxy, all41ExchangeLogic] = await deployProxyContract(
			'All41Exchange',    // name
			proxyAdminAddress,  // admin
			dsPauseProxyAddress,    // address owner
			interestManagerCompoundProxyAddress,  // address interestManager
      externalContractAdresses.dai, // address dai
			deploymentParams.tradingFeeRate,  // uint tradingFeeRate
		)

		all41ExchangeProxyAddress = all41ExchangeProxy.address
		saveDeployedAddress(networkName, 'all41Exchange', all41ExchangeProxyAddress)
		saveDeployedABI(networkName, 'all41Exchange', artifacts.readArtifactSync('All41Exchange').abi)
		saveDeployedAddress(networkName, 'all41ExchangeLogic', all41ExchangeLogic.address)
		console.log('')
	} else {
		all41ExchangeProxyAddress = loadDeployedAddress(networkName, 'all41Exchange')
	}
  
}

/**
 * Deploy admin upgradeability proxy contract
 */
async function deployProxyContract(name, admin, ...params) {
	const logic = await deployContract(name)

	const data = logic.interface.encodeFunctionData('initialize', [...params])
	const proxy = await deployContract('AdminUpgradeabilityProxy', logic.address, admin, data)

	return [proxy, logic]
}

/**
 * Deploy any contract
 * @param name Name of contract as defined by filename locally
 * @param params Any params passed to this method (order of them matters), they are passed to contract constructor
 * @returns deployed contract object containing new contract address (and some other stuff i assume)
 */
async function deployContract(name, ...params) {
	console.log(`Deploying contract ${name}`)
	const contractFactory = await ethers.getContractFactory(name)
	const deployed = await contractFactory.deploy(...params, { gasPrice: deploymentParams.gasPrice })
	console.log(`contractFactory.deploy of ${name} done`)
  await deployed.deployed()
  console.log(`await deployed.deployed() of ${name} done`)
	return deployed
}

function loadDeployedAddress(network, contract) {
	const path = 'deployed/deployed-' + network + '.json'
	if (!fs.existsSync(path)) {
		throw new Error('Deployed file does not exist')
	}

	const raw = fs.readFileSync(path)
	const addresses = JSON.parse(raw)

	if (!addresses || !addresses[contract]) {
		throw new Error(`Address for contract ${contract} does not exist`)
	}

	return addresses[contract]
}

function saveDeployedAddress(network, contract, address) {
	let addresses = {}
	const path = 'deployed/deployed-' + network + '.json'
	if (fs.existsSync(path)) {
		const raw = fs.readFileSync(path)
		addresses = JSON.parse(raw)
	}

	addresses[contract] = address
	fs.writeFileSync(path, JSON.stringify(addresses, undefined, 4))
}

function saveDeployedABI(network, contract, abi) {
	let abis = {}
	const path = 'deployed/abis-' + network + '.json'
	if (fs.existsSync(path)) {
		const raw = fs.readFileSync(path)
		abis = JSON.parse(raw)
	}

	abis[contract] = abi
	fs.writeFileSync(path, JSON.stringify(abis))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
