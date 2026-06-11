import { AbiCoder, keccak256 } from "ethers";

export type CredentialSchemaInput = {
  name: string;
  version: string;
};

const schemaHashTypes = ["string", "string"] as const;

export const STUDENT_CREDENTIAL_SCHEMA = {
  name: "StudentCredential",
  version: "1.0"
} as const;

export function hashCredentialSchema(input: CredentialSchemaInput) {
  const encoded = AbiCoder.defaultAbiCoder().encode(schemaHashTypes, [
    input.name,
    input.version
  ]);

  return keccak256(encoded);
}

export const STUDENT_CREDENTIAL_SCHEMA_HASH = hashCredentialSchema(
  STUDENT_CREDENTIAL_SCHEMA
);
