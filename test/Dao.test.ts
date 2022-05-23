import {ethers} from "hardhat";
import {solidity} from "ethereum-waffle";
import chai from "chai";
import {Dao, ERC20Mock} from "../typechain-types"
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BytesLike, Contract, ContractFactory} from "ethers";
import Min = Mocha.reporters.Min;
import {Bytes} from "ethers/lib/utils";
import exp from "constants";
import erc20Abi from "../artifacts/contracts/mocks/ERC20Mock.sol/ERC20Mock.json";
import {Block} from "@ethersproject/abstract-provider";

chai.use(solidity);
const { expect } = chai;

describe("Dao contract", () => {
    let accounts : SignerWithAddress[];
    let chairPerson : SignerWithAddress;
    let daoAdmin : SignerWithAddress;

    let voteToken : ERC20Mock;
    let recipient : ERC20Mock;
    
    let dao : Dao;
    
    let minimumQuorum : number;
    let duration : number;
    
    let callData : string;
    let description : string;

    let proposalTokenRecipient : SignerWithAddress;
    let proposalMintAmount: number;

    beforeEach(async () =>{
        accounts = await ethers.getSigners();
        [chairPerson, daoAdmin, proposalTokenRecipient] = await ethers.getSigners();
        
        minimumQuorum = 100;
        duration = 100;

        const erc20Factory : ContractFactory = await ethers.getContractFactory("ERC20Mock");
        voteToken = (await erc20Factory.deploy()) as ERC20Mock;
        recipient = (await erc20Factory.deploy()) as ERC20Mock;

        const daoFactory : ContractFactory = await ethers.getContractFactory("Dao");
        dao = (await daoFactory.connect(daoAdmin).deploy(chairPerson.address, voteToken.address, minimumQuorum, duration)) as Dao;
        
        const erc20Interface = new ethers.utils.Interface(erc20Abi.abi);
        proposalMintAmount = 200;
        callData = erc20Interface.encodeFunctionData("mint", [proposalTokenRecipient.address, proposalMintAmount]);
        description = "proposal description";
    });

    async function getProposalId(recipient : string, description: string, callData: string) : Promise<string> {
        let blockNumber : number = await ethers.provider.getBlockNumber();
        let block : Block = await ethers.provider.getBlock(blockNumber);
        return ethers.utils.solidityKeccak256(["address", "string", "bytes", "uint256"],[recipient, description, callData, block.timestamp]);
    }

    describe("deploy", () => {
        it("Should set right minimum quorum", async () =>{
            expect(await dao.minimumQuorum()).to.equal(minimumQuorum);
        });

        it("Should set right duration", async () =>{
            expect(await dao.debatingPeriodDuration()).to.equal(duration);
        });

        it("Should set right vote token", async () =>{
            expect(await dao.voteToken()).to.equal(voteToken.address);
        });
    });

    describe("dao set minimum quorum", () => {
        it("only for admin", async () => {
            const notAdmin: SignerWithAddress = accounts[2];
            await expect(dao.connect(notAdmin).setMinimumQuorum(minimumQuorum))
                .to.be.reverted;
        });

        it("Should can't set zero value", async () => {
            await expect(dao.connect(daoAdmin).setMinimumQuorum(0))
                .to.be.revertedWith("quorum is zero");
        });

        it("Should set new value", async () => {
            const newValue: number = minimumQuorum + 1;
            await dao.connect(daoAdmin).setMinimumQuorum(newValue);
            expect(await dao.minimumQuorum()).to.be.equal(newValue);
        });
    });

    describe("dao set duration", () => {
        it("only for admin", async () => {
            const notAdmin: SignerWithAddress = accounts[2];
            await expect(dao.connect(notAdmin).setDebatingPeriodDuration(duration))
                .to.be.reverted;
        });

        it("Should can't set zero value", async () => {
            await expect(dao.connect(daoAdmin).setDebatingPeriodDuration(0))
                .to.be.revertedWith("duration is zero");
        });

        it("Should set new value", async () => {
            const newValue: number = duration + 1;
            await dao.connect(daoAdmin).setDebatingPeriodDuration(newValue);
            expect(await dao.debatingPeriodDuration()).to.be.equal(newValue);
        });
    });

    describe("deposit", () => {
        it("should require allowance", async () => {
            const account: SignerWithAddress = accounts[2];
            const amount : number = 100;

            await expect(dao.connect(account).deposit(amount))
                .to.be.revertedWith("don't allowance");
        });

        it("should change balance on dao", async () => {
            const account: SignerWithAddress = accounts[2];
            const amount : number = 100;

            await voteToken.mint(account.address, amount);
            await voteToken.connect(account).approve(dao.address, amount);
            await dao.connect(account).deposit(amount);

            expect(await dao.balances(account.address))
                .to.be.equal(amount);
        });

        it("should change token balance", async () => {
            const account: SignerWithAddress = accounts[2];
            const amount : number = 100;

            await voteToken.mint(account.address, amount);
            await voteToken.connect(account).approve(dao.address, amount);
            await dao.connect(account).deposit(amount);

            expect(await voteToken.balanceOf(account.address))
                .to.be.equal(0);
            expect(await voteToken.balanceOf(dao.address))
                .to.be.equal(amount);
        });
    });

    describe("addProposal", () => {
        it("only for chairPerson", async () => {
            const notChairPerson: SignerWithAddress = accounts[5];
            await expect(dao.connect(notChairPerson).addProposal(callData, recipient.address, description))
                .to.be.reverted;
        });
    });

    describe("vote", () => {
        it("should be able for account with balance only", async () => {
            const account : SignerWithAddress = accounts[5];
            
            await dao.connect(chairPerson).addProposal(callData, recipient.address, description);
            let proposalId : string = await getProposalId(recipient.address, description, callData);
            
            await expect(dao.connect(account).vote(proposalId, true))
                .to.be.revertedWith("zero vote token balance");
        });

        it("shouldn't be able if proposal isn't exist", async () => {
            const account : SignerWithAddress = accounts[5];
            const voteTokenAmount : number = 100;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(dao.address, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);
            let proposalId : string = await getProposalId(recipient.address, description, callData);

            await expect(dao.connect(account).vote(proposalId, true))
                .to.be.revertedWith("proposal isn't exist");
        });

        it("shouldn't be able double vote", async () => {
            const account : SignerWithAddress = accounts[5];
            const voteTokenAmount : number = 100;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(dao.address, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.connect(chairPerson).addProposal(callData, recipient.address, description);
            let proposalId : string = await getProposalId(recipient.address, description, callData);
            await dao.connect(account).vote(proposalId, true);

            await expect(dao.connect(account).vote(proposalId, true))
                .to.be.revertedWith("vote already exists");
        });

        it("shouldn't be able after proposal duration", async () => {
            const account : SignerWithAddress = accounts[5];
            const voteTokenAmount : number = 100;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(dao.address, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.connect(chairPerson).addProposal(callData, recipient.address, description);
            let proposalId : string = await getProposalId(recipient.address, description, callData);

            await ethers.provider.send('evm_increaseTime', [duration]);

            await expect(dao.connect(account).vote(proposalId, true))
                .to.be.revertedWith("proposal period is closed");
        });
    });

    describe("finishProposal", () => {

        it("shouldn't be able if proposal isn't exist", async () => {
            let proposalId : string = await getProposalId(recipient.address, description, callData);
            await expect(dao.finishProposal(proposalId))
                .to.be.revertedWith("proposal isn't exist");
        });

        it("shouldn't be able if proposal period isn't closed", async () => {
            const account : SignerWithAddress = accounts[5];
            const voteTokenAmount : number = minimumQuorum + 1;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(dao.address, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.connect(chairPerson).addProposal(callData, recipient.address, description);
            let proposalId : string = await getProposalId(recipient.address, description, callData);
            await dao.connect(account).vote(proposalId, true);

            await ethers.provider.send('evm_increaseTime', [duration-2]);

            await expect(dao.finishProposal(proposalId))
                .to.be.revertedWith("proposal period isn't closed");
        });

        it("shouldn't be able if not enough quorum", async () => {
            const account : SignerWithAddress = accounts[5];
            const voteTokenAmount : number = minimumQuorum -1;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(dao.address, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.connect(chairPerson).addProposal(callData, recipient.address, description);
            let proposalId : string = await getProposalId(recipient.address, description, callData);
            await dao.connect(account).vote(proposalId, true);

            await ethers.provider.send('evm_increaseTime', [duration]);

            await expect(dao.finishProposal(proposalId))
                .to.be.revertedWith("not enough quorum");
        });

        it("shouldn't call recipient when cons", async () => {
            const account : SignerWithAddress = accounts[5];
            const voteTokenAmount : number = minimumQuorum + 1;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(dao.address, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.connect(chairPerson).addProposal(callData, recipient.address, description);
            let proposalId : string = await getProposalId(recipient.address, description, callData);
            await dao.connect(account).vote(proposalId, false);

            await ethers.provider.send('evm_increaseTime', [duration]);

            await dao.finishProposal(proposalId);

            expect(await recipient.balanceOf(proposalTokenRecipient.address))
                .to.be.equal(0);
        });

        it("should call recipient when pons", async () => {
            const account : SignerWithAddress = accounts[5];
            const voteTokenAmount : number = minimumQuorum + 1;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(dao.address, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.connect(chairPerson).addProposal(callData, recipient.address, description);
            let proposalId : string = await getProposalId(recipient.address, description, callData);
            await dao.connect(account).vote(proposalId, true);

            await ethers.provider.send('evm_increaseTime', [duration]);

            await dao.finishProposal(proposalId);

            expect(await recipient.balanceOf(proposalTokenRecipient.address))
                .to.be.equal(proposalMintAmount);
        });

        it("should call recipient with error when wrong callData", async () => {
            const account : SignerWithAddress = accounts[5];
            const voteTokenAmount : number = minimumQuorum + 1;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(dao.address, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);
            
            await dao.connect(chairPerson).addProposal(callData, dao.address, description);
            let proposalId2 : string = await getProposalId(dao.address, description, callData);
            await dao.connect(account).vote(proposalId2, true);

            await ethers.provider.send('evm_increaseTime', [duration]);

            await expect(dao.finishProposal(proposalId2))
                .to.be.revertedWith("ERROR call recipient");
        });
    });

    describe("withdrawal", () => {
        it("shouldn't be possible with active proposals", async () => {
            const account : SignerWithAddress = accounts[5];
            const voteTokenAmount : number = minimumQuorum + 1;
            const withdrawalAmount : number = voteTokenAmount;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(dao.address, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.connect(chairPerson).addProposal(callData, recipient.address, description);
            let proposalId : string = await getProposalId(recipient.address, description, callData);
            await dao.connect(account).vote(proposalId, true);

            await expect(dao.connect(account).withdrawal(withdrawalAmount))
                .to.be.revertedWith("hold balance");
        });

        it("shouldn't be possible when close only one of proposals", async () => {
            const account : SignerWithAddress = accounts[5];
            const voteTokenAmount : number = minimumQuorum + 1;
            const withdrawalAmount : number = voteTokenAmount;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(dao.address, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.connect(chairPerson).addProposal(callData, recipient.address, description);
            let proposalId : string = await getProposalId(recipient.address, description, callData);
            await dao.connect(account).vote(proposalId, true);

            await ethers.provider.send('evm_increaseTime', [duration]);
            await dao.connect(chairPerson).addProposal(callData, recipient.address, description + "2");
            let proposalId2 : string = await getProposalId(recipient.address, description + "2", callData);
            await dao.connect(account).vote(proposalId2, true);

            await dao.finishProposal(proposalId);

            await expect(dao.connect(account).withdrawal(withdrawalAmount))
                .to.be.revertedWith("hold balance");
        });

        it("shouldn't be possible when close only one of proposals with less duration", async () => {
            const account : SignerWithAddress = accounts[5];
            const voteTokenAmount : number = minimumQuorum + 1;
            const withdrawalAmount : number = voteTokenAmount;
            const duration1:number = duration - 30;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(dao.address, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.connect(chairPerson).addProposal(callData, recipient.address, description);
            let proposalId : string = await getProposalId(recipient.address, description, callData);
            await dao.connect(account).vote(proposalId, true);
            
            await dao.connect(daoAdmin).setDebatingPeriodDuration(duration1);
            await dao.connect(chairPerson).addProposal(callData, recipient.address, description + "2");
            let proposalId2 : string = await getProposalId(recipient.address, description + "2", callData);
            await dao.connect(account).vote(proposalId2, true);

            await ethers.provider.send('evm_increaseTime', [duration1]);

            await dao.finishProposal(proposalId2);

            await expect(dao.connect(account).withdrawal(withdrawalAmount))
                .to.be.revertedWith("hold balance");
        });

        it("shouldn't be possible with zero amount", async () => {
            const account : SignerWithAddress = accounts[5];
            const voteTokenAmount : number = minimumQuorum;
            const withdrawalAmount : number = 0;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(dao.address, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);
            
            await expect(dao.connect(account).withdrawal(withdrawalAmount))
                .to.be.revertedWith("wrong amount");
        });

        it("shouldn't be possible with withdrawal amount more then balance", async () => {
            const account : SignerWithAddress = accounts[5];
            const voteTokenAmount : number = minimumQuorum;
            const withdrawalAmount : number = voteTokenAmount + 1;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(dao.address, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await expect(dao.connect(account).withdrawal(withdrawalAmount))
                .to.be.revertedWith("wrong amount");
        });
        
        it("should change balance", async () => {
            const account : SignerWithAddress = accounts[5];
            const voteTokenAmount : number = minimumQuorum;
            const withdrawalAmount : number = voteTokenAmount - 1;

            await voteToken.mint(account.address, voteTokenAmount);
            await voteToken.connect(account).approve(dao.address, voteTokenAmount);
            await dao.connect(account).deposit(voteTokenAmount);

            await dao.connect(account).withdrawal(withdrawalAmount);
            expect(await voteToken.balanceOf(account.address))
                .to.be.equal(withdrawalAmount);
            expect(await voteToken.balanceOf(dao.address))
                .to.be.equal(voteTokenAmount - withdrawalAmount);
        });
    });
});