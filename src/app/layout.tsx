import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "212G TARSUS - Main Ministry Platform",
  description: "Daniel Miles Authorship Corpus and Tarsus Chatbot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
