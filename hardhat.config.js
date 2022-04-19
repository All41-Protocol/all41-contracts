require("@nomiclabs/hardhat-ethers")
// require("@openzeppelin/hardhat-upgrades")
// require("@nomiclabs/hardhat-etherscan")
require('dotenv').config()

module.exports = {
  solidity: {
		version: '0.8.4',
		settings: {
			optimizer: {
				enabled: true,
			},
		},
	},
  defaultNetwork: "rinkeby",
  networks: {
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [`${process.env.PRI_KEY}`],
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
