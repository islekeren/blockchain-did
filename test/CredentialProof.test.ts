import { expect } from "chai";

import "./helpers/module";
import {
  buildIssuerCredentialProof,
  createCredentialProofMessage,
  verifyIssuerCredentialProof
} from "../src/lib/credential/proof";
import {
  buildCredentialPayload,
  buildSignedCredential,
  otherIssuerWallet
} from "./helpers/fixtures";
import { hashCredentialPayload } from "../src/lib/credential/hash";

describe("issuer credential proof", function () {
  it("validates a credential proof signed by the issuer wallet", async function () {
    const { credential, credentialHash } = await buildSignedCredential();
    const result = verifyIssuerCredentialProof({
      credential,
      credentialHash
    });

    expect(result.valid).to.equal(true);
    expect(result.recoveredAddress).to.equal(result.expectedAddress);
    expect(result.messageMatches).to.equal(true);
  });

  it("rejects credentials without an issuer proof", function () {
    const credential = buildCredentialPayload();
    const result = verifyIssuerCredentialProof({
      credential,
      credentialHash: hashCredentialPayload(credential)
    });

    expect(result.valid).to.equal(false);
    expect(result.reason).to.equal("Credential does not include an issuer proof.");
  });

  it("rejects a proof signed by a different wallet", async function () {
    const credential = buildCredentialPayload();
    const credentialHash = hashCredentialPayload(credential);
    const signature = await otherIssuerWallet.signMessage(
      createCredentialProofMessage({
        credential,
        credentialHash
      })
    );
    const result = verifyIssuerCredentialProof({
      credential: {
        ...credential,
        proof: buildIssuerCredentialProof({
          credential,
          credentialHash,
          signature,
          created: new Date("2026-01-01T00:00:00.000Z")
        })
      },
      credentialHash
    });

    expect(result.valid).to.equal(false);
    expect(result.recoveredAddress).to.equal(otherIssuerWallet.address);
  });

  it("detects proof message tampering after the credential changes", async function () {
    const { credential, credentialHash } = await buildSignedCredential();
    const changedCredential = {
      ...credential,
      expirationDate: "2028-01-01T00:00:00.000Z"
    };
    const result = verifyIssuerCredentialProof({
      credential: changedCredential,
      credentialHash
    });

    expect(result.valid).to.equal(false);
    expect(result.messageMatches).to.equal(false);
  });
});
