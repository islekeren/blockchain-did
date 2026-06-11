type CredentialRecord = {
  credentialJson: string;
  issuedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
};

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export function serializeCredential(record: CredentialRecord) {
  return {
    ...record,
    credentialJson: safeJsonParse(record.credentialJson),
    issuedAt: record.issuedAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeCredentials(records: CredentialRecord[]) {
  return records.map(serializeCredential);
}
