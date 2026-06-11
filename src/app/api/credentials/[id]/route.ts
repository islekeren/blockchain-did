import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { serializeCredential } from "@/lib/credential/serialize";
import { prisma } from "@/lib/db/prisma";
import { updateCredentialSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const data = updateCredentialSchema.parse(await request.json());
    const credential = await prisma.credential.update({
      where: { id },
      data,
      include: {
        student: {
          include: {
            university: true
          }
        },
        issuer: true
      }
    });

    return NextResponse.json({ credential: serializeCredential(credential) });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }
}
