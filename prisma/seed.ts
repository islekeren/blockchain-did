import { PrismaClient } from "@prisma/client";
import { Wallet } from "ethers";
import { didForWalletAddress, normalizeWalletAddress } from "../src/lib/blockchain/address";
import { hashCredentialPayload } from "../src/lib/credential/hash";
import {
  buildIssuerCredentialProof,
  createCredentialProofMessage
} from "../src/lib/credential/proof";
import { buildStudentCredential } from "../src/lib/credential/vc";

const prisma = new PrismaClient();

const demoAccounts = {
  admin: {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  },
  issuer: {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
  },
  student: {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
  },
  verifier: {
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
  }
} as const;

function issuerDid(address: string) {
  return didForWalletAddress(address);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function attachIssuerProof(
  credential: ReturnType<typeof buildStudentCredential>
) {
  const credentialHash = hashCredentialPayload(credential);
  const signer = new Wallet(demoAccounts.issuer.privateKey);
  const signature = await signer.signMessage(
    createCredentialProofMessage({ credential, credentialHash })
  );

  return {
    ...credential,
    proof: buildIssuerCredentialProof({
      credential,
      credentialHash,
      signature
    })
  };
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.presentationProof.deleteMany();
  await prisma.verificationRequest.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.student.deleteMany();
  await prisma.issuer.deleteMany();

  const ankara = await prisma.issuer.create({
    data: {
      name: "Ankara University",
      did: issuerDid(demoAccounts.issuer.address),
      walletAddress: normalizeWalletAddress(
        demoAccounts.issuer.address
      ),
      trusted: true
    }
  });

  const fake = await prisma.issuer.create({
    data: {
      name: "Fake University",
      did: issuerDid("0xF222222222222222222222222222222222222222"),
      walletAddress: normalizeWalletAddress(
        "0xF222222222222222222222222222222222222222"
      ),
      trusted: false
    }
  });

  const students = await Promise.all([
    prisma.student.create({
      data: {
        name: "Ece Yilmaz",
        studentNo: "2024001",
        department: "Computer Engineering",
        universityId: ankara.id,
        walletAddress: normalizeWalletAddress(demoAccounts.student.address),
        active: true
      }
    }),
    prisma.student.create({
      data: {
        name: "Mert Kaya",
        studentNo: "2024002",
        department: "Information Systems",
        universityId: ankara.id,
        walletAddress: normalizeWalletAddress(
          "0x1000000000000000000000000000000000000002"
        ),
        active: true
      }
    }),
    prisma.student.create({
      data: {
        name: "Aylin Demir",
        studentNo: "2024003",
        department: "Mathematics",
        universityId: ankara.id,
        walletAddress: normalizeWalletAddress(
          "0x1000000000000000000000000000000000000003"
        ),
        active: false
      }
    }),
    prisma.student.create({
      data: {
        name: "Can Ozkan",
        studentNo: "2024004",
        department: "Economics",
        universityId: fake.id,
        walletAddress: normalizeWalletAddress(
          "0x1000000000000000000000000000000000000004"
        ),
        active: true
      }
    }),
    prisma.student.create({
      data: {
        name: "Deniz Arslan",
        studentNo: "2024005",
        department: "Electrical Engineering",
        universityId: ankara.id,
        walletAddress: normalizeWalletAddress(
          "0x1000000000000000000000000000000000000005"
        ),
        active: true
      }
    })
  ]);

  const issuedAt = addDays(new Date(), -10);
  const validCredential = await attachIssuerProof(buildStudentCredential({
    student: students[0],
    issuer: ankara,
    issuedAt,
    expiresAt: addDays(new Date(), 355)
  }));

  const inactiveExpiredCredential = await attachIssuerProof(buildStudentCredential({
    student: students[2],
    issuer: ankara,
    issuedAt: addDays(new Date(), -430),
    expiresAt: addDays(new Date(), -30)
  }));

  await prisma.credential.createMany({
    data: [
      {
        credentialId: validCredential.id,
        studentId: students[0].id,
        issuerId: ankara.id,
        type: "StudentCredential",
        schemaName: "StudentCredential",
        credentialJson: JSON.stringify(validCredential, null, 2),
        credentialHash: hashCredentialPayload(validCredential),
        status: "PENDING_ONCHAIN",
        issuedAt,
        expiresAt: new Date(validCredential.expirationDate)
      },
      {
        credentialId: inactiveExpiredCredential.id,
        studentId: students[2].id,
        issuerId: ankara.id,
        type: "StudentCredential",
        schemaName: "StudentCredential",
        credentialJson: JSON.stringify(inactiveExpiredCredential, null, 2),
        credentialHash: hashCredentialPayload(inactiveExpiredCredential),
        status: "EXPIRED",
        issuedAt: new Date(inactiveExpiredCredential.issuanceDate),
        expiresAt: new Date(inactiveExpiredCredential.expirationDate)
      }
    ]
  });

  await prisma.user.createMany({
    data: [
      {
        walletAddress: normalizeWalletAddress(demoAccounts.admin.address),
        role: "ADMIN"
      },
      {
        walletAddress: normalizeWalletAddress(demoAccounts.issuer.address),
        role: "ISSUER",
        issuerId: ankara.id
      },
      {
        walletAddress: normalizeWalletAddress(demoAccounts.student.address),
        role: "STUDENT",
        studentId: students[0].id
      },
      {
        walletAddress: normalizeWalletAddress(demoAccounts.verifier.address),
        role: "VERIFIER",
        verifierName: "EduDiscounts Marketplace"
      }
    ]
  });

  await prisma.verificationRequest.create({
    data: {
      verifierName: "EduDiscounts Marketplace",
      result: "PENDING",
      reasons: JSON.stringify([
        "Seed verifier platform example for live demo requests"
      ])
    }
  });

  console.log("Seed complete: users, issuers, students, credentials, verifier example.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
