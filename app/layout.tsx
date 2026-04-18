import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans text-slate-100">
        {children}
        <ConfirmDialog />
      </body>
    </html>
  );
}
