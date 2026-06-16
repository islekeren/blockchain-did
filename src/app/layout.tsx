import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Decentralized Student Verification Wallet",
  description:
    "DID and Verifiable Credential course project for student discount verification."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
