# Decentralized Student Verification Wallet

Next.js foundation and Solidity registry layer for a course project: **Decentralized Student Verification Wallet Using DID and Verifiable Credentials**.

The app models four roles in a student discount verification flow:

- **Admin** manages trusted university issuers.
- **University / Issuer** manages students and issues student credentials.
- **Student / Holder** views minimal credential JSON in a wallet-like page.
- **Discount Platform / Verifier** approves or rejects credentials using local off-chain checks plus on-chain registry checks.

This phase includes Solidity/Hardhat registry artifacts and MetaMask-based frontend integration for the local Hardhat network. It intentionally does **not** add production auth, DID resolver integration, ZK proofs, production VC libraries, or private-key handling in frontend environment variables.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Prisma ORM
- SQLite for local development
- ethers.js for canonical credential hashing and MetaMask contract calls
- Solidity smart contract registry
- Hardhat local blockchain tooling
- OpenZeppelin Ownable access control
- ESLint and Prettier

## Setup

```bash
npm install
```

Create a local environment file from [.env.example](.env.example). The demo
defaults to Hardhat Local, while backend verification reads the registry through
`SERVER_RPC_URL` and `REGISTRY_CONTRACT_ADDRESS` when those values are set.

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

## Blockchain Registry

The Solidity registry lives in [contracts/StudentVerificationRegistry.sol](contracts/StudentVerificationRegistry.sol).

It stores only minimal registry facts on-chain:

- trusted issuer wallet addresses
- issuer DID strings
- valid credential schema hashes
- schema names
- registered credential hashes
- the wallet address that registered each credential hash
- revoked credential hash flags

The following data remains off-chain in Prisma/API/UI flows:

- student profile data
- credential JSON payloads
- verifier request history
- local trusted/untrusted issuer records used by the current UI
- credential display and copy workflows
- DID resolution, wallet signatures, VC library validation, and proof logic

### Registry Responsibilities

**Issuer registry:** the contract owner can add or remove trusted issuer wallet addresses and store each issuer DID. Removed issuers are no longer trusted and cannot register new credential hashes.

**Schema registry:** the contract owner can register schema hashes with readable schema names. This gives the app a future on-chain allowlist for credential formats without putting full schemas on-chain.

**Credential registry:** trusted issuers can register deterministic credential hashes. The contract records the original issuer address for each hash and rejects duplicate registrations.

**Revocation registry:** the original credential issuer can revoke its own registered credential hash. A removed issuer is still allowed to revoke credentials it issued before removal so stale credentials can be invalidated even after trust is withdrawn.

### Hardhat Commands

Compile the contract:

```bash
npm run hardhat:compile
```

Run the Solidity tests:

```bash
npm run hardhat:test
```

Start a local Hardhat node:

```bash
npm run hardhat:node
```

In another terminal, deploy to the local node:

```bash
npm run hardhat:deploy:local
```

Local deployment writes:

- [src/lib/blockchain/deployment.json](src/lib/blockchain/deployment.json)
- [src/lib/blockchain/StudentVerificationRegistry.abi.json](src/lib/blockchain/StudentVerificationRegistry.abi.json)

The generated `deployment.json` contains the localhost chain id, deployed contract address, contract name, and deployment timestamp. The ABI JSON is copied from the compiled Hardhat artifact and loaded by the frontend ethers.js client.

### MetaMask Local Network

Add a custom MetaMask network for local Hardhat:

- Network name: `Hardhat Local`
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency symbol: `ETH`

Import the local development accounts printed by `npm run hardhat:node`.
The seeded login roles are mapped to these Hardhat accounts:

| Role | Page | Hardhat account | Address | Private key |
| --- | --- | --- | --- | --- |
| Admin | `/admin` | #0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Issuer | `/issuer` | #1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Student | `/wallet` | #2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| Verifier | `/verifier` | #3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |

On the login page, MetaMask shows the currently selected wallet address. For
example, `0xf39F...2266` is the seeded admin wallet. `No active session` means
the wallet is connected in MetaMask, but the app has not created a signed login
session yet. Switch accounts in MetaMask before signing in as a different role.
Unknown wallets can sign in, but they are created as external verifier users by
default and cannot open admin, issuer, or student pages unless a matching user
record exists.

These private keys are public Hardhat development keys. Never use them on mainnet or any live network.

## Database

Prisma schema lives in [prisma/schema.prisma](prisma/schema.prisma).

Seed data includes:

- Ankara University, trusted issuer
- Fake University, untrusted issuer
- Five students with mixed active/inactive status
- A valid issued credential
- An expired/inactive credential
- A sample verifier request record
- Wallet-auth demo users for Hardhat account #0 as admin, #1 as issuer,
  #2 as student, and #3 as verifier

Credential JSON is stored as a string for SQLite compatibility and returned as parsed JSON by the API.

## Implemented Features

