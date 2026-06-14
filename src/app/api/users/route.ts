import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { serializeUser } from "@/lib/auth/serialize";
import { authErrorResponse, requireRole } from "@/lib/auth/session";
import { normalizeWalletAddress } from "@/lib/blockchain/address";
import { prisma } from "@/lib/db/prisma";
import { createUserSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireRole(request, ["ADMIN"]);
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        issuer: true,
        student: true
      }
    });

    return NextResponse.json({ users: users.map(serializeUser) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unable to load users" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole(request, ["ADMIN"]);
    const data = createUserSchema.parse(await request.json());
    const walletAddress = normalizeWalletAddress(data.walletAddress);
    const user = await prisma.user.upsert({
      where: { walletAddress },
      update: {
        role: data.role,
        issuerId: data.issuerId ?? null,
        studentId: data.studentId ?? null,
        verifierName: data.verifierName ?? null
      },
      create: {
        walletAddress,
        role: data.role,
        issuerId: data.issuerId ?? null,
        studentId: data.studentId ?? null,
        verifierName: data.verifierName ?? null
      },
      include: {
        issuer: true,
        student: true
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorWallet: actor.walletAddress,
        actorRole: actor.role,
        action: "user.upsert",
        targetType: "User",
        targetId: user.id,
        metadata: JSON.stringify({
          walletAddress,
          role: data.role
        })
      }
    });

    return NextResponse.json({ user: serializeUser(user) }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to save user role" }, { status: 400 });
  }
}
