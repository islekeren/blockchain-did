import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  value: string;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const normalized = value.toUpperCase();

  if (["TRUSTED", "ACTIVE", "ISSUED", "APPROVED"].includes(normalized)) {
    return <Badge variant="success">{value}</Badge>;
  }

  if (["PENDING", "EXPIRED"].includes(normalized)) {
    return <Badge variant="warning">{value}</Badge>;
  }

  if (["UNTRUSTED", "INACTIVE", "REVOKED", "REJECTED"].includes(normalized)) {
    return <Badge variant="destructive">{value}</Badge>;
  }

  return <Badge variant="neutral">{value}</Badge>;
}
