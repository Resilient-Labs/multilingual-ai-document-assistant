import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Test Repo",
  description: "Next.js + Convex application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
