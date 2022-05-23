import {task} from "hardhat/config";
import {ethers} from "hardhat";

import { config as dotEnvConfig } from "dotenv";
import {BytesLike} from "@ethersproject/bytes/src.ts/index";
dotEnvConfig();

task("Dao.finish", "finish")
    .addParam("contract", "contract address")
    .addParam("proposalid", "proposalId")
    .setAction(async (taskArgs, {ethers}) => {
        const factory = await ethers.getContractFactory("Dao");
        const contract = await factory.attach(taskArgs.contract);

        const proposalId: string = taskArgs.proposalid;

        await contract.finishProposal(proposalId);
        console.log(`finished ${proposalId}`);
    });