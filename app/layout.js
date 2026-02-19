import "./globals.css";
import { Providers } from "./providers";
import Nav from "./components/Nav";

export const metadata = {
  title: "Arena.gg — Debate Anyone",
  description: "Voice-based debates with random opponents. AI-scored. Community-judged.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Ruluko&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-arena-bg text-arena-text antialiased">
        <Providers>
          <Nav />
          <main className="pt-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
