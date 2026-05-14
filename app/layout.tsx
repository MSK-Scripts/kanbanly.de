import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ToastContainer } from "@/components/ToastContainer";
import { ThemeScript } from "@/components/ThemeScript";
import { ThemeToggle } from "@/components/ThemeToggle";

const inter = Inter({
  variable: "--font-sans-app",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-app",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kanbanly.de";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "kanbanly — minimalistische Kanban-Alternative · Flow first. Build fast.",
    template: "%s · kanbanly",
  },
  description:
    "Kanbanly ist ein schlankes, deutschsprachiges Kanban-Tool für Selbstständige und kleine Teams. Boards, Karten, Labels, Fälligkeiten, Zuweisungen, Realtime-Sync. Kostenlos, DSGVO-konform, ohne Ballast.",
  keywords: [
    "Kanban",
    "Kanban-Tool",
    "Kanban deutsch",
    "Trello Alternative",
    "Trello Alternative deutsch",
    "Projektmanagement",
    "Aufgabenverwaltung",
    "Task Management",
    "Projektmanagement-Tool",
    "kostenloses Kanban",
    "DSGVO Projektmanagement",
    "kleine Teams",
    "Freelancer Tools",
  ],
  authors: [{ name: "Felix Franzen" }],
  creator: "Felix Franzen",
  applicationName: "kanbanly",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: SITE_URL,
    siteName: "kanbanly",
    title:
      "kanbanly — minimalistische Kanban-Alternative für Macher",
    description:
      "Schlankes Kanban-Tool auf Deutsch: Boards, Labels, Fälligkeiten, Zuweisungen, Realtime-Sync. Kostenlos und DSGVO-konform.",
  },
  twitter: {
    card: "summary_large_image",
    title: "kanbanly — Flow first. Build fast.",
    description:
      "Schlankes Kanban-Tool auf Deutsch. Boards, Labels, Realtime. Kostenlos.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "productivity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${inter.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col font-sans text-fg">
        {children}
        <ConfirmDialog />
        <ToastContainer />
        <div className="fixed bottom-4 right-4 z-[200]">
          <ThemeToggle />
        </div>
      </body>
    </html>
  );
}
