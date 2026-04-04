import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

const site =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

export const metadata: Metadata = {
  metadataBase: site ? new URL(site) : undefined,
  title: "בית - ניהול משק בית חכם",
  description:
    "פלטפורמה חכמה לניהול משק הבית - הוצאות, קניות, צמחים, מטלות ועוד. הכל במקום אחד.",
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: "בית",
    title: "בית - ניהול משק בית חכם",
    description:
      "פלטפורמה חכמה לניהול משק הבית - הוצאות, קניות, צמחים, מטלות ועוד.",
  },
  twitter: {
    card: "summary_large_image",
    title: "בית - ניהול משק בית חכם",
    description:
      "פלטפורמה חכמה לניהול משק הבית - הוצאות, קניות, צמחים, מטלות ועוד.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "בית",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0d9488" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("bayit-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js")`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
