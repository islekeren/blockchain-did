# Decentralized Student Verification Wallet

Initial Next.js foundation for a course project: **Decentralized Student Verification Wallet Using DID and Verifiable Credentials**.

The app models four roles in a student discount verification flow:

- **Admin** manages trusted university issuers.
- **University / Issuer** manages students and issues student credentials.
- **Student / Holder** views minimal credential JSON in a wallet-like page.
- **Discount Platform / Verifier** approves or rejects credentials using local off-chain checks.

This phase intentionally does **not** include Solidity contracts, blockchain writes, MetaMask, DID resolver integration, ZK proofs, or a production VC library.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Prisma ORM
- SQLite for local development
- ethers.js for deterministic placeholder credential hashing
- ESLint and Prettier

## Setup

```bash
npm install
```

Create and seed the local SQLite database:

```bash
npm run db:migrate
```

The migration command also runs the seed script. To reseed an existing database:

```bash
npm run db:seed
```

Start the app:

```bash
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Database

Prisma schema lives in [prisma/schema.prisma](prisma/schema.prisma).

Seed data includes:

- Ankara University, trusted issuer
- Fake University, untrusted issuer
- Five students with mixed active/inactive status
- A valid issued credential
- An expired/inactive credential
- A sample verifier request record

Credential JSON is stored as a string for SQLite compatibility and returned as parsed JSON by the API.

## Implemented Features

- Landing page with role cards and dashboard entry points
- Admin issuer dashboard
  - list issuers from SQLite
  - add issuers
  - remove issuers
  - toggle local trusted status
  - disabled blockchain registry placeholders
- Issuer dashboard
  - list students from SQLite
  - add students
  - activate/deactivate students
  - issue credentials only for active students
  - store minimal VC-like JSON and deterministic hash
- Student wallet
  - select a student
  - view credentials for that student
  - copy minimal credential JSON
  - disabled wallet signing placeholder
- Verifier dashboard
  - select or paste a credential
  - approve/reject using local checks
  - persist verification request results
  - disabled future blockchain/signature checks

## Credential Privacy

The database stores student profile fields such as name, student number, and department for issuer workflows.

The credential payload shown to the verifier intentionally omits student name, student number, department, and national identity-like fields. The default credential subject contains only DID-style wallet identity, database student id, active student status, and university name.

## Placeholder Hashing

Credential hashes are generated in [src/lib/credential/hash.ts](src/lib/credential/hash.ts) with `ethers` `keccak256` over ABI-encoded canonical credential fields.

This is still a placeholder, but it is shaped for the next Solidity phase: the contract can reproduce the same hash with `keccak256(abi.encode(...))` over the same ordered fields.

The verifier also compares the presented credential payload hash against the stored database hash before returning **Approved**. Later, that same hash can be checked against the on-chain credential registry.

## Future Blockchain TODOs

Placeholder functions live in [src/lib/blockchain/registryClient.ts](src/lib/blockchain/registryClient.ts):

- `addIssuerOnChain()`
- `registerSchemaOnChain()`
- `registerCredentialHashOnChain()`
- `revokeCredentialOnChain()`
- `isTrustedIssuerOnChain()`
- `isCredentialRevokedOnChain()`

For now, these functions throw `Blockchain integration not implemented yet`, and the UI only shows disabled TODO controls.

Blockchain configuration placeholders use server-side environment variables:

```bash
CHAIN_ID=""
RPC_URL=""
ISSUER_REGISTRY_ADDRESS=""
CREDENTIAL_REGISTRY_ADDRESS=""
```

## Demo Flow

1. Open the landing page.
2. Go to **Admin** and view trusted/untrusted issuers.
3. Go to **Issuer**, create or activate a student, then issue a credential.
4. Go to **Wallet**, select the student, and copy/view credential JSON.
5. Go to **Verifier**, select or paste a credential.
6. Observe **Approved** for a valid issued credential or **Rejected** for expired/inactive/untrusted cases.

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npm run db:migrate
npm run db:seed
npm run db:reset
```
