export const metadata = {
  title: "Arena.gg — Debate Anyone",
  description: "Voice-based debates with random opponents. AI-scored. Community-judged.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
