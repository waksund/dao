import { expect } from "chai";
import { ethers } from "hardhat";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import {DAO, ERC20Mint} from "../typechain-types";
import {ContractFactory} from "ethers";

describe("Dao contract", () => {
    let accounts : HardhatEthersSigner[];
    let daoOwner : HardhatEthersSigner;

    let voteToken : ERC20Mint;
    let voteTokenAddress : string;
    let recipient : ERC20Mint;
    let recipientAddress : string;

    let dao : DAO;
    let daoAddress : string;

    let proposalDuration : number;

    let callData : string;
    let proposalDescription : string;

    let proposalTokenRecipient : HardhatEthersSigner;
    let proposalMintAmount: number;

    beforeEach(async () =>{
        accounts = await ethers.getSigners();
        [proposalTokenRecipient] = await ethers.getSigners();
        proposalDuration = 100;

        const erc20Factory : ContractFactory = await ethers.getContractFactory("ERC20Mint");
        voteToken = (await erc20Factory.deploy()) as ERC20Mint;
        voteTokenAddress = await voteToken.getAddress();
        recipient = (await erc20Factory.deploy()) as ERC20Mint;
        recipientAddress = await recipient.getAddress();

        const daoFactory : ContractFactory = await ethers.getContractFactory("DAO");
        dao = (await daoFactory.deploy(voteTokenAddress)) as DAO;
        daoAddress = await dao.getAddress();

        proposalMintAmount = 200;
        callData = recipient.interface.encodeFunctionData("mint", [proposalTokenRecipient.address, proposalMintAmount]);
        proposalDescription = "proposal description";
    });

    async function getProposalId(recipient : string, description: string, callData: string) : Promise<string> {
        let blockNumber : number = await ethers.provider.getBlockNumber();
        let block = await ethers.provider.getBlock(blockNumber);
        return ethers.solidityPackedKeccak256(["address", "string", "bytes"], [recipient, description, callData]);
    }

    describe("deposit", () => {
        it("should require allowance", async () => {
            const account: HardhatEthersSigner = accounts[2];
            const amount : number = 100;

            await expect(dao.connect(account).deposit(amount))
                .to.be.revertedWith("InsufficientAllowance");
        });

        it("should change balance on dao", async () => {
            const account: HardhatEthersSigner = accounts[2];
            const amount : number = 100;

            await voteToken.mint(account.address, amount);
            await voteToken.connect(account).approve(daoAddress, amount);
            await dao.connect(account).deposit(amount);

            expect(await voteToken.balanceOf(daoAddress))
                .to.be.equal(amount);
        });

        it("should change token balance", async () => {
            const account: HardhatEthersSigner = accounts[2];
            const amount : number = 100;

            await voteToken.mint(account.address, amount);
            await voteToken.connect(account).approve(daoAddress, amount);
            await dao.connect(account).deposit(amount);

            expect(await voteToken.balanceOf(account.address))
                .to.be.equal(0);
        });
    });

    describe("withdrawal", () => {
        it("should not be possible when all balances are frozen", async () => {
            const account : HardhatEthersSigner = accounts[5];
            const voteTokenAmount : number = 100;
            const withdrawalAmount : number = voteTokenAmount;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(daoAddress, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.addProposal(callData, recipientAddress, proposalDuration, proposalDescription);
            let proposalId : string = await getProposalId(recipientAddress, proposalDescription, callData);
            await dao.connect(account).vote(proposalId, true);

            await expect(dao.connect(account).withdrawal(withdrawalAmount))
                .to.be.revertedWith("FrozenBalance");
        });

        it("should be possible with a partially frozen balance", async () => {
            const account : HardhatEthersSigner = accounts[5];
            const voteTokenAmount1 : number = 100;
            const voteTokenAmount2 : number = 100;
            const withdrawalAmount : number = voteTokenAmount2;

            await voteToken.mint(account.address, voteTokenAmount1 + voteTokenAmount2);
            await voteToken.connect(account).approve(daoAddress, voteTokenAmount1 + voteTokenAmount2);
            await dao.connect(account).deposit(voteTokenAmount1);

            await dao.addProposal(callData, recipientAddress, proposalDuration, proposalDescription);
            let proposalId : string = await getProposalId(recipientAddress, proposalDescription, callData);
            await dao.connect(account).vote(proposalId, true);

            await dao.connect(account).deposit(voteTokenAmount2);

            await dao.connect(account).withdrawal(withdrawalAmount);
            expect(await voteToken.balanceOf(account.address))
                .to.be.equal(withdrawalAmount);
        });

        it("shouldn't be possible with withdrawal amount more then balance", async () => {
            const account : HardhatEthersSigner = accounts[5];
            const voteTokenAmount : number = 100;
            const withdrawalAmount : number = voteTokenAmount + 1;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(daoAddress, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await expect(dao.connect(account).withdrawal(withdrawalAmount))
                .to.be.revertedWith("FrozenBalance");
        });

        it("should change account balance", async () => {
            const account : HardhatEthersSigner = accounts[5];
            const voteTokenAmount : number = 100;
            const withdrawalAmount : number = voteTokenAmount - 1;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(daoAddress, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.connect(account).withdrawal(withdrawalAmount);
            expect(await voteToken.balanceOf(account.address))
                .to.be.equal(withdrawalAmount);
        });

        it("should change dao balance", async () => {
            const account : HardhatEthersSigner = accounts[5];
            const voteTokenAmount : number = 100;
            const withdrawalAmount : number = voteTokenAmount - 1;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(daoAddress, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.connect(account).withdrawal(withdrawalAmount);
            expect(await voteToken.balanceOf(daoAddress))
                .to.be.equal(voteTokenAmount - withdrawalAmount);
        });
    });

    describe("addProposal", () => {
        it("should not be possible with duplicate proposal", async () => {
            const account: HardhatEthersSigner = accounts[5];

            await dao.addProposal(callData, recipientAddress, proposalDuration, proposalDescription);

            await expect(dao.addProposal(callData, recipientAddress, proposalDuration, proposalDescription))
                .to.be.revertedWith("DoubleProposal");
        });
    });

    describe("vote", () => {
        it("should be able for account with balance only", async () => {
            const account : HardhatEthersSigner = accounts[5];

            await dao.addProposal(callData, recipientAddress, proposalDuration, proposalDescription);
            let proposalId : string = await getProposalId(recipientAddress, proposalDescription, callData);

            await expect(dao.connect(account).vote(proposalId, true))
                .to.be.revertedWith("InsufficientFounds");
        });

        it("shouldn't be able if proposal isn't exist", async () => {
            const account : HardhatEthersSigner = accounts[5];
            const voteTokenAmount : number = 100;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(daoAddress, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);
            let proposalId : string = await getProposalId(recipientAddress, proposalDescription, callData);

            await expect(dao.connect(account).vote(proposalId, true))
                .to.be.revertedWith("NotFoundProposal");
        });

        it("shouldn't be able double vote", async () => {
            const account : HardhatEthersSigner = accounts[5];
            const voteTokenAmount : number = 100;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(daoAddress, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.addProposal(callData, recipientAddress, proposalDuration, proposalDescription);
            let proposalId : string = await getProposalId(recipientAddress, proposalDescription, callData);
            await dao.connect(account).vote(proposalId, true);

            await expect(dao.connect(account).vote(proposalId, true))
                .to.be.revertedWith("DoubleVote");
        });

        it("shouldn't be able after proposal duration", async () => {
            const account : HardhatEthersSigner = accounts[5];
            const voteTokenAmount : number = 100;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(daoAddress, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.addProposal(callData, recipientAddress, proposalDuration, proposalDescription);
            let proposalId : string = await getProposalId(recipientAddress, proposalDescription, callData);

            await ethers.provider.send('evm_increaseTime', [proposalDuration]);

            await expect(dao.connect(account).vote(proposalId, true))
                .to.be.revertedWith("ExpiredVotingTime");
        });
    });

    describe("finishProposal", () => {

        it("shouldn't be able if proposal isn't exist", async () => {
            let proposalId : string = await getProposalId(recipientAddress, proposalDescription, callData);
            await expect(dao.finishProposal(proposalId))
                .to.be.revertedWith("NotFoundProposal");
        });

        it("shouldn't be able if proposal period isn't closed", async () => {
            const account : HardhatEthersSigner = accounts[5];
            const voteTokenAmount : number = 100;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(daoAddress, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.addProposal(callData, recipientAddress, proposalDuration, proposalDescription);
            let proposalId : string = await getProposalId(recipientAddress, proposalDescription, callData);
            await dao.connect(account).vote(proposalId, true);

            await ethers.provider.send('evm_increaseTime', [proposalDuration-2]);

            await expect(dao.finishProposal(proposalId))
                .to.be.revertedWith("NotExpiredVotingTime");
        });

        it("shouldn't call recipient when cons", async () => {
            const account : HardhatEthersSigner = accounts[5];
            const voteTokenAmount : number = 100;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(daoAddress, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.addProposal(callData, recipientAddress, proposalDuration, proposalDescription);
            let proposalId : string = await getProposalId(recipientAddress, proposalDescription, callData);
            await dao.connect(account).vote(proposalId, false);

            await ethers.provider.send('evm_increaseTime', [proposalDuration]);

            await dao.finishProposal(proposalId);

            expect(await recipient.balanceOf(proposalTokenRecipient.address))
                .to.be.equal(0);
        });

        it("should call recipient when pons", async () => {
            const account : HardhatEthersSigner = accounts[5];
            const voteTokenAmount : number = 100;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(daoAddress, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.addProposal(callData, recipientAddress, proposalDuration, proposalDescription);
            let proposalId : string = await getProposalId(recipientAddress, proposalDescription, callData);
            await dao.connect(account).vote(proposalId, true);

            await ethers.provider.send('evm_increaseTime', [proposalDuration]);

            await dao.finishProposal(proposalId);

            expect(await recipient.balanceOf(proposalTokenRecipient.address))
                .to.be.equal(proposalMintAmount);
        });
    });
});