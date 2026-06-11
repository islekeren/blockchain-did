import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/db/prisma";
import { updateIssuerSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const data = updateIssuerSchema.parse(await request.json());
    const issuer = await prisma.issuer.update({
      where: { id },
      data
    });

    return NextResponse.json({ issuer });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Issuer not found" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    await prisma.$transaction([
      prisma.credential.deleteMany({ where: { issuerId: id } }),
      prisma.student.deleteMany({ where: { universityId: id } }),
      prisma.issuer.delete({ where: { id } })
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Issuer not found" }, { status: 404 });
  }
}
