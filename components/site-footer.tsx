import { CozzoMark } from "@/components/cozzo-mark";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <a
            href="https://cozzo.io"
            className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary"
          >
            <CozzoMark size={22} />
            Powered by Cozzo
          </a>
          <p>
            Scores aid a buying decision. They are not a medical, legal, or compliance judgment.
          </p>
        </div>
        <div className="flex flex-col justify-between gap-2 border-t border-border/70 pt-4 text-xs sm:flex-row">
          <p>
            Sample calls are synthetic. Northline Voice and Harbor Voice are fictional labels, not vendors.
          </p>
          <p className="sm:text-right">
            <a href="https://cozzo.io" className="hover:text-foreground">
              cozzo.io
            </a>
            <span aria-hidden="true"> · </span>
            NVIDIA Nemotron on Nebius Token Factory
          </p>
        </div>
      </div>
    </footer>
  );
}
