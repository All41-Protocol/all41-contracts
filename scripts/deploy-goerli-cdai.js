// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers } = require('hardhat')

async function main() {
	// Hardhat always runs the compile task when running scripts with its command
	// line interface.
	//
	// If this script is run directly using `node` you may want to call compile
	// manually to make sure everything is compiled
	// await hre.run('compile');

	// We get the contract to deploy
  const TestCDai = await ethers.getContractFactory('TestCDai')
  // daiAddress, compAddress, comptrollerAddress
  cDai = await TestCDai.deploy("0xdc31Ee1784292379Fbb2964b3B9C4124D8F89C60", "0xD91f542DAEb69Fa1A81D20F30c3D52d5A3f8753E", "0xA990341aD281CC1126CFe3a0c8B3870650672De0")
  await cDai.deployed()
  // Starting exchange rate
  const web3BNTenPow18 = ethers.BigNumber.from('10').pow(ethers.BigNumber.from('18'))
  await cDai.setExchangeRate(web3BNTenPow18.mul(ethers.BigNumber.from('1')))

	console.log(`[$]: npx hardhat verify --network <> ${cDai.address}`)

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})