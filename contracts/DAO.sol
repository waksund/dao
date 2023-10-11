pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract  DAO {

    /// @notice Token which you need to deposit for can vote
    address public voteToken;

    /// @notice Balances of users
    mapping(address => uint256) public balances;

    /// @notice Frozen balances of users
    mapping(address => uint256) public frozenBalances;

    mapping(bytes32 => Proposal) private _proposals;
    struct Proposal{
        uint256 startDate;
        uint256 endDate;
        bytes callData;
        address recipient;
        string description;
        uint256 pros;
        uint256 cons;
        mapping(address => uint256) voters;
        address[] votersAddresses;
    }

    constructor(
        address _voteToken){
        voteToken = _voteToken;
    }

    /// @notice Deposit vote tokens
    /// @param amount Amount tokens which you want to send
    function deposit(uint256 amount) public {
        require(IERC20(voteToken).allowance(msg.sender, address(this)) >= amount, "InsufficientAllowance");
        balances[msg.sender] += amount;
        SafeERC20.safeTransferFrom(IERC20(voteToken), msg.sender, address(this), amount);
    }

    /// @notice Withdrawal vote tokens
    /// @param amount Amount tokens which you want to get
    function withdrawal(uint256 amount) public {
        require(amount > 0 && balances[msg.sender] - frozenBalances[msg.sender] >= amount, "FrozenBalance");
        balances[msg.sender] -= amount;
        SafeERC20.safeTransfer(IERC20(voteToken), msg.sender, amount);
    }

    /// @notice Start new proposal
    /// @param callData Signature call recipient method
    /// @param recipient Contract which we will call
    /// @param debatingPeriodDuration Voting duration
    /// @param description Proposal description
    function addProposal(bytes memory callData, address recipient, uint256 debatingPeriodDuration, string memory description) public{
        bytes32 proposalId = keccak256(abi.encodePacked(recipient, description, callData));
        require(_proposals[proposalId].startDate == 0, "DoubleProposal");

        _proposals[proposalId].startDate = block.timestamp;
        _proposals[proposalId].endDate = _proposals[proposalId].startDate + debatingPeriodDuration;
        _proposals[proposalId].recipient = recipient;
        _proposals[proposalId].callData = callData;
        _proposals[proposalId].description = description;
    }

    /// @notice Vote to some proposal
    /// @param proposalId Proposal id
    /// @param decision Your decision
    function vote(bytes32 proposalId, bool decision) public{
        require(balances[msg.sender] > 0, "InsufficientFounds");
        require(_proposals[proposalId].startDate >0, "NotFoundProposal");
        require(balances[msg.sender] > _proposals[proposalId].voters[msg.sender], "DoubleVote");
        require(_proposals[proposalId].endDate > block.timestamp, "ExpiredVotingTime");

        decision ? _proposals[proposalId].pros+=balances[msg.sender] - _proposals[proposalId].voters[msg.sender] : _proposals[proposalId].cons+=balances[msg.sender] - _proposals[proposalId].voters[msg.sender];
        _proposals[proposalId].voters[msg.sender] = balances[msg.sender];
        frozenBalances[msg.sender] += balances[msg.sender];
        _proposals[proposalId].votersAddresses.push(msg.sender);
    }

    /// @notice Finish proposal
    /// @param proposalId Proposal id
    function finishProposal(bytes32 proposalId) public{
        require(_proposals[proposalId].startDate >0, "NotFoundProposal");
        require(_proposals[proposalId].endDate <= block.timestamp, "NotExpiredVotingTime");

        for (uint i = 0; i < _proposals[proposalId].votersAddresses.length; i++) {
            frozenBalances[_proposals[proposalId].votersAddresses[i]] -= _proposals[proposalId].voters[_proposals[proposalId].votersAddresses[i]];
        }

        bool decision = _proposals[proposalId].pros > _proposals[proposalId].cons;
        if (decision) callRecipient(_proposals[proposalId].recipient, _proposals[proposalId].callData);

        delete _proposals[proposalId];
    }

    function callRecipient(address recipient, bytes memory signature) private {
        (bool success, ) = recipient.call{value: 0}(signature);
        require(success, "CallRecipientError");
    }
}