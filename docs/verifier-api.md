# Verifier API Integration Guide

This document describes how a verifier-side application, such as a student discount platform, integrates with the Student Verification Wallet API.

The verifier creates a verification request, redirects the student to the wallet approval page, and later reads the verification result.

## Environment

Local demo base URL:

```text
http://127.0.0.1:3000
```

If the local dev server chooses another port, use that port instead.

Production-style base URL:

```text
https://student-wallet.example.com
```

All examples below use:

```text
{BASE_URL}
```

## Authentication

The current demo supports wallet-based verifier login in the dashboard. The request creation and compact result endpoints are shaped for external verifier integrations.

In a production deployment, verifier-to-wallet API calls should be protected with an API key, OAuth client credentials, or signed partner requests. A typical production header would look like:

```http
Authorization: Bearer <verifier_api_key>
Content-Type: application/json
```

The local demo does not yet enforce external API keys.

## Integration Flow

1. Your platform creates a verification request with `POST /api/verifier/requests`.
2. The API returns a `walletRedirectUrl`.
3. Redirect the student to `{BASE_URL}{walletRedirectUrl}`.
4. The student reviews the request and approves with their wallet.
5. The wallet backend verifies off-chain credential state, on-chain registry state, issuer proof, and holder presentation proof.
6. Your platform reads the result from `GET /api/verifier/requests/{requestId}/result`.
7. If `callbackUrl` is supplied, store it as partner metadata. Callback delivery is reserved for a later production phase.

## Status Values

| Status | Meaning |
| --- | --- |
| `PENDING` | Request was created and is waiting for student approval. |
| `APPROVED` | All off-chain, on-chain, issuer proof, and holder proof checks passed. |
| `REJECTED` | At least one required check failed, or the request was invalid/already used. |
| `EXPIRED` | Request was still pending after its expiration time. |

Requests expire 10 minutes after creation.

## Create Verification Request

Creates a request for a student credential verification.

```http
POST {BASE_URL}/api/verifier/requests
Content-Type: application/json
```

Request body:

```json
{
  "verifierName": "Spotify Student Discount",
  "callbackUrl": "https://discount.example.com/student-verification/callback",
  "requestedCredentialType": "StudentCredential"
}
```

Fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `verifierName` | string | yes | Display name shown to the student in the wallet approval page. |
| `callbackUrl` | string | no | Partner callback URL stored with the request. Callback execution is not active in this phase. |
| `requestedCredentialType` | string | yes | Credential type requested from the student. Use `StudentCredential`. |

Success response:

```json
{
  "requestId": "1f56d16e-6d2c-4f3a-a34d-9e8a8a60a2fd",
  "nonce": "3214c10f-92d2-49df-9893-9656912f4f70",
  "verifierName": "Spotify Student Discount",
  "requestedCredentialType": "StudentCredential",
  "expiresAt": "2026-06-16T19:10:00.000Z",
  "walletRedirectUrl": "/wallet/present?requestId=1f56d16e-6d2c-4f3a-a34d-9e8a8a60a2fd"
}
```

Example:

```bash
curl -sS -X POST "{BASE_URL}/api/verifier/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "verifierName": "Spotify Student Discount",
    "callbackUrl": "https://discount.example.com/student-verification/callback",
    "requestedCredentialType": "StudentCredential"
  }'
```

After receiving the response, redirect the student to:

```text
{BASE_URL}/wallet/present?requestId=1f56d16e-6d2c-4f3a-a34d-9e8a8a60a2fd
```

## Get Compact Result

Returns the result shape intended for verifier-side backend polling.

```http
GET {BASE_URL}/api/verifier/requests/{requestId}/result
```

Success response while pending:

```json
{
  "requestId": "1f56d16e-6d2c-4f3a-a34d-9e8a8a60a2fd",
  "status": "PENDING",
  "verifiedAt": null,
  "checks": {
    "offChain": [],
    "onChain": [],
    "holderProof": []
  }
}
```

Success response after verification:

```json
{
  "requestId": "1f56d16e-6d2c-4f3a-a34d-9e8a8a60a2fd",
  "status": "APPROVED",
  "verifiedAt": "2026-06-16T19:03:20.000Z",
  "checks": {
    "offChain": [
      {
        "label": "Credential exists",
        "passed": true,
        "detail": "Matched database credential credential-..."
      }
    ],
    "onChain": [
      {
        "label": "Credential hash registered on-chain",
        "passed": true,
        "detail": "Credential hash 0x... is registered"
      }
    ],
    "holderProof": [
      {
        "label": "Presentation signature recovers student wallet",
        "passed": true,
        "detail": "Recovered 0x...; expected 0x..."
      }
    ]
  }
}
```

