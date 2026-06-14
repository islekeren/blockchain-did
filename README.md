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

Import the local development accounts printed by `npm run hardhat:node`. The contract owner is the account that deploys the contract, normally Hardhat account #0:

```text
Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Use another Hardhat account as a demo issuer wallet, for example account #1:

```text
Address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Private key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

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

Credential JSON is stored as a string for SQLite compatibility and returned as parsed JSON by the API.

## Implemented Features

- Landing page with role cards and dashboard entry points
- Admin issuer dashboard
  - list issuers from SQLite
  - add issuers
  - remove issuers
  - toggle local trusted status
  - connect MetaMask
  - register/remove issuers on-chain with the contract owner wallet
  - register/check the `StudentCredential` schema on-chain
- Issuer dashboard
  - list students from SQLite
  - add students
  - activate/deactivate students
  - issue credentials only for active students
  - store minimal VC-like JSON and deterministic hash
  - register credential hashes on-chain with a trusted issuer wallet
  - revoke credential hashes on-chain with the original issuer wallet
  - mark the local credential status as `REVOKED` after successful on-chain revocation
- Student wallet
  - select a student
  - view credentials for that student
  - copy minimal credential JSON
  - paste verifier challenge JSON
  - connect MetaMask with the student wallet
  - sign a deterministic presentation message
  - copy presentation proof JSON
- Verifier dashboard
  - generate 10-minute verification challenges
  - select or paste a credential
  - paste presentation proof JSON
  - approve/reject using local off-chain checks
  - run on-chain issuer, schema, registration, revocation, and issuer-match checks
  - verify holder signature, nonce, expiry, and replay status
  - approve only when off-chain, on-chain, and holder proof checks pass
  - persist verification request results

## Credential Privacy

The database stores student profile fields such as name, student number, and department for issuer workflows.

The credential payload shown to the verifier intentionally omits student name, student number, department, and national identity-like fields. The default credential subject contains only DID-style wallet identity, database student id, active student status, and university name.

## Canonical Hashing

Credential hashes are generated in [src/lib/credential/hash.ts](src/lib/credential/hash.ts) with `ethers` `keccak256` over ABI-encoded canonical credential fields.

The Solidity registry stores the resulting `bytes32` hash. It does not store private student profile data or full credential JSON.

The verifier compares the presented credential payload hash against the stored database hash before running on-chain checks.

## Holder Presentation Proofs

The verifier no longer accepts a valid credential JSON by itself. The verifier first creates a short-lived challenge containing:

- `requestId`
- `nonce`
- `verifierName`
- `createdAt`
- `expiresAt`

The student opens the wallet page, pastes that challenge, and signs a deterministic human-readable message with MetaMask:

```text
Student Verification Presentation

Credential ID: ...
Credential Hash: ...
Student Wallet: ...
Verifier: ...
Request ID: ...
Nonce: ...
```

The wallet returns presentation proof JSON containing the credential id, credential hash, student wallet address, request id, nonce, verifier name, exact signed message, and signature.

The verifier checks that the proof matches the credential, the request exists, the nonce matches, the request is not expired, the request has not already been used, the student wallet matches the credential subject DID, the signature recovers to that wallet, and the signed message reconstructs exactly.

Replay prevention is handled by 10-minute challenge expiry plus a `used` flag. A request is marked used only after credential checks, on-chain checks, and holder proof checks all pass. Reusing the same proof/request is rejected.

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
5. Import Hardhat account #0 and connect it in **Admin** as the contract owner.
6. In **Admin**, create or choose an issuer whose wallet address is a MetaMask-imported Hardhat account, such as account #1.
7. Register that issuer on-chain and register the `StudentCredential` schema on-chain.
8. Switch MetaMask to the issuer wallet.
9. In **Issuer**, create/activate a student for that issuer and issue a credential in the database.
10. Register the credential hash on-chain.
11. In **Verifier**, generate a verification challenge and copy the challenge JSON.
12. In **Wallet**, select the student credential, paste the challenge, connect the student wallet, and create a presentation proof.
13. Copy both the credential JSON and the presentation proof JSON.
14. In **Verifier**, paste/select the credential and paste the proof, then verify. It is **Approved** only if off-chain checks, on-chain checks, and holder proof checks pass.
15. Verify again with the same proof/request and observe a **Rejected** result because the request is already used.
16. Try signing from the wrong wallet and observe a **Rejected** result because the recovered signer does not match the credential subject wallet.
17. Back in **Issuer**, revoke the credential on-chain. The local DB credential status is updated to `REVOKED`.
18. Generate a fresh challenge/proof and verify again; observe a **Rejected** result because the credential is revoked.

Seeded issuers are useful for local database demos, but their toy wallet addresses are not Hardhat signer accounts. For on-chain write demos, create an issuer that uses an imported Hardhat account address.

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
