"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CozzoMark } from "@/components/cozzo-mark";
import { PageBar } from "@/components/page-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/score", label: "Judge a call" },
  { href: "/compare", label: "Advanced" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <PageBar className="flex h-16 items-center justify-between gap-3">
        <a
          href="https://cozzo.io"
          className="flex min-w-0 items-center gap-2.5 font-heading text-lg font-semibold tracking-tight"
        >
          <CozzoMark />
          <span className="truncate">
            Cozzo Judge
            <span className="sr-only"> on cozzo.io</span>
          </span>
        </a>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <ThemeToggle />
        </nav>
      </PageBar>
    </header>
  );
}
