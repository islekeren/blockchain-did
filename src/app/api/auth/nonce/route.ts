import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createWalletAuthMessage } from "@/lib/auth/message";
import { serializeUser } from "@/lib/auth/serialize";
import { normalizeWalletAddress } from "@/lib/blockchain/address";
import { prisma } from "@/lib/db/prisma";
import { walletAuthNonceSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

const NONCE_TTL_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const data = walletAuthNonceSchema.parse(await request.json());
    const walletAddress = normalizeWalletAddress(data.walletAddress);
    const issuedAt = new Date();
    const nonceExpiresAt = new Date(issuedAt.getTime() + NONCE_TTL_MS);
    const nonce = crypto.randomUUID();

    const user = await prisma.user.upsert({
      where: { walletAddress },
      update: {
        nonce,
        nonceExpiresAt
      },
      create: {
        walletAddress,
        role: "VERIFIER",
        verifierName: "External Verifier",
        nonce,
        nonceExpiresAt
      }
    });

    return NextResponse.json({
      user: serializeUser(user),
      message: createWalletAuthMessage({
        walletAddress,
        nonce,
        issuedAt
      }),
      expiresAt: nonceExpiresAt.toISOString()
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to create sign-in nonce" }, { status: 400 });
  }
}
