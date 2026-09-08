import { CircleCheck } from "lucide-react";

interface SuccessMessageProps {
  message?: string | null;
}

export function SuccessMessage({ message }: SuccessMessageProps) {
  if (!message) return null;

  return (
    <p className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-300">
      <CircleCheck className="size-4 shrink-0" />
      {message}
    </p>
  );
}
