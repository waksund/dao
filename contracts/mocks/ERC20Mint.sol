pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Mint is ERC20 {

    constructor() ERC20("ERC20Mint", "ERC20Mint"){
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }
}