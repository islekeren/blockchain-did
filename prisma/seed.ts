import { PrismaClient } from "@prisma/client";
import { didForWalletAddress, normalizeWalletAddress } from "../src/lib/blockchain/address";
import { hashCredentialPayload } from "../src/lib/credential/hash";
import { buildStudentCredential } from "../src/lib/credential/vc";

const prisma = new PrismaClient();

function issuerDid(address: string) {
  return didForWalletAddress(address);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function main() {
  await prisma.verificationRequest.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.student.deleteMany();
  await prisma.issuer.deleteMany();

  const ankara = await prisma.issuer.create({
    data: {
      name: "Ankara University",
      did: issuerDid("0xA111111111111111111111111111111111111111"),
      walletAddress: normalizeWalletAddress(
        "0xA111111111111111111111111111111111111111"
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
        walletAddress: normalizeWalletAddress(
          "0x1000000000000000000000000000000000000001"
        ),
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
  const validCredential = buildStudentCredential({
    student: students[0],
    issuer: ankara,
    issuedAt,
    expiresAt: addDays(new Date(), 355)
  });

  const inactiveExpiredCredential = buildStudentCredential({
    student: students[2],
    issuer: ankara,
    issuedAt: addDays(new Date(), -430),
    expiresAt: addDays(new Date(), -30)
  });

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
        status: "ISSUED",
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

  await prisma.verificationRequest.create({
    data: {
      verifierName: "EduDiscounts Marketplace",
      result: "PENDING",
      reasons: JSON.stringify([
        "Seed verifier platform example for live demo requests"
      ])
    }
  });

  console.log("Seed complete: issuers, students, credentials, verifier example.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
