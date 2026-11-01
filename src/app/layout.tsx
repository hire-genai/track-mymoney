import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import PwaBoot from "@/components/pwa/PwaBoot";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Track-MyMoney",
  description: "Couple-mode budgeting with goals, built on your bank statements.",
  manifest: "/manifest.webmanifest",
  applicationName: "Track-MyMoney",
  appleWebApp: {
    capable: true,
    title: "Track-MyMoney",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#047857",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <PwaBoot>{children}</PwaBoot>
      </body>
    </html>
  );
}
