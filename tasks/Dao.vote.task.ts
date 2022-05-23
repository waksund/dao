import {task} from "hardhat/config";
import {ethers} from "hardhat";

import { config as dotEnvConfig } from "dotenv";
import {BytesLike} from "@ethersproject/bytes/src.ts/index";
dotEnvConfig();

task("Dao.vote", "vote")
    .addParam("contract", "contract address")
    .addParam("proposalId", "proposalId")
    .addParam("decision", "decision")
    .setAction(async (taskArgs, {ethers}) => {
        const factory = await ethers.getContractFactory("Dao");
        const contract = await factory.attach(taskArgs.contract);

        const proposalId: string = taskArgs.proposalId;
        const decision: boolean = taskArgs.decision;

        await contract.vote(proposalId, decision);
        console.log(`done`);
    });