const { assert, expect } = require("chai");
const { network, ethers, getNamedAccounts, deployments } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
        let deployer, raffle, vrfCoordinatorV2Mock, raffleEntranceFee, interval;
        const chainId = network.config.chainId;

        beforeEach(async function () {
            deployer = (await getNamedAccounts()).deployer;
            await deployments.fixture(["all"]);
            raffle = await ethers.getContract("Raffle", deployer);
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
            raffleEntranceFee = await raffle.getEntranceFee();
            interval = await raffle.getInterval();
        })

        describe("constructor", function () {
            it("Initializes the raffle correctly", async function () {
                // Ideally we make our tests have just 1 assert per it
                const raffleState = await raffle.getRaffleState();
                assert.equal(raffleState.toString(), "0");
                assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
            })
        })

        describe("enterRaffle", function () {
            it("Reverts if you don't pay enough", async function () {
                await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETH");
            })
            it("Records players when they enter", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                const playerFromContract = await raffle.getPlayer(0);
                assert.equal(playerFromContract, deployer);
            })
            it("Emits event on enter", async function () {
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, "RaffleEnter");
            })
            it("Doesn't allow enterance when raffle is calculating", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                // This method is used to increase the time of the network
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                // This method is used to mine a new block
                // The below two lines perform the same action but, the send method does it a bit faster
                // await network.provider.request({ method: "evm_mine", params: [] });
                await network.provider.send("evm_mine", []);
                // We pretend to be the Chainlink Keeper and call the performUpkeep method
                // Therefore the raffle state changes from open to calculating
                await raffle.performUpkeep([]);
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith("Raffle__NotOpen");
            })
        })

        describe("checkUpkeep", function () {
            it("Returns false if ETH isn't sent", async function () {
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                // By using raffle.callStatic.checkUpkeep() instead of raffle.checkUpkeep()
                // We can get the return value even though the method might not be a view function
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                assert(!upkeepNeeded);
            })
            it("Returns false if raffle isn't open", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                await raffle.performUpkeep([]);
                const raffleState = await raffle.getRaffleState();
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                assert.equal(raffleState.toString(), "1");
                assert.equal(upkeepNeeded, false);
            })
            it("Returns false if enough time isn't passed", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]);
                await network.provider.send("evm_mine", []);
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                assert(!upkeepNeeded);
            })
            it("Returns true if enough time has passed, has players, eth and is open", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                assert(upkeepNeeded);
            })
        })

        describe("performUpkeep", function () {
            it("Runs only if checkUpkeep is true", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                const tx = await raffle.performUpkeep([]);
                assert(tx);
            })
            it("Reverts when checkUpkeep is false", async function () {
                await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNotNeeded");
            })
            it("Updates the raffle state, emits an event and calls the vrf coordinator", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                const txResponse = await raffle.performUpkeep([]);
                const txReceipt = await txResponse.wait()
                const requestId = txReceipt.events[1].args.requestId;
                const raffleState = await raffle.getRaffleState();
                assert(requestId.toNumber() > 0);
                assert(raffleState.toString() == "1");
            })
        })

        describe("fulfillRandomWords", function () {
            beforeEach(async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
            })
            it("Can be called only after performUpkeep", async function () {
                await expect(
                    vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                ).to.be.revertedWith("nonexistent request");
                await expect(
                    vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
                ).to.be.revertedWith("nonexistent request");
            })
            // This test is too big...
            // This test simulates users entering the raffle and wraps the entire functionality of raffle inside a promise
            // Which will resolve if everything is successful
            // An event listener for the WinnerPicked is set up
            // Mocks of chainlink keepers and vrf coordinator are used to kickoff this WinnerPicked event
            // All the assertions are done once the WinnerPicked event is fired
            it("Picks a winner, resets the lottery and sends money", async function () {
                let winnerStartingBalance;
                const additionalEntrances = 3;
                const startingIndex = 1; // 0 --> deployer
                const accounts = await ethers.getSigners();
                for(let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
                    const accountConnectedRaffle = raffle.connect(accounts[i]);
                    await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
                }
                const startingTimeStamp = await raffle.getLatestTimeStamp();

                await new Promise(async (resolve, reject) => {
                    // Setting up a listener for the winner picked event
                    raffle.once("WinnerPicked", async () => {
                        console.log("WinnerPicked event got fired!");
                        try {
                            const recentWinner = await raffle.getRecentWinner();
                            // Console log the recentWinner and the account addresses inorder to find who will be the winner, before hand
                            const raffleState = await raffle.getRaffleState();
                            const endingTimeStamp = await raffle.getLatestTimeStamp();
                            const numPlayers = await raffle.getNumberOfPlayers();
                            const winnerEndingBalance = await accounts[1].getBalance();
                            // Assertions
                            assert.equal(numPlayers.toString(), "0");
                            assert.equal(raffleState.toString(), "0");
                            assert(endingTimeStamp > startingTimeStamp);
                            assert.equal(
                                winnerEndingBalance.toString(),
                                // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                                winnerStartingBalance.add(
                                    raffleEntranceFee
                                        .mul(additionalEntrances)
                                        .add(raffleEntranceFee)
                                )
                                .toString()
                            )
                            // Resolving the promise, since everything went well
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    })
                    // Kicking off the event so that the listener will pick it up, inorder to resolve
                    try {
                        // Mocking the Chainlink Keepers
                        const tx = await raffle.performUpkeep([]);
                        const txReceipt = await tx.wait(1);
                        // Console log the recentWinner to find which account would be choosen as the winner
                        winnerStartingBalance = await accounts[1].getBalance();
                        // Mocking the Chainlink VRF Coordinators
                        await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address);
                    } catch (error) {
                        reject(error);
                    }
                });
            })
        })  
    })