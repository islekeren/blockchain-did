import type { ReactNode } from "react";
import { LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

type PlaceholderCardProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PlaceholderCard({
  title,
  description,
  actions
}: PlaceholderCardProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-2">{description}</CardDescription>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted">
            <LockKeyhole className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {actions ?? (
          <Button disabled variant="outline">
            Future chain check
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
