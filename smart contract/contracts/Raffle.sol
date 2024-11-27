// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

/* Errors */
error Raffle__NotEnoughETH();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 raffleState
);

/** @title A sample Raffle Contract
 *  @author Akash
 *  @notice This contract is for creating an untamperable decentralized smart contract
 *  @dev This contract implements Chainlink VRF v2 and Chainlink Keepers
 */
contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
    /* Enums */
    enum RaffleState { OPEN, CALCULATING }

    /* State Variables */
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    /* Lottery Variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    /* Events */

    // Good Practice: Name events with the function name reversed
    // An event can have utmost 3 indexed variables
    // Indexed variables are also called as topics
    // Indexed variables are easy to get, but inorder to get the other data we might need the contract abi
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    /* Functions */
    constructor (
        address vrfCoordinatorV2, 
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        i_interval = interval;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
    }

    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) revert Raffle__NotEnoughETH();
        if (s_raffleState != RaffleState.OPEN) revert Raffle__NotOpen();
        s_players.push(payable(msg.sender));
        // Emit an event when we update the dynamic array i.e., players
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the function that the Chainlink Keeper nodes call
     *  They look for the 'upKeepNeeded' to be returned as true
     *  The following should be true in order for it to be true:
           1. Our time interval should have passed
           2. The lottery should have atleast 1 player with some ETH
           3. Our subscription is to be funded with LINK Tokens
           4. The lottery should be in 'open' state
     */
    function checkUpkeep(bytes memory /* checkData */) 
        public 
        view
        override 
        returns(bool upkeepNeeded, bytes memory /* performData */) 
    {
        // The following are the conditions referred in the above comment
        // That is, the conditions are are required to be true in order for the upkeepNeeded to be true
        bool isOpen = (RaffleState.OPEN == s_raffleState);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        // Request a random number
        // After receiving it, do something with it
        // 2 transaction process
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }
        // Setting the Raffle state to calculating, so that no new players can join during this particular time
        s_raffleState = RaffleState.CALCULATING;
        // Requesting for the random number
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane, // The maximum gas price you are willing to pay for a request in wei
            i_subscriptionId, // The subscription ID that this contract uses for funding requests
            REQUEST_CONFIRMATIONS, // How many confirmations the Chainlink node should wait before responding
            i_callbackGasLimit, // The limit for how much gas to use for the callback request
            NUM_WORDS // How many random numbers we want
        );
        // This is redundant!! Since the vrf coordinator already emits an event
        emit RequestedRaffleWinner(requestId);
    }

    function fulfillRandomWords(
        uint256 /* requestId */, 
        uint256[] memory randomWords
    ) internal override {
        /*
            Assuming the following are the data we have:
            - s_players i.e., No. of players = 10
            - The random number returned = 202
            - Using the modulo operator we can choose a random winner i.e.,
                =>    202 % 10 = 2
            - The modulo operator always returns a value starting from 0 to 1 less than the right operand i.e., 0-9 (the array indeces)
        */
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        // Setting the Raffle state to open for the next set of players to join the lottery
        s_raffleState = RaffleState.OPEN;
        // Clearing the previous players array for the new lottery to begin
        s_players = new address payable[](0);
        // Setting the new time stamp where the most recent winner was choosen
        s_lastTimeStamp = block.timestamp;
        // Sending the money to the recent winner
        (bool success, ) = recentWinner.call{ value: address(this).balance }("");
        if (!success) revert Raffle__TransferFailed();
        emit WinnerPicked(recentWinner);
    }

    /* Getter Functions */

    // View Functions
    function getEntranceFee() public view returns(uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns(address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns(address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns(RaffleState) {
        return s_raffleState;
    }

    function getNumberOfPlayers() public view returns(uint256) {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns(uint256) {
        return s_lastTimeStamp;
    }

    function getInterval() public view returns(uint256) {
        return i_interval;
    }

    // Pure Functions
    function getNumWords() public pure returns(uint256) {
        return NUM_WORDS;
    }

    function getRequestConfirmations() public pure returns(uint256) {
        return REQUEST_CONFIRMATIONS;
    }
}