import {task} from "hardhat/config";
import {ethers} from "hardhat";

task("Dao.addProposal", "addproposal")
    .addParam("contract", "contract address")
    .addParam("calldata", "callData")
    .addParam("recipient", "recipient")
    .addParam("description", "description")
    .setAction(async (taskArgs, {ethers}) => {
        const factory = await ethers.getContractFactory("Dao");
        const contract = await factory.attach(taskArgs.contract);

        const callData: string = taskArgs.calldata;
        const recipient: string = ethers.utils.getAddress(taskArgs.recipient);
        const description: string = taskArgs.description;

        const proposalId: string = ethers.utils.solidityKeccak256(["address", "string", "bytes"],[recipient, callData, description]);
        
        await contract.addProposal(callData, recipient, description);
        console.log(`proposalId: ${proposalId}`);
    });