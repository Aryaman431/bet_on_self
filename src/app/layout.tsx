import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Auth0Provider } from '@auth0/nextjs-auth0';
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import NavbarClient from "@/components/navbar-client";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "bet_on_self",
  description: "Aptos-based self-improvement betting and accountability platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get initial server-side auth state
  const cookieStore = await cookies();
  const idToken = cookieStore.get("id_token");
  const initialIsLoggedIn = !!idToken;

  let initialUserEmail = null;
  if (idToken?.value) {
    try {
      const decoded: any = jwt.decode(idToken.value);
      initialUserEmail = decoded?.email || null;
    } catch (error) {
      console.error("Error decoding token:", error);
    }
  }

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AuthProvider initialIsLoggedIn={initialIsLoggedIn} initialUserEmail={initialUserEmail}>
          <NavbarClient />
          <Auth0Provider>
            {children}
          </Auth0Provider>
        </AuthProvider>
      </body>
    </html>
  );
}
