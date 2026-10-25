import type { ReactNode } from "react";
import { cn } from "cn";

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-page-shell className={cn("page-shell page-main", className)}>
      {children}
    </div>
  );
}

export function PageBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("page-shell", className)}>{children}</div>;
}
