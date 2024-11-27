const fs = require("fs");
const { ethers, network } = require("hardhat");

const FRONT_END_ADDRESSES_FILE = "../frontend/constants/contractAddress.json";
const FRONT_END_ABI_FILE = "../frontend/constants/abi.json";

// We use this script to automatically make the abi and the contract address available for the frontend
module.exports = async function () {
    if (process.env.UPDATE_FRONT_END === "yes") {
        console.log("Updating front end...");
        updateContractAddresses();
        updateAbi();
    }
}

async function updateAbi() {
    const raffle = await ethers.getContract("Raffle");
    fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json));
}

async function updateContractAddresses() {
    const raffle = await ethers.getContract("Raffle");
    const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf-8"));
    const chainId = network.config.chainId.toString();

    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(raffle.address)) {
            currentAddresses[chainId].push(raffle.address);
        }
    } else {
        currentAddresses[chainId] = [raffle.address];
    }
    fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses));
}

module.exports.tags = ["all", "frontend"]