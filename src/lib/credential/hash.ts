import { keccak256, toUtf8Bytes } from "ethers";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function sortJsonValue(value: unknown): JsonValue {
  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, JsonValue>>((acc, key) => {
        acc[key] = sortJsonValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return String(value);
}

export function stableStringifyCredential(payload: unknown) {
  return JSON.stringify(sortJsonValue(payload));
}

/**
 * Deterministic placeholder for the future Solidity-side credential hash.
 * Keep this isolated: when contracts are introduced, this serialization must
 * be matched exactly or replaced by the contract ABI's canonical hash method.
 */
export function hashCredentialPayload(payload: unknown) {
  return keccak256(toUtf8Bytes(stableStringifyCredential(payload)));
}
