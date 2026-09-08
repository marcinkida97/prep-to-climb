import { CircleCheck } from "lucide-react";

interface SuccessMessageProps {
  message?: string | null;
}

export function SuccessMessage({ message }: SuccessMessageProps) {
  if (!message) return null;

  return (
    <p className="border-secondary/30 bg-secondary/10 text-secondary flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
      <CircleCheck className="size-4 shrink-0" />
      {message}
    </p>
  );
}
