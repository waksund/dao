pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title A simple DAO contract
/// @author Victoria Dolzhenko
/// @notice You can use this for proposals
/// @dev
contract Dao is AccessControl {

    /// @notice Token which you need to deposit for can vote
    address public voteToken;

    /// @notice Minimum count vote tokens for proposal
    uint256 public minimumQuorum;

    /// @notice Debating period duration
    uint256 public debatingPeriodDuration;

    /// @notice Balances of users
    mapping(address => uint256) public balances;

    bytes32 public constant SETTINGS_ROLE = keccak256("SETTINGS_ROLE");
    bytes32 public constant CHAIRPERSON_ROLE = keccak256("CHAIRPERSON_ROLE"); 
    
    mapping(bytes32 => Proposal) private _proposals;
    mapping(address => uint256) private _lastProposalEndDate;
    struct Proposal{
        uint256 startDate;
        uint256 endDate;
        uint256 minimumQuorum;
        bytes callData; 
        address recipient; 
        string description;
        uint256 pros;
        uint256 cons;
        mapping(address => uint256) voters;
    }
    
    constructor(
        address chairPerson,
        address _voteToken,
        uint256 _minimumQuorum,
        uint256 _debatingPeriodDuration){
        
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(SETTINGS_ROLE, _msgSender());
        _setupRole(CHAIRPERSON_ROLE, chairPerson);
        
        voteToken = _voteToken;
        setMinimumQuorum(_minimumQuorum);
        setDebatingPeriodDuration(_debatingPeriodDuration);
    }

    /// @notice Change minimum quorum
    function setMinimumQuorum(uint256 _minimumQuorum) public onlyRole(SETTINGS_ROLE){
        require(_minimumQuorum>0, "quorum is zero");
        minimumQuorum = _minimumQuorum;
    }

    /// @notice Change debating period duration
    function setDebatingPeriodDuration(uint256 _debatingPeriodDuration) public onlyRole(SETTINGS_ROLE){
        require(_debatingPeriodDuration>0, "duration is zero"); 
        debatingPeriodDuration = _debatingPeriodDuration;
    }

    /// @notice Deposit vote tokens
    /// @param amount Amount tokens which you want to send
    function deposit(uint256 amount) public {
        require(IERC20(voteToken).allowance(msg.sender, address(this)) >= amount, "don't allowance");
        balances[msg.sender] += amount;
        SafeERC20.safeTransferFrom(IERC20(voteToken), msg.sender, address(this), amount);
        
        emit depositEvent(msg.sender, amount);
    }

    /// @notice Withdrawal vote tokens
    /// @param amount Amount tokens which you want to get
    function withdrawal(uint256 amount) public {
        require(_lastProposalEndDate[msg.sender] <= block.timestamp, "hold balance");
        require(amount > 0 && balances[msg.sender] >= amount, "wrong amount");

        balances[msg.sender] -= amount;
        SafeERC20.safeTransfer(IERC20(voteToken), msg.sender, amount);
        
        emit withdrawalEvent(msg.sender, amount);
    }

    /// @notice Start new proposal
    /// @param callData Signature call recipient method
    /// @param recipient Contract which we will call
    /// @param description Proposal description
    function addProposal(bytes memory callData, address recipient, string memory description) onlyRole(CHAIRPERSON_ROLE) public {
        bytes32 proposalId = keccak256(abi.encodePacked(recipient, description, callData, block.timestamp));
        require(_proposals[proposalId].startDate == 0, "proposal exists");
        
        _proposals[proposalId].startDate = block.timestamp;
        _proposals[proposalId].minimumQuorum = minimumQuorum;
        _proposals[proposalId].endDate = _proposals[proposalId].startDate + debatingPeriodDuration;
        _proposals[proposalId].recipient = recipient;
        _proposals[proposalId].callData = callData;
        _proposals[proposalId].description = description;
        
        emit startProposal(
            proposalId, 
                _proposals[proposalId].minimumQuorum, 
                _proposals[proposalId].endDate, 
                _proposals[proposalId].callData, 
                _proposals[proposalId].recipient, 
                _proposals[proposalId].description);
    }

    /// @notice Vote to some proposal
    /// @param proposalId Proposal id
    /// @param decision Your decision
    function vote(bytes32 proposalId, bool decision) public {
        require(balances[msg.sender] > 0, "zero vote token balance");
        require(_proposals[proposalId].startDate >0, "proposal isn't exist");
        require(balances[msg.sender] > _proposals[proposalId].voters[msg.sender], "vote already exists");
        require(_proposals[proposalId].endDate > block.timestamp, "proposal period is closed");
        
        decision ? _proposals[proposalId].pros+=balances[msg.sender] - _proposals[proposalId].voters[msg.sender] : _proposals[proposalId].cons+=balances[msg.sender] - _proposals[proposalId].voters[msg.sender];
        _proposals[proposalId].voters[msg.sender] = balances[msg.sender];
        if (_lastProposalEndDate[msg.sender] < _proposals[proposalId].endDate) _lastProposalEndDate[msg.sender] = _proposals[proposalId].endDate;
        
        emit voteProposal(proposalId, msg.sender, decision);
    }

    /// @notice Finish proposal
    /// @param proposalId Proposal id
    function finishProposal(bytes32 proposalId) public {
        require(_proposals[proposalId].startDate >0, "proposal isn't exist");
        require(_proposals[proposalId].endDate <= block.timestamp, "proposal period isn't closed");
        require(_proposals[proposalId].pros + _proposals[proposalId].cons >= _proposals[proposalId].minimumQuorum, "not enough quorum");
        
        bool decision = _proposals[proposalId].pros > _proposals[proposalId].cons;
        if (decision) callRecipient(_proposals[proposalId].recipient, _proposals[proposalId].callData);
        delete _proposals[proposalId];
        
        emit finishProposalEvent(proposalId, decision);
    }
    
    function callRecipient(address recipient, bytes memory signature) private {
        (bool success, ) = recipient.call{value: 0}(signature);
        require(success, "ERROR call recipient");
    }

    event startProposal(
        bytes32 indexed proposalId,
        uint256 minimumQuorum,
        uint256 endDate,
        bytes callData,
        address recipient,
        string description);

    event voteProposal(
        bytes32 indexed proposalId,
        address voter,
        bool decision);

    event finishProposalEvent(
        bytes32 indexed proposalId,
        bool decision);

    event depositEvent(
        address indexed account,
        uint256 amount);

    event withdrawalEvent(
        address indexed account,
        uint256 amount);
}
