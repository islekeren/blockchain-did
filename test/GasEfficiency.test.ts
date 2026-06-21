import { expect } from "chai";
import { ethers } from "hardhat";

async function deployRegistryFixture() {
  const [owner, issuer] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("StudentVerificationRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  return { registry, owner, issuer };
}

async function gasUsedBy(txPromise: Promise<{ wait: () => Promise<unknown> }>) {
  const tx = await txPromise;
  const receipt = (await tx.wait()) as { gasUsed: bigint } | null;

  expect(receipt).to.not.equal(null);

  return Number(receipt!.gasUsed);
}

function expectGasWithinBudget(
  operation: string,
  gasUsed: number,
  budget: number
) {
  console.log(`${operation}: ${gasUsed.toLocaleString()} gas / ${budget.toLocaleString()} budget`);
  expect(gasUsed).to.be.lessThan(budget);
}

describe("gas efficiency", function () {
  const issuerDid = "did:ethr:0x1111111111111111111111111111111111111111";
  const schemaHash = ethers.id("student-credential-schema:v1");
  const schemaName = "StudentCredential";
  const credentialHash = ethers.id("credential:student:1");

  const gasBudgets = {
    addIssuer: 130_000,
    removeIssuer: 60_000,
    registerSchema: 100_000,
    registerCredential: 90_000,
    revokeCredential: 70_000,
    checkRevocation: 30_000
  };

  it("keeps issuer registry writes within the expected gas budget", async function () {
    const { registry, issuer } = await deployRegistryFixture();

    const addIssuerGas = await gasUsedBy(
      registry.addIssuer(issuer.address, issuerDid)
    );
    const removeIssuerGas = await gasUsedBy(registry.removeIssuer(issuer.address));

    expectGasWithinBudget("addIssuer", addIssuerGas, gasBudgets.addIssuer);
    expectGasWithinBudget("removeIssuer", removeIssuerGas, gasBudgets.removeIssuer);
  });

  it("keeps schema registration within the expected gas budget", async function () {
    const { registry } = await deployRegistryFixture();

    const registerSchemaGas = await gasUsedBy(
      registry.registerSchema(schemaHash, schemaName)
    );

    expectGasWithinBudget(
      "registerSchema",
      registerSchemaGas,
      gasBudgets.registerSchema
    );
  });

  it("keeps credential registration and revocation within the expected gas budget", async function () {
    const { registry, issuer } = await deployRegistryFixture();

    await registry.addIssuer(issuer.address, issuerDid);
    const registerCredentialGas = await gasUsedBy(
      registry.connect(issuer).registerCredential(credentialHash)
    );
    const revokeCredentialGas = await gasUsedBy(
      registry.connect(issuer).revokeCredential(credentialHash)
    );

    expectGasWithinBudget(
      "registerCredential",
      registerCredentialGas,
      gasBudgets.registerCredential
    );
    expectGasWithinBudget(
      "revokeCredential",
      revokeCredentialGas,
      gasBudgets.revokeCredential
    );
  });

  it("keeps revocation status checks inexpensive", async function () {
    const { registry, issuer } = await deployRegistryFixture();

    await registry.addIssuer(issuer.address, issuerDid);
    await registry.connect(issuer).registerCredential(credentialHash);
    await registry.connect(issuer).revokeCredential(credentialHash);

    const checkRevocationGas = Number(
      await registry.isRevoked.estimateGas(credentialHash)
    );

    expect(await registry.isRevoked(credentialHash)).to.equal(true);
    expectGasWithinBudget(
      "isRevoked estimate",
      checkRevocationGas,
      gasBudgets.checkRevocation
    );
  });
});