- Wallet-based demo authentication
  - nonce challenge endpoint
  - MetaMask signature verification
  - signed HTTP-only session cookie
  - role mapping for admin, issuer, student, and verifier wallets
- API-level role authorization
  - admin-only issuer and user management
  - issuer-scoped student and credential issuance
  - student-scoped wallet credential reads
  - verifier-only challenge creation and verification
- Credential lifecycle and audit trail
  - credentials start as `PENDING_ONCHAIN`
  - successful hash registration marks credentials `ISSUED`
  - revocation stores tx hash, reason, and timestamp
  - authenticated actions and blockchain callbacks are recorded in `AuditLog`
- Landing page with role cards and dashboard entry points
- Admin issuer dashboard
  - list issuers from SQLite
  - add issuers
  - remove issuers
  - toggle local trusted status
  - connect MetaMask
  - sign in with a wallet-backed admin session
  - register/remove issuers on-chain with the contract owner wallet
  - register/check the `StudentCredential` schema on-chain
  - inspect recent audit logs
- Issuer dashboard
  - list students from SQLite
  - add students
  - activate/deactivate students
  - issue credentials only for active students as `PENDING_ONCHAIN`
  - store minimal VC-like JSON and deterministic hash
  - add an issuer wallet signature proof to credential JSON
  - register credential hashes on-chain with a trusted issuer wallet
  - mark local credentials `ISSUED` after successful on-chain registration
  - revoke credential hashes on-chain with the original issuer wallet
  - mark the local credential status as `REVOKED` with revocation metadata after successful on-chain revocation
- Student wallet
  - view the signed-in student's profile and credential wallet dashboard
  - view credential cards, statuses, and minimal credential JSON
  - copy minimal credential JSON
  - open verifier request redirects at `/wallet/present?requestId=...`
  - review shared and not-shared fields before approval
  - select an eligible issued, unexpired credential
  - approve with MetaMask and submit the presentation automatically
  - keep manual challenge/proof JSON tools in Advanced Debug Tools only
- Verifier dashboard
  - connect and sign in with the verifier MetaMask wallet
  - view recent verification requests, statuses, and result details
  - create demo verification requests that return wallet redirect URLs
  - approve/reject submitted presentations using backend local off-chain checks
  - run backend on-chain issuer, schema, registration, revocation, and issuer-match checks
  - verify holder signature, nonce, expiry, and replay status
  - approve only when off-chain, issuer proof, on-chain, and holder proof checks pass
  - persist verification request results
  - keep the manual JSON playground available at `/verifier/debug` for development/testing only

## Credential Privacy

The database stores student profile fields such as name, student number, and department for issuer workflows.

The credential payload shown to the verifier intentionally omits student name, student number, department, and national identity-like fields. The default credential subject contains only DID-style wallet identity, database student id, active student status, and university name.

## Canonical Hashing

Credential hashes are generated in [src/lib/credential/hash.ts](src/lib/credential/hash.ts) with `ethers` `keccak256` over ABI-encoded canonical credential fields.

The Solidity registry stores the resulting `bytes32` hash. It does not store private student profile data or full credential JSON.

The verifier compares the presented credential payload hash against the stored database hash before running on-chain checks.

## Holder Presentation Proofs

The verifier no longer accepts a valid credential JSON by itself. The verifier first creates a short-lived API request containing:

- `requestId`
- `nonce`
- `verifierName`
- `requestedCredentialType`
- `expiresAt`
- `walletRedirectUrl`

The student opens `walletRedirectUrl`, reviews the verifier name, requested credential type, expiration, request status, connected wallet, and the shared/not-shared field summary. Normal approval does not require copying or pasting challenge JSON.

After the student selects an eligible credential and clicks **Approve with Wallet**, the wallet signs the existing deterministic human-readable message with MetaMask:

```text
Student Verification Presentation

Credential ID: ...
Credential Hash: ...
Student Wallet: ...
Verifier: ...
Request ID: ...
Nonce: ...
```

The wallet builds presentation proof JSON containing the credential id, credential hash, student wallet address, request id, nonce, verifier name, exact signed message, and signature, then automatically posts it to `POST /api/verifier/requests/:requestId/presentation`.

The verifier checks that the proof matches the credential, the request exists, the nonce matches, the request is not expired, the request has not already been used, the student wallet matches the credential subject DID, the signature recovers to that wallet, and the signed message reconstructs exactly. The backend also verifies the issuer proof embedded in the credential JSON.

Replay prevention is handled by 10-minute challenge expiry plus a `used` flag. A request is marked used only after credential checks, issuer proof checks, backend on-chain checks, and holder proof checks all pass. Reusing the same proof/request is rejected.

## Verifier Integration Flow

The primary verifier flow is request based:

