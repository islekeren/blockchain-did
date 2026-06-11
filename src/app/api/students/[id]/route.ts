import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/db/prisma";
import { updateStudentSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const data = updateStudentSchema.parse(await request.json());
    const student = await prisma.student.update({
      where: { id },
      data,
      include: {
        university: true,
        _count: {
          select: {
            credentials: true
          }
        }
      }
    });

    return NextResponse.json({ student });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
}
