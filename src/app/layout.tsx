import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "מנויומטר",
  description: "כל המנויים מתיבות ה-Gmail שלך: כמה הם עולים, כמה אתה משתמש בהם ומה אפשר לחסוך",
  applicationName: "מנויומטר",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "מנויומטר" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1e4a57",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