1. A verifier or external discount platform creates a request with `POST /api/verifier/requests`.
2. The API stores a 10-minute nonce-backed request and returns `walletRedirectUrl`, such as `/wallet/present?requestId=...`.
3. The student opens the redirect URL, reviews the verifier name, requested credential type, expiration, and shared eligibility facts.
4. The student selects an eligible issued credential and clicks **Approve with Wallet**.
5. The wallet page uses the existing MetaMask holder presentation proof logic, then submits `credentialId` and `presentationProof` automatically.
6. The backend verifies local off-chain credential state, on-chain registry state, issuer proof, and holder presentation proof checks.
7. The verifier checks the dashboard detail page or compact result API for `APPROVED`, `REJECTED`, `PENDING`, or computed `EXPIRED`.

Manual challenge JSON and manual proof JSON remain visible in wallet Advanced/Debug sections for transparency and troubleshooting. The old copy/paste verifier playground is available at `/verifier/debug` only for development/testing.

### Verifier API Endpoints

Create a request:

```http
POST /api/verifier/requests
Content-Type: application/json

{
  "verifierName": "Spotify Student Discount",
  "callbackUrl": "https://example.com/optional-callback",
  "requestedCredentialType": "StudentCredential"
}
```

Returns:

```json
{
  "requestId": "...",
  "nonce": "...",
  "verifierName": "Spotify Student Discount",
  "requestedCredentialType": "StudentCredential",
  "expiresAt": "...",
  "walletRedirectUrl": "/wallet/present?requestId=..."
}
```

List recent requests:

```http
GET /api/verifier/requests
```

Get request details:

```http
GET /api/verifier/requests/:requestId
```

Submit a student presentation:

```http
POST /api/verifier/requests/:requestId/presentation
Content-Type: application/json

{
  "credentialId": "...",
  "presentationProof": {
    "credentialId": "...",
    "credentialHash": "...",
    "studentWalletAddress": "...",
    "requestId": "...",
    "nonce": "...",
    "verifierName": "...",
    "message": "...",
    "signature": "..."
  }
}
```

Read the compact external result:

```http
GET /api/verifier/requests/:requestId/result
```

## Frontend Blockchain Integration

Frontend contract helpers live in [src/lib/blockchain/registryClient.ts](src/lib/blockchain/registryClient.ts). They use MetaMask through ethers.js and the generated deployment artifacts:

- `registerIssuerOnChain()`
- `removeIssuerOnChain()`
- `registerSchemaOnChain()`
- `registerCredentialHashOnChain()`
- `revokeCredentialOnChain()`
- `isTrustedIssuerOnChain()`
- `getIssuerDidOnChain()`
- `isSchemaValidOnChain()`
- `getSchemaNameOnChain()`
- `isCredentialRegisteredOnChain()`
- `getCredentialIssuerOnChain()`
- `isCredentialRevokedOnChain()`

Browser write calls use the MetaMask signer only. No private keys are stored in `NEXT_PUBLIC` environment variables.

## Demo Flow

1. Start the local Hardhat node: `npm run hardhat:node`.
2. Deploy the contract in another terminal: `npm run hardhat:deploy:local`.
3. Start the Next.js app: `npm run dev`.
4. Add Hardhat Local (`chainId` `31337`) to MetaMask.
5. Import Hardhat account #0, open **Admin**, connect MetaMask, and use **Sign in** to create the admin session.
6. Register the seeded Ankara University issuer on-chain and register the `StudentCredential` schema on-chain.
7. Switch MetaMask to Hardhat account #1, open **Issuer**, connect, sign in, and issue a credential. New credentials start as `PENDING_ONCHAIN`.
8. Register the credential hash on-chain. The dashboard signs an issuer proof, stores it in the credential JSON, and marks the credential `ISSUED` after the transaction succeeds.
9. Switch MetaMask to Hardhat account #3, open **Verifier**, connect, sign in, and create a demo verification request.
10. Copy or open the returned `walletRedirectUrl`.
11. Switch MetaMask to Hardhat account #2, open the wallet redirect URL, connect, sign in, select the issued credential, and click **Approve with Wallet**.
12. The wallet page signs the existing presentation message and submits the presentation automatically.
13. Return to `/verifier/requests/:requestId` and observe the final checks. It is **Approved** only if backend off-chain checks, issuer proof checks, backend on-chain checks, and holder proof checks pass.
14. Try approving again with the same request and observe a rejection because the request is already used.
15. Try signing from the wrong wallet and observe a **Rejected** result because the recovered signer does not match the credential subject wallet.
16. Back in **Issuer**, revoke the credential on-chain. The local DB credential status is updated to `REVOKED` with transaction metadata.
17. Create a fresh request and approve again; observe a **Rejected** result because the credential is revoked.

Seeded demo users are mapped to local Hardhat signer accounts so wallet auth, issuer proof signing, presentation signing, and on-chain writes can be demonstrated without creating extra records.

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npm run hardhat:compile
npm run hardhat:test
npm run hardhat:node
npm run hardhat:deploy:local
npm run db:migrate
npm run db:seed
npm run db:reset
```
