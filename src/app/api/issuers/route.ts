import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { normalizeEthrDid, normalizeWalletAddress } from "@/lib/blockchain/address";
import { prisma } from "@/lib/db/prisma";
import { createIssuerSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function GET() {
  const issuers = await prisma.issuer.findMany({
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
}

export async function POST(request: Request) {
  try {
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

    return NextResponse.json({ issuer }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Unable to create issuer. Check DID and wallet uniqueness." },
      { status: 400 }
    );
  }
}
