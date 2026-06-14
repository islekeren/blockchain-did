import { expect } from "chai";

import "./helpers/module";
import { clearModule, installModuleMocks } from "./helpers/module";
import { issuerWallet } from "./helpers/fixtures";

type SessionModule = typeof import("../src/lib/auth/session");

function loadSessionWithDbUser(user: unknown) {
  const restore = installModuleMocks({
    "@/lib/db/prisma": {
      prisma: {
        user: {
          findUnique: async () => user
        }
      }
    }
  });

  clearModule("./src/lib/auth/session");

  const session = require("../src/lib/auth/session") as SessionModule;

  return { session, restore };
}

function requestWithSessionCookie(cookieName: string, token: string) {
  return new Request("http://localhost/api/protected", {
    headers: {
      cookie: `${cookieName}=${encodeURIComponent(token)}`
    }
  });
}

describe("authorization", function () {
  beforeEach(function () {
    process.env.AUTH_SESSION_SECRET = "unit-test-session-secret";
  });

  it("loads the current user from a valid signed session cookie", async function () {
    const dbUser = {
      id: "user-1",
      walletAddress: issuerWallet.address,
      role: "ISSUER" as const,
      issuerId: "issuer-1",
      studentId: null,
      verifierName: null
    };
    const { session, restore } = loadSessionWithDbUser(dbUser);

    try {
      const token = session.createSessionToken(dbUser);
      const currentUser = await session.getCurrentUser(
        requestWithSessionCookie(session.SESSION_COOKIE_NAME, token)
      );

      expect(currentUser).to.deep.equal(dbUser);
    } finally {
      restore();
    }
  });

  it("rejects tampered session tokens", async function () {
    const dbUser = {
      id: "user-1",
      walletAddress: issuerWallet.address,
      role: "ISSUER" as const,
      issuerId: "issuer-1",
      studentId: null,
      verifierName: null
    };
    const { session, restore } = loadSessionWithDbUser(dbUser);

    try {
      const token = `${session.createSessionToken(dbUser)}tampered`;
      const currentUser = await session.getCurrentUser(
        requestWithSessionCookie(session.SESSION_COOKIE_NAME, token)
      );

      expect(currentUser).to.equal(null);
    } finally {
      restore();
    }
  });

  it("invalidates the session when the database role no longer matches", async function () {
    const tokenUser = {
      id: "user-1",
      walletAddress: issuerWallet.address,
      role: "ISSUER" as const,
      issuerId: "issuer-1",
      studentId: null,
      verifierName: null
    };
    const dbUser = {
      ...tokenUser,
      role: "STUDENT",
      issuerId: null,
      studentId: "student-1"
    };
    const { session, restore } = loadSessionWithDbUser(dbUser);

    try {
      const token = session.createSessionToken(tokenUser);
      const currentUser = await session.getCurrentUser(
        requestWithSessionCookie(session.SESSION_COOKIE_NAME, token)
      );

      expect(currentUser).to.equal(null);
    } finally {
      restore();
    }
  });

  it("throws a 403 AuthError when the signed-in role is not allowed", async function () {
    const dbUser = {
      id: "user-1",
      walletAddress: issuerWallet.address,
      role: "ISSUER" as const,
      issuerId: "issuer-1",
      studentId: null,
      verifierName: null
    };
    const { session, restore } = loadSessionWithDbUser(dbUser);

    try {
      const token = session.createSessionToken(dbUser);
      const request = requestWithSessionCookie(session.SESSION_COOKIE_NAME, token);

      try {
        await session.requireRole(request, ["ADMIN"]);
        expect.fail("Expected requireRole to throw");
      } catch (error) {
        expect(error).to.be.instanceOf(session.AuthError);
        expect((error as InstanceType<typeof session.AuthError>).status).to.equal(
          403
        );
      }
    } finally {
      restore();
    }
  });
});
