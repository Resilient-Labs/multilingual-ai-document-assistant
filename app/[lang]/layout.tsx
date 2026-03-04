import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { type Locale, locales } from "@/lib/dictionaries";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Multilingual AI Document Assistant",
  description: "AI-powered multilingual document assistant",
};

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: Locale }>;
}>) {
  const { lang } = await params;
  return (
    <html lang={lang}>
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
