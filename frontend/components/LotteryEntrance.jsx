import { ethers } from "ethers";
import { useNotification } from "web3uikit";
import { useState, useEffect } from "react";
import { useWeb3Contract, useMoralis } from "react-moralis";

import { abi, contractAddress } from "@/constants";

export default function LotteryEntrance() {
    // Gives the hex value of the chain id
    const { chainId: chainIdHex, isWeb3Enabled } = useMoralis();
    const chainId = parseInt(chainIdHex);
    const raffleAddress = chainId in contractAddress ? contractAddress[chainId][0] : null;

    const dispatch = useNotification();
    const [entranceFee, setEntranceFee] = useState("0");
    const [numPlayers, setNumPlayers] = useState("0");
    const [recentWinner, setRecentWinner] = useState("0");

    // The runContractFunction can both send transactions and read state
    const { runContractFunction: enterRaffle, isLoading, isFetching } = useWeb3Contract({
        abi,
        contractAddress: raffleAddress,
        functionName: "enterRaffle",
        msgValue: entranceFee,
        params: {}
    });

    const { runContractFunction: getEntranceFee } = useWeb3Contract({
        abi,
        contractAddress: raffleAddress,
        functionName: "getEntranceFee",
        params: {},
    });

    const { runContractFunction: getNumberOfPlayers } = useWeb3Contract({
        abi,
        contractAddress: raffleAddress,
        functionName: "getNumberOfPlayers",
        params: {},
    });

    const { runContractFunction: getRecentWinner } = useWeb3Contract({
        abi,
        contractAddress: raffleAddress,
        functionName: "getRecentWinner",
        params: {},
    });

    async function updateUIValues () {
        const entranceFeeFromCall = (await getEntranceFee()).toString();
        const numPlayersFromCall = (await getNumberOfPlayers()).toString();
        const recentWinnerFromCall = await getRecentWinner();
        setEntranceFee(entranceFeeFromCall);
        setNumPlayers(numPlayersFromCall);
        setRecentWinner(recentWinnerFromCall);
    }

    useEffect(() => {
        if (isWeb3Enabled) {
            updateUIValues();
        }
    }, [isWeb3Enabled])

    const handleNewNotification = async function () {
        dispatch({
            type: "info",
            message: "Transaction Complete!",
            title: "Tx Notification",
            position: "topR",
        });
    }
    
    const handleSuccess = async function (tx) {
        try {
            await tx.wait(1);
            updateUIValues();
            handleNewNotification();
        } catch (error) {
            console.log(error);
        }
    }

    return (
        <div>
            {raffleAddress ? (
                <div className="text-white p-5">
                    <div className="flex flex-col gap-5 mb-3.5">
                        <span className="text-5xl text-[#ab8b74] font-bold">Don't just wait for luck - create it!</span>
                        <span className="text-xl text-[#a57373] font-medium">Step into the Raffle - Your chance to win big is just one click away! Enter now and let the odds decide your fortune when the conditions align! Dream big, win bigger!</span>
                    </div>
                    <button
                        onClick={async function () {
                            await enterRaffle({
                                // Checks if the tx was sent to metamask successfully
                                onSuccess: handleSuccess,
                                onError: (error) => console.log(error)
                            });
                        }}
                        disabled={isLoading || isFetching}
                        className={`px-4 py-1.5 text-xl rounded-md font-semibold bg-blue-500 mb-5 ${(isLoading || isFetching) ? "cursor-default" : "hover:bg-blue-600"}`}
                    >
                        {isLoading || isFetching ? (
                            <div className="animate-spin spinner-border h-6 w-6 border-t-2 border-r-2 rounded-full" />
                        ): (
                            <span>Enter Raffle</span>
                        )}
                    </button>
                    <div className="mt-5 flex flex-col gap-1.5">
                        <div>
                            <span className="text-lg font-semibold text-gray-400">Entrance Fee:&nbsp;</span>
                            <span>{ethers.utils.formatUnits(entranceFee, "ether")} ETH</span>
                        </div>
                        <div>
                            <span className="text-lg font-semibold text-gray-400">Players:&nbsp;</span>
                            <span>{numPlayers}</span>
                        </div>
                        <div>
                            <span className="text-lg font-semibold text-gray-400">Recent Winner:&nbsp;</span>
                            <span>{recentWinner}</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-white text-xl p-5 font-medium">Please connect to supported chain...</div>
            )}
        </div>
    );
}