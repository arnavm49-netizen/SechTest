import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "D&H Secheron Assessment Platform",
  description: "Assessment management platform for the D&H Secheron organisation.",
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
