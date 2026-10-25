import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const themeScript = `try{var k="cozzo-judge-theme",t=localStorage.getItem(k);if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}`;

const description =
  "Cozzo the Canary is a canary in the coal mine for voice agents. Score a call against the business script, then read the verdict.";

export const metadata: Metadata = {
  metadataBase: new URL("https://cozzo-judge.vercel.app"),
  title: {
    default: "Cozzo Judge",
    template: "%s · Cozzo Judge",
  },
  description,
  applicationName: "Cozzo Judge",
  openGraph: {
    title: "Cozzo Judge",
    description,
    url: "https://cozzo-judge.vercel.app",
    siteName: "Cozzo Judge",
    type: "website",
    images: [
      {
        url: "/brand/og.png",
        width: 1200,
        height: 630,
        alt: "Cozzo the Canary waving beside the Cozzo logo and the words Cozzo Judge",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cozzo Judge",
    description,
    images: ["/brand/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fefcf8" },
    { media: "(prefers-color-scheme: dark)", color: "#171210" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sora.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
