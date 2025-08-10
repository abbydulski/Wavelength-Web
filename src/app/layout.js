import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { AuthProvider } from "../../hooks/useAuth";
import { Analytics } from "@vercel/analytics/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Wavelength",
  description: "Share and rate your experiences with friends.",
  openGraph: {
    title: "Wavelength",
    description: "Friends-first feed. No short-form noise. Discover useful places within 100 miles.",
    images: [
      {
        url: "/globe.svg",
        width: 1200,
        height: 630,
        alt: "Wavelength",
      },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
