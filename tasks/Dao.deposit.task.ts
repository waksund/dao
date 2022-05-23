import {task} from "hardhat/config";
import {ethers} from "hardhat";

import { config as dotEnvConfig } from "dotenv";
import {BytesLike} from "@ethersproject/bytes/src.ts/index";
dotEnvConfig();

task("Dao.deposit", "deposit")
    .addParam("contract", "contract address")
    .addParam("amount", "amount")
    .setAction(async (taskArgs, {ethers}) => {
        const factory = await ethers.getContractFactory("Dao");
        const contract = await factory.attach(taskArgs.contract);
        
        const amount: number = taskArgs.amount;

        await contract.deposit(amount);
        console.log(`${amount} tokens sended`);
    });