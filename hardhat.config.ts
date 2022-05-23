import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();

import { HardhatUserConfig } from "hardhat/types";

import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "solidity-coverage";
import '@typechain/hardhat'
import "@nomiclabs/hardhat-etherscan";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";

import "./tasks/Dao.addProposal.task";
import "./tasks/Dao.deposit.task";
import "./tasks/Dao.finish.task";
import "./tasks/Dao.vote.task";

const INFURA_URL = process.env.INFURA_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
    solidity: "0.8.9",
    networks:{
        rinkeby:{
            url: INFURA_URL,
            accounts: [`0x${PRIVATE_KEY}`]
        }
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    }
};

export default config;