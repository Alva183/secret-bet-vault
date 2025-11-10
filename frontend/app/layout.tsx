import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "../components/Header";

export const metadata: Metadata = {
  title: "Voting Game - Encrypted Voting with FHE",
  description: "Vote Red or Blue with encrypted privacy. Minority wins the pool!",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
