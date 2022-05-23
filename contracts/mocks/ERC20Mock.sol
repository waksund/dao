pragma solidity ^0.8.0;

import "./IERC20MintBurn.sol";

contract ERC20Mock is IERC20MintBurn {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 _totalSupply;

    string private _name;
    string private _symbol;
    uint8 private _decimals;

    constructor(){
        _name = "name";
        _symbol = "symbol";
        _decimals = 0;
    }

    function name() public view returns (string memory){
        return _name;
    }

    function symbol() public view returns (string memory){
        return _symbol;
    }

    function decimals() public view returns (uint8){
        return _decimals;
    }

    function totalSupply() public view returns (uint256){
        return _totalSupply;
    }

    function balanceOf(address owner) public view returns (uint256){
        return _balances[owner];
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public returns (bool){
        address owner = msg.sender;
        _approve(owner, spender, amount);
        return true;
    }

    function transfer(address to, uint256 value) public returns (bool){
        address from = msg.sender;
        _transfer(from, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool){
        address spender = msg.sender;
        if (from != spender) _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "from address shouldn't be zero");
        require(to != address(0), "to address shouldn't be zero");
        require(amount != 0, "amount shouldn't be zero");

        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "insufficient funds");
        _balances[from] = fromBalance - amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "account shouldn't be zero");
        require(amount != 0, "amount shouldn't be zero");

        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "account shouldn't be zero");
        require(amount != 0, "amount shouldn't be zero");

        uint256 accountBalance = _balances[account];
        uint256 burnAmount = amount>accountBalance ? accountBalance : amount;
        _balances[account] = accountBalance - burnAmount;
        _totalSupply -= burnAmount;

        emit Transfer(account, address(0), burnAmount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "owner address shouldn't be zero");
        require(spender != address(0), "spender address shouldn't be zero");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = allowance(owner, spender);
        require(currentAllowance >= amount, "insufficient allowance funds");
        _approve(owner, spender, currentAllowance - amount);
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }

    function transferMock(address from, address to, uint256 amount) public {
        _transfer(from, to, amount);
    }

    function approveMock(address owner, address spender, uint256 amount) public {
        _approve(owner, spender, amount);
    }
}