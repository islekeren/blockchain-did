import { AbiCoder, keccak256 } from "ethers";
import { expect } from "chai";

import "./helpers/module";
import {
  credentialHashInputFromPayload,
  hashCredentialCanonicalInput,
  hashCredentialPayload
} from "../src/lib/credential/hash";
import { buildCredentialPayload, issuerWallet } from "./helpers/fixtures";

describe("credential hash", function () {
  it("hashes the ABI-encoded canonical credential fields", function () {
    const credential = buildCredentialPayload();
    const expected = keccak256(
      AbiCoder.defaultAbiCoder().encode(
        [
          "string",
          "string",
          "address",
          "string",
          "string",
          "bool",
          "string",
          "string",
          "uint256",
          "uint256"
        ],
        [
          credential.id,
          credential.issuer.id,
          issuerWallet.address,
          credential.credentialSubject.id,
          credential.credentialSubject.studentId,
          credential.credentialSubject.activeStudent,
          credential.schema.name,
          credential.schema.version,
          BigInt(1767225600),
          BigInt(4070908800)
        ]
      )
    );

    expect(hashCredentialPayload(credential)).to.equal(expected);
  });

  it("normalizes issuer wallet casing before hashing", function () {
    const credential = buildCredentialPayload({
      issuer: {
        id: buildCredentialPayload().issuer.id,
        name: "Demo University",
        walletAddress: issuerWallet.address.toLowerCase()
      }
    });

    expect(credentialHashInputFromPayload(credential).issuerWalletAddress).to.equal(
      issuerWallet.address
    );
    expect(hashCredentialPayload(credential)).to.equal(
      hashCredentialPayload(buildCredentialPayload())
    );
  });

  it("changes the hash when a signed credential field changes", function () {
    const credential = buildCredentialPayload();
    const changedCredential = buildCredentialPayload({
      credentialSubject: {
        ...credential.credentialSubject,
        activeStudent: false
      }
    });

    expect(hashCredentialPayload(changedCredential)).to.not.equal(
      hashCredentialPayload(credential)
    );
  });

  it("rejects invalid date fields before hashing", function () {
    const credential = buildCredentialPayload({
      expirationDate: "not-a-date"
    });

    expect(() => hashCredentialPayload(credential)).to.throw(
      "expirationDate must be a valid ISO date"
    );
  });

  it("hashes already-canonical input without needing a full VC payload", function () {
    const credential = buildCredentialPayload();
    const input = credentialHashInputFromPayload(credential);

    expect(hashCredentialCanonicalInput(input)).to.equal(
      hashCredentialPayload(credential)
    );
  });
});
