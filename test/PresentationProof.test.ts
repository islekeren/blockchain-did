import { expect } from "chai";

import "./helpers/module";
import {
  createPresentationMessage,
  verifyPresentationSignature
} from "../src/lib/presentation/message";
import { buildPresentationProofChecks } from "../src/lib/presentation/verify";
import {
  buildPresentationProof,
  buildSignedCredential,
  buildVerificationRequest,
  studentWallet,
  verifierName
} from "./helpers/fixtures";

function findCheck(
  checks: Array<{ label: string; passed: boolean; detail: string }>,
  label: string
) {
  const check = checks.find((item) => item.label === label);

  expect(check, `Missing check: ${label}`).to.not.equal(undefined);

  return check!;
}

describe("presentation proof", function () {
  it("builds a deterministic presentation message with normalized inputs", async function () {
    const { credential, credentialHash } = await buildSignedCredential();
    const mixedCaseHash = `0x${credentialHash.slice(2).toUpperCase()}`;
    const message = createPresentationMessage({
      credentialId: ` ${credential.id} `,
      credentialHash: mixedCaseHash,
      studentWalletAddress: studentWallet.address.toLowerCase(),
      requestId: " request-1 ",
      nonce: " nonce-1 ",
      verifierName: ` ${verifierName} `
    });

    expect(message).to.contain(`Credential ID: ${credential.id}`);
    expect(message).to.contain(`Credential Hash: ${credentialHash}`);
    expect(message).to.contain(`Student Wallet: ${studentWallet.address}`);
    expect(message).to.contain(`Verifier: ${verifierName}`);
    expect(message).to.contain("Request ID: request-1");
    expect(message).to.contain("Nonce: nonce-1");
  });

  it("accepts a valid student presentation proof", async function () {
    const { credential, credentialHash } = await buildSignedCredential();
    const proof = await buildPresentationProof({
      credentialId: credential.id,
      credentialHash
    });
    const result = buildPresentationProofChecks({
      proofJson: JSON.stringify(proof),
      credentialPayload: credential,
      credentialHash,
      request: buildVerificationRequest(),
      now: new Date("2026-06-01T00:00:00.000Z")
    });

    expect(result.proof).to.deep.equal(proof);
    expect(result.checks.every((check) => check.passed)).to.equal(true);
    expect(verifyPresentationSignature(proof).valid).to.equal(true);
  });

  it("rejects a presentation proof with the wrong nonce", async function () {
    const { credential, credentialHash } = await buildSignedCredential();
    const proof = await buildPresentationProof({
      credentialId: credential.id,
      credentialHash,
      nonce: "attacker-nonce"
    });
    const result = buildPresentationProofChecks({
      proofJson: JSON.stringify(proof),
      credentialPayload: credential,
      credentialHash,
      request: buildVerificationRequest(),
      now: new Date("2026-06-01T00:00:00.000Z")
    });

    expect(
      findCheck(result.checks, "Presentation nonce matches request").passed
    ).to.equal(false);
  });

  it("rejects an expired verification request", async function () {
    const { credential, credentialHash } = await buildSignedCredential();
    const proof = await buildPresentationProof({
      credentialId: credential.id,
      credentialHash
    });
    const result = buildPresentationProofChecks({
      proofJson: JSON.stringify(proof),
      credentialPayload: credential,
      credentialHash,
      request: buildVerificationRequest({
        expiresAt: new Date("2026-01-02T00:00:00.000Z")
      }),
      now: new Date("2026-01-03T00:00:00.000Z")
    });

    expect(
      findCheck(result.checks, "Verification request is not expired").passed
    ).to.equal(false);
  });

  it("rejects a used verification request as a replay attempt", async function () {
    const { credential, credentialHash } = await buildSignedCredential();
    const proof = await buildPresentationProof({
      credentialId: credential.id,
      credentialHash
    });
    const result = buildPresentationProofChecks({
      proofJson: JSON.stringify(proof),
      credentialPayload: credential,
      credentialHash,
      request: buildVerificationRequest({ used: true }),
      now: new Date("2026-06-01T00:00:00.000Z")
    });

    expect(findCheck(result.checks, "Verification request is unused").passed).to.equal(
      false
    );
  });

  it("rejects a proof for a different credential hash", async function () {
    const { credential, credentialHash } = await buildSignedCredential();
    const proof = await buildPresentationProof({
      credentialId: credential.id,
      credentialHash
    });
    const result = buildPresentationProofChecks({
      proofJson: JSON.stringify(proof),
      credentialPayload: credential,
      credentialHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      request: buildVerificationRequest(),
      now: new Date("2026-06-01T00:00:00.000Z")
    });

    expect(
      findCheck(result.checks, "Presentation credential hash matches").passed
    ).to.equal(false);
  });
});
