const { ethers } = require("hardhat");

async function main() {
  const MyNFT = await ethers.getContractFactory("MyNFT");
  const myNFT = await MyNFT.deploy();

  await myNFT.waitForDeployment();

  const address = await myNFT.getAddress();
  console.log(`MyNFT deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 