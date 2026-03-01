import "./globals.css";
import { Ruluko } from "next/font/google";
import { Providers } from "./providers";
import Nav from "./components/Nav";

const ruluko = Ruluko({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "Arena.gg — Debate Anyone",
  description: "Voice-based debates with random opponents. AI-scored. Community-judged.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={ruluko.className}>
      <body className="min-h-screen bg-arena-bg text-arena-text antialiased">
        <Providers>
          <Nav />
          <main className="pt-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
