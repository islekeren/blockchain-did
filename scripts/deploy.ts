import { artifacts, ethers, network } from "hardhat";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const Registry = await ethers.getContractFactory("StudentVerificationRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  const providerNetwork = await ethers.provider.getNetwork();
  const chainId = Number(providerNetwork.chainId);
  const outputDir = path.join(process.cwd(), "src", "lib", "blockchain");

  await mkdir(outputDir, { recursive: true });

  const deployment = {
    network: network.name,
    chainId,
    contractName: "StudentVerificationRegistry",
    address,
    deployedAt: new Date().toISOString()
  };

  await writeFile(
    path.join(outputDir, "deployment.json"),
    `${JSON.stringify(deployment, null, 2)}\n`
  );

  const artifact = await artifacts.readArtifact("StudentVerificationRegistry");

  await writeFile(
    path.join(outputDir, "StudentVerificationRegistry.abi.json"),
    `${JSON.stringify(artifact.abi, null, 2)}\n`
  );

  console.log(`StudentVerificationRegistry deployed to ${address}`);
  console.log(`Network: ${network.name} (${chainId})`);
  console.log("Wrote src/lib/blockchain/deployment.json");
  console.log("Wrote src/lib/blockchain/StudentVerificationRegistry.abi.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
