import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { writeAuditLog } from "@/lib/audit/log";
import { authErrorResponse, requireRole, requireUser } from "@/lib/auth/session";
import { normalizeEthrDid, normalizeWalletAddress } from "@/lib/blockchain/address";
import { prisma } from "@/lib/db/prisma";
import { createIssuerSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const issuers = await prisma.issuer.findMany({
      where:
        user.role === "ADMIN"
          ? undefined
          : user.role === "ISSUER" && user.issuerId
            ? { id: user.issuerId }
            : user.role === "VERIFIER"
              ? { trusted: true }
              : { id: "__none__" },
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: {
            students: true,
            credentials: true
          }
        }
      }
    });

    return NextResponse.json({ issuers });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unable to load issuers" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(request, ["ADMIN"]);
    const data = createIssuerSchema.parse(await request.json());
    const walletAddress = normalizeWalletAddress(data.walletAddress);
    const issuer = await prisma.issuer.create({
      data: {
        ...data,
        did: normalizeEthrDid(data.did, walletAddress),
        walletAddress,
        trusted: data.trusted ?? false
      }
    });
    await writeAuditLog({
      actor: user,
      action: "issuer.create",
      targetType: "Issuer",
      targetId: issuer.id,
      metadata: {
        walletAddress,
        trusted: issuer.trusted
      }
    });

    return NextResponse.json({ issuer }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Unable to create issuer. Check DID and wallet uniqueness." },
      { status: 400 }
    );
  }
}
