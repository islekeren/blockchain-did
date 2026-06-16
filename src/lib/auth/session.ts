import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { normalizeWalletAddress } from "@/lib/blockchain/address";
import { prisma } from "@/lib/db/prisma";
import { isUserRole, type UserRole } from "./roles";

export const SESSION_COOKIE_NAME = "svw_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

type SessionPayload = {
  userId: string;
  walletAddress: string;
  role: UserRole;
  exp: number;
};

export type CurrentUser = {
  id: string;
  walletAddress: string;
  role: UserRole;
  issuerId: string | null;
  studentId: string | null;
  verifierName: string | null;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 401
  ) {
    super(message);
  }
}

function getSessionSecret() {
  return (
    process.env.AUTH_SESSION_SECRET ??
    "development-student-verification-wallet-secret-change-me"
  );
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function signaturesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  const cookies = header
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean);

  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = cookie.slice(0, separator);
    const value = cookie.slice(separator + 1);

    if (key === name) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

export function createSessionToken(user: CurrentUser) {
  const payload: SessionPayload = {
    userId: user.id,
    walletAddress: normalizeWalletAddress(user.walletAddress),
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || !signaturesMatch(sign(encodedPayload), signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<SessionPayload>;

    if (
      typeof payload.userId !== "string" ||
      typeof payload.walletAddress !== "string" ||
      typeof payload.exp !== "number" ||
      typeof payload.role !== "string" ||
      !isUserRole(payload.role) ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      walletAddress: normalizeWalletAddress(payload.walletAddress),
      role: payload.role,
      exp: payload.exp
    };
  } catch {
    return null;
  }
}

export async function getCurrentUserFromToken(
  token: string | null
): Promise<CurrentUser | null> {
  if (!token) {
    return null;
  }

  const payload = verifySessionToken(token);

  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId }
  });

  if (
    !user ||
    !isUserRole(user.role) ||
    normalizeWalletAddress(user.walletAddress) !== payload.walletAddress ||
    user.role !== payload.role
  ) {
    return null;
  }

  return {
    id: user.id,
    walletAddress: normalizeWalletAddress(user.walletAddress),
    role: user.role,
    issuerId: user.issuerId,
    studentId: user.studentId,
    verifierName: user.verifierName
  };
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getCurrentUser(request: Request): Promise<CurrentUser | null> {
  return getCurrentUserFromToken(readCookie(request, SESSION_COOKIE_NAME));
}

export async function requireUser(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) {
    throw new AuthError("Sign in with a registered wallet first.", 401);
  }

  return user;
}

export async function requireRole(request: Request, roles: readonly UserRole[]) {
  const user = await requireUser(request);

  if (!roles.includes(user.role)) {
    throw new AuthError("Your wallet role is not allowed to perform this action.", 403);
  }

  return user;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return null;
}
