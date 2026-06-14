import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createWalletAuthMessage, recoverWalletAuthSigner } from "@/lib/auth/message";
import { serializeUser } from "@/lib/auth/serialize";
import {
  createSessionToken,
  setSessionCookie,
  type CurrentUser
} from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";
import { normalizeWalletAddress } from "@/lib/blockchain/address";
import { prisma } from "@/lib/db/prisma";
import { walletAuthVerifySchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

const NONCE_TTL_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const data = walletAuthVerifySchema.parse(await request.json());
    const walletAddress = normalizeWalletAddress(data.walletAddress);
    const user = await prisma.user.findUnique({
      where: { walletAddress }
    });

    if (!user?.nonce || !user.nonceExpiresAt || user.nonceExpiresAt <= new Date()) {
      return NextResponse.json(
        { error: "Sign-in nonce is missing or expired." },
        { status: 400 }
      );
    }

    const issuedAt = new Date(user.nonceExpiresAt.getTime() - NONCE_TTL_MS);
    const expectedMessage = createWalletAuthMessage({
      walletAddress,
      nonce: user.nonce,
      issuedAt
    });

    if (data.message !== expectedMessage) {
      return NextResponse.json(
        { error: "Signed message does not match the current sign-in nonce." },
        { status: 400 }
      );
    }

    const recoveredAddress = recoverWalletAuthSigner(data.message, data.signature);

    if (recoveredAddress !== walletAddress) {
      return NextResponse.json(
        { error: "Signature was not produced by the requested wallet." },
        { status: 401 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        nonce: null,
        nonceExpiresAt: null,
        lastLoginAt: new Date()
      },
      include: {
        issuer: true,
        student: true
      }
    });
    const currentUser: CurrentUser = {
      id: updatedUser.id,
      walletAddress: normalizeWalletAddress(updatedUser.walletAddress),
      role: updatedUser.role as CurrentUser["role"],
      issuerId: updatedUser.issuerId,
      studentId: updatedUser.studentId,
      verifierName: updatedUser.verifierName
    };

    await writeAuditLog({
      actor: currentUser,
      action: "wallet.login",
      targetType: "User",
      targetId: updatedUser.id,
      metadata: {
        walletAddress
      }
    });

    const response = NextResponse.json({ user: serializeUser(updatedUser) });
    setSessionCookie(response, createSessionToken(currentUser));

    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to verify wallet signature" }, { status: 400 });
  }
}