Example:

```bash
curl -sS "{BASE_URL}/api/verifier/requests/1f56d16e-6d2c-4f3a-a34d-9e8a8a60a2fd/result"
```

Recommended polling behavior:

- Poll every 3-5 seconds while the request is `PENDING`.
- Stop polling once status is `APPROVED`, `REJECTED`, or `EXPIRED`.
- Treat requests as expired after `expiresAt` if your backend stores the create response.

## Get Full Request Details

Returns full request metadata and stored check results.

```http
GET {BASE_URL}/api/verifier/requests/{requestId}
```

This endpoint is useful for internal dashboards or support tools.

Response:

```json
{
  "request": {
    "requestId": "1f56d16e-6d2c-4f3a-a34d-9e8a8a60a2fd",
    "credentialId": null,
    "verifierName": "Spotify Student Discount",
    "callbackUrl": "https://discount.example.com/student-verification/callback",
    "requestedCredentialType": "StudentCredential",
    "nonce": "3214c10f-92d2-49df-9893-9656912f4f70",
    "status": "PENDING",
    "result": "PENDING",
    "used": false,
    "expiresAt": "2026-06-16T19:10:00.000Z",
    "verifiedAt": null,
    "createdAt": "2026-06-16T19:00:00.000Z",
    "updatedAt": "2026-06-16T19:00:00.000Z",
    "walletRedirectUrl": "/wallet/present?requestId=1f56d16e-6d2c-4f3a-a34d-9e8a8a60a2fd",
    "checkResults": {
      "offChain": [],
      "onChain": [],
      "holderProof": []
    }
  }
}
```

## List Recent Requests

Returns recent verification requests for the verifier dashboard.

```http
GET {BASE_URL}/api/verifier/requests
```

In the current app, this endpoint requires an authenticated verifier dashboard session.

Response:

```json
{
  "requests": [
    {
      "requestId": "1f56d16e-6d2c-4f3a-a34d-9e8a8a60a2fd",
      "verifierName": "Spotify Student Discount",
      "requestedCredentialType": "StudentCredential",
      "status": "PENDING",
      "createdAt": "2026-06-16T19:00:00.000Z",
      "expiresAt": "2026-06-16T19:10:00.000Z",
      "verifiedAt": null,
      "walletRedirectUrl": "/wallet/present?requestId=1f56d16e-6d2c-4f3a-a34d-9e8a8a60a2fd",
      "checkResults": {
        "offChain": [],
        "onChain": [],
        "holderProof": []
      }
    }
  ]
}
```

## Presentation Submission

Student presentation submission is normally performed by the wallet approval page after the student signs with MetaMask.

```http
POST {BASE_URL}/api/verifier/requests/{requestId}/presentation
Content-Type: application/json
```

Verifier-side developers usually do not call this endpoint directly. It is documented here for completeness.

Request body:

```json
{
  "credentialId": "credential-...",
  "presentationProof": {
    "credentialId": "credential-...",
    "credentialHash": "0x...",
    "studentWalletAddress": "0x...",
    "requestId": "1f56d16e-6d2c-4f3a-a34d-9e8a8a60a2fd",
    "nonce": "3214c10f-92d2-49df-9893-9656912f4f70",
    "verifierName": "Spotify Student Discount",
    "message": "Student Verification Presentation\n\nCredential ID: ...",
    "signature": "0x..."
  }
}
```

## Error Format

Errors return JSON:

```json
{
  "error": "Verification request not found"
}
```

Common HTTP statuses:

| Status | Meaning |
| --- | --- |
| `400` | Invalid request body, expired request, already used request, or failed validation. |
| `401` | Authentication required for dashboard or wallet-only operations. |
| `403` | Authenticated wallet role is not allowed to perform the operation. |
| `404` | Request ID does not exist. |

## Data Privacy

The verifier result is designed to answer eligibility, not expose full student identity.

The checks may reveal:

- active student status
- university name
- credential expiration status
- credential registry status
- holder proof status

The verifier flow should not require student name, student number, department, or national identity-like fields.

## Production Recommendations

Before deploying this flow with real verifier partners:

- Require API authentication for external verifier request creation and result polling.
- Restrict request/result access by verifier account or partner API key.
- Validate `callbackUrl` against allowlisted partner domains.
- Add webhook delivery with signed callback payloads.
- Add rate limits per verifier.
- Store partner IDs separately from display names.
- Use HTTPS only.
- Keep request expiry short.
- Treat `APPROVED` as a point-in-time eligibility result, not a permanent student status.
- Log request creation, student approval, verification result, and result polling for auditability.

