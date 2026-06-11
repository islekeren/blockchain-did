import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { normalizeWalletAddress } from "@/lib/blockchain/address";
import { prisma } from "@/lib/db/prisma";
import { createStudentSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function GET() {
  const students = await prisma.student.findMany({
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
}

export async function POST(request: Request) {
  try {
    const data = createStudentSchema.parse(await request.json());
    const student = await prisma.student.create({
      data: {
        ...data,
        walletAddress: normalizeWalletAddress(data.walletAddress),
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

    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Unable to create student. Check university and wallet details." },
      { status: 400 }
    );
  }
}
