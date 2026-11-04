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
          className="flex shrink-0 items-center gap-2 font-heading text-base font-semibold tracking-tight whitespace-nowrap sm:gap-2.5 sm:text-lg"
        >
          <CozzoMark />
          <span>
            Cozzo Judge
            <span className="sr-only"> on cozzo.io</span>
          </span>
        </a>
        <nav aria-label="Main" className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-1.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors sm:px-3 sm:text-sm",
                  active
                    ? "bg-primary text-white shadow-[0_6px_18px_-8px_rgb(124_58_237/70%)]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
