require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

const INFURA_ID = process.env.INFURA_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

// 添加调试信息
console.log("Etherscan API Key:", ETHERSCAN_API_KEY ? "已设置" : "未设置");
console.log("Infura ID:", INFURA_ID ? "已设置" : "未设置");
console.log("Private Key:", PRIVATE_KEY ? "已设置" : "未设置");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: false,
        runs: 200
      }
    }
  },
  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/${INFURA_ID}`,
      accounts: [PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  }
}; 