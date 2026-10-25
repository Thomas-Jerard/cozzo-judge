import { Button } from "@/components/ui/button";

export function LimitNotice({
  message,
  actionLabel,
  onAction,
  disabled,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  return (
    <div role="alert" className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
      <p>{message}</p>
      <Button
        type="button"
        variant="outline"
        className="mt-3 h-10 bg-background"
        disabled={disabled}
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  );
}
