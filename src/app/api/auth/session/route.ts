import { NextResponse } from "next/server";

import { serializeUser } from "@/lib/auth/serialize";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser(request);

  if (!currentUser) {
    return NextResponse.json({ user: null });
  }

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    include: {
      issuer: true,
      student: true
    }
  });

  return NextResponse.json({ user: user ? serializeUser(user) : null });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);

  return response;
}
