import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";

import "./globals.css";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { THEME_COOKIE } from "@/lib/theme";
import { ThemeProvider } from "@/components/cloudcampus/theme-provider";
import { SessionProvider } from "@/components/cloudcampus/session-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CloudCampus",
    template: "%s · CloudCampus",
  },
  description:
    "CloudCampus — the student organization platform for members, officers, " +
    "and the wider campus community.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, cookieStore] = await Promise.all([getSession(), cookies()]);
  const isDark = cookieStore.get(THEME_COOKIE)?.value === "dark";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        inter.variable,
        jetbrainsMono.variable,
        "font-sans",
        isDark && "dark",
      )}
    >
      <body className="min-h-full">
        <ThemeProvider>
          <SessionProvider session={session}>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
