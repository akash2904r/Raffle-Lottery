const { run } = require("hardhat");

// Programmatically verifying the contract on etherscan
const verify = async (contractAddress, args) => {
    console.log("Verifying contract...");

    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        })
    } catch (e) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already Verified!");
        } else {
            console.log(e);
        }
    }
}

module.exports = { verify }