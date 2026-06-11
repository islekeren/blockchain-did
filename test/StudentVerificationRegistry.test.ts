import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

function didFor(address: string) {
  return `did:ethr:${address}`;
}

async function deployRegistryFixture() {
  const [owner, issuer, otherIssuer, untrustedUser] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("StudentVerificationRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  return { registry, owner, issuer, otherIssuer, untrustedUser };
}

describe("StudentVerificationRegistry", function () {
  const schemaHash = ethers.id("student-credential-schema:v1");
  const schemaName = "Student Credential v1";
  const credentialHash = ethers.id("credential:student:1");
  const secondCredentialHash = ethers.id("credential:student:2");

  describe("issuer registry", function () {
    it("owner can add issuer", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);
      const did = didFor(issuer.address);

      await expect(registry.addIssuer(issuer.address, did))
        .to.emit(registry, "IssuerAdded")
        .withArgs(issuer.address, did);

      expect(await registry.isTrustedIssuer(issuer.address)).to.equal(true);
      expect(await registry.getIssuerDid(issuer.address)).to.equal(did);
    });

    it("non-owner cannot add issuer", async function () {
      const { registry, issuer, untrustedUser } = await loadFixture(
        deployRegistryFixture
      );

      await expect(
        registry
          .connect(untrustedUser)
          .addIssuer(issuer.address, didFor(issuer.address))
      )
        .to.be.revertedWithCustomError(
          registry,
          "OwnableUnauthorizedAccount"
        )
        .withArgs(untrustedUser.address);
    });

    it("zero address issuer rejected", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.addIssuer(ethers.ZeroAddress, "did:ethr:0x0")
      ).to.be.revertedWith("issuer zero address");
    });

    it("empty DID rejected", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);

      await expect(registry.addIssuer(issuer.address, "")).to.be.revertedWith(
        "issuer DID empty"
      );
    });

    it("owner can remove issuer", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);
      const did = didFor(issuer.address);

      await registry.addIssuer(issuer.address, did);

      await expect(registry.removeIssuer(issuer.address))
        .to.emit(registry, "IssuerRemoved")
        .withArgs(issuer.address);

      expect(await registry.isTrustedIssuer(issuer.address)).to.equal(false);
      expect(await registry.getIssuerDid(issuer.address)).to.equal("");
    });

    it("removed issuer is no longer trusted", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);

      await registry.addIssuer(issuer.address, didFor(issuer.address));
      await registry.removeIssuer(issuer.address);

      await expect(
        registry.connect(issuer).registerCredential(credentialHash)
      ).to.be.revertedWith("caller is not trusted issuer");
    });
  });

  describe("schema registry", function () {
    it("owner can register schema", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);

      await expect(registry.registerSchema(schemaHash, schemaName))
        .to.emit(registry, "SchemaRegistered")
        .withArgs(schemaHash, schemaName);

      expect(await registry.isValidSchema(schemaHash)).to.equal(true);
      expect(await registry.getSchemaName(schemaHash)).to.equal(schemaName);
    });

    it("non-owner cannot register schema", async function () {
      const { registry, untrustedUser } = await loadFixture(
        deployRegistryFixture
      );

      await expect(
        registry.connect(untrustedUser).registerSchema(schemaHash, schemaName)
      )
        .to.be.revertedWithCustomError(
          registry,
          "OwnableUnauthorizedAccount"
        )
        .withArgs(untrustedUser.address);
    });

    it("zero schema hash rejected", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.registerSchema(ethers.ZeroHash, schemaName)
      ).to.be.revertedWith("schema hash zero");
    });

    it("empty schema name rejected", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);

      await expect(registry.registerSchema(schemaHash, "")).to.be.revertedWith(
        "schema name empty"
      );
    });
  });

  describe("credential registry", function () {
    it("trusted issuer can register credential", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);

      await registry.addIssuer(issuer.address, didFor(issuer.address));

      await expect(registry.connect(issuer).registerCredential(credentialHash))
        .to.emit(registry, "CredentialRegistered")
        .withArgs(credentialHash, issuer.address);

      expect(await registry.isRegisteredCredential(credentialHash)).to.equal(
        true
      );
    });

    it("untrusted issuer cannot register credential", async function () {
      const { registry, untrustedUser } = await loadFixture(
        deployRegistryFixture
      );

      await expect(
        registry.connect(untrustedUser).registerCredential(credentialHash)
      ).to.be.revertedWith("caller is not trusted issuer");
    });

    it("zero credential hash rejected", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);

      await registry.addIssuer(issuer.address, didFor(issuer.address));

      await expect(
        registry.connect(issuer).registerCredential(ethers.ZeroHash)
      ).to.be.revertedWith("credential hash zero");
    });

    it("duplicate credential registration rejected", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);

      await registry.addIssuer(issuer.address, didFor(issuer.address));
      await registry.connect(issuer).registerCredential(credentialHash);

      await expect(
        registry.connect(issuer).registerCredential(credentialHash)
      ).to.be.revertedWith("credential already registered");
    });

    it("credential issuer stored correctly", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);

      await registry.addIssuer(issuer.address, didFor(issuer.address));
      await registry.connect(issuer).registerCredential(credentialHash);

      expect(await registry.getCredentialIssuer(credentialHash)).to.equal(
        issuer.address
      );
    });
  });

  describe("revocation registry", function () {
    it("original credential issuer can revoke", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);

      await registry.addIssuer(issuer.address, didFor(issuer.address));
      await registry.connect(issuer).registerCredential(credentialHash);

      await expect(registry.connect(issuer).revokeCredential(credentialHash))
        .to.emit(registry, "CredentialRevoked")
        .withArgs(credentialHash, issuer.address);

      expect(await registry.isRevoked(credentialHash)).to.equal(true);
    });

    it("removed original issuer can revoke already issued credentials", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);

      await registry.addIssuer(issuer.address, didFor(issuer.address));
      await registry.connect(issuer).registerCredential(secondCredentialHash);
      await registry.removeIssuer(issuer.address);

      await expect(
        registry.connect(issuer).revokeCredential(secondCredentialHash)
      )
        .to.emit(registry, "CredentialRevoked")
        .withArgs(secondCredentialHash, issuer.address);
    });

    it("other trusted issuer cannot revoke someone else's credential", async function () {
      const { registry, issuer, otherIssuer } = await loadFixture(
        deployRegistryFixture
      );

      await registry.addIssuer(issuer.address, didFor(issuer.address));
      await registry.addIssuer(otherIssuer.address, didFor(otherIssuer.address));
      await registry.connect(issuer).registerCredential(credentialHash);

      await expect(
        registry.connect(otherIssuer).revokeCredential(credentialHash)
      ).to.be.revertedWith("caller is not credential issuer");
    });

    it("untrusted user cannot revoke", async function () {
      const { registry, issuer, untrustedUser } = await loadFixture(
        deployRegistryFixture
      );

      await registry.addIssuer(issuer.address, didFor(issuer.address));
      await registry.connect(issuer).registerCredential(credentialHash);

      await expect(
        registry.connect(untrustedUser).revokeCredential(credentialHash)
      ).to.be.revertedWith("caller is not credential issuer");
    });

    it("unregistered credential cannot be revoked", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.connect(issuer).revokeCredential(credentialHash)
      ).to.be.revertedWith("credential not registered");
    });

    it("double revocation rejected", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);

      await registry.addIssuer(issuer.address, didFor(issuer.address));
      await registry.connect(issuer).registerCredential(credentialHash);
      await registry.connect(issuer).revokeCredential(credentialHash);

      await expect(
        registry.connect(issuer).revokeCredential(credentialHash)
      ).to.be.revertedWith("credential already revoked");
    });

    it("isRevoked returns true after revocation", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);

      await registry.addIssuer(issuer.address, didFor(issuer.address));
      await registry.connect(issuer).registerCredential(credentialHash);

      expect(await registry.isRevoked(credentialHash)).to.equal(false);

      await registry.connect(issuer).revokeCredential(credentialHash);

      expect(await registry.isRevoked(credentialHash)).to.equal(true);
    });
  });
});
