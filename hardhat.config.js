require('@nomiclabs/hardhat-waffle')
require('@nomiclabs/hardhat-web3')
require('solidity-coverage')
// require("@openzeppelin/hardhat-upgrades")
require("@nomiclabs/hardhat-etherscan")
require('dotenv').config()

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  // These addresses are deterministic: they are the same for all Hardhat users.
  for (const account of accounts) {
    console.log(account.address);
  }
});

module.exports = {
  solidity: {
		version: '0.8.4',
		settings: {
			optimizer: {
				enabled: true,
			},
		},
	},
  networks: {
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRI_KEY],
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRI_KEY],
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRI_KEY],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
