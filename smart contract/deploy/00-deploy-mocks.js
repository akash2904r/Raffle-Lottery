const { network, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

// It costs 0.25 LINKS per request
const BASE_FEE = ethers.utils.parseEther("0.25");
// Calculated value based on the gas price of the chain i.e., LINK per gas
const GAS_PRICE_LINK = 1e9;

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const args = [BASE_FEE, GAS_PRICE_LINK];

    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...");
        // Deploying a mock vrf coordinator
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args,
        });
        log("Mocks Deployed!");
        log("-----------------------------------------------");
    }
}

module.exports.tags = ["all", "mocks"]