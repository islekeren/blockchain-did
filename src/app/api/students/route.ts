import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Wallet } from "ethers";

import { writeAuditLog } from "@/lib/audit/log";
import { authErrorResponse, requireRole, requireUser } from "@/lib/auth/session";
import { normalizeWalletAddress } from "@/lib/blockchain/address";
import { prisma } from "@/lib/db/prisma";
import { createStudentSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const students = await prisma.student.findMany({
      where:
        user.role === "ADMIN"
          ? undefined
          : user.role === "ISSUER" && user.issuerId
            ? { universityId: user.issuerId }
            : user.role === "STUDENT" && user.studentId
              ? { id: user.studentId }
              : { id: "__none__" },
      orderBy: { createdAt: "asc" },
      include: {
        university: true,
        _count: {
          select: {
            credentials: true
          }
        }
      }
    });

    return NextResponse.json({ students });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unable to load students" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(request, ["ADMIN", "ISSUER"]);
    const data = createStudentSchema.parse(await request.json());

    if (user.role === "ISSUER" && data.universityId !== user.issuerId) {
      return NextResponse.json(
        { error: "Issuer wallets can only create students for their own university." },
        { status: 403 }
      );
    }

    const generatedWallet = data.walletAddress ? null : Wallet.createRandom();
    const walletAddress = normalizeWalletAddress(
      data.walletAddress ?? generatedWallet?.address ?? ""
    );
    const student = await prisma.student.create({
      data: {
        ...data,
        walletAddress,
        walletPrivateKey: generatedWallet?.privateKey ?? null,
        active: data.active ?? true
      },
      include: {
        university: true,
        _count: {
          select: {
            credentials: true
          }
        }
      }
    });
    const existingUser = await prisma.user.findUnique({
      where: { walletAddress }
    });

    if (!existingUser) {
      await prisma.user.create({
        data: {
          walletAddress,
          role: "STUDENT",
          studentId: student.id
        }
      });
    } else if (
      existingUser.role === "VERIFIER" &&
      existingUser.verifierName === "External Verifier"
    ) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: "STUDENT",
          verifierName: null,
          studentId: student.id
        }
      });
    }
    await writeAuditLog({
      actor: user,
      action: "student.create",
      targetType: "Student",
      targetId: student.id,
      metadata: {
        universityId: student.universityId,
        walletAddress: student.walletAddress,
        walletGenerated: Boolean(generatedWallet)
      }
    });

    return NextResponse.json(
      {
        student,
        walletGenerated: Boolean(generatedWallet),
        generatedWalletPrivateKey: generatedWallet?.privateKey ?? null
      },
      { status: 201 }
    );
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Unable to create student. Check university and wallet details." },
      { status: 400 }
    );
  }
}
