import { Textarea } from "@/components/ui/textarea";

type JsonViewerProps = {
  value: unknown;
  minHeight?: string;
};

export function JsonViewer({ value, minHeight = "min-h-72" }: JsonViewerProps) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);

  return (
    <Textarea
      readOnly
      value={text}
      className={`${minHeight} resize-none font-mono text-xs leading-5`}
    />
  );
}
