import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  value: string;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const normalized = value.toUpperCase();

  if (
    ["TRUSTED", "ACTIVE", "ISSUED", "APPROVED", "REGISTERED"].includes(
      normalized
    )
  ) {
    return <Badge variant="success">{value}</Badge>;
  }

  if (["PENDING", "PENDING_ONCHAIN", "EXPIRED"].includes(normalized)) {
    return <Badge variant="warning">{value}</Badge>;
  }

  if (
    ["UNTRUSTED", "INACTIVE", "REVOKED", "REJECTED", "FAILED"].includes(
      normalized
    )
  ) {
    return <Badge variant="destructive">{value}</Badge>;
  }

  return <Badge variant="neutral">{value}</Badge>;
}
