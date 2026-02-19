import Link from "next/link";
import HomeHero from "./HomeHero";

export const metadata = {
  title: "Arena.gg — Debate Anyone",
  description:
    "Voice-based debates with random opponents. AI-scored. Community-judged.",
  openGraph: {
    title: "Arena.gg — Debate Anyone",
    description:
      "Voice-based debates with random opponents. AI-scored. Community-judged.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Arena.gg — Debate Anyone",
    description:
      "Voice-based debates with random opponents. AI-scored. Community-judged.",
  },
};

export default function Home() {
  return (
    <>
      <div className="max-w-6xl mx-auto px-4">
        {/* Hero */}
        <section className="py-20 sm:py-32 text-center">
          <h1 className="text-4xl sm:text-6xl font-bold mb-4">
            Argue with Strangers.{" "}
            <span className="text-arena-accent">Win nothing.</span>
          </h1>
          <p className="text-lg text-arena-muted max-w-xl mx-auto mb-8">
            Voice-based debates with random opponents. AI-scored. Community-judged.
            Climb the ranks from Bronze to Diamond.
          </p>
          <div className="flex items-center justify-center gap-4">
            <HomeHero />
            <Link
              href="/topics"
              className="px-8 py-3 border border-arena-border rounded-lg font-semibold hover:bg-arena-surface transition-colors text-lg"
            >
              Browse Topics
            </Link>
          </div>
        </section>

        {/* Stats strip */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-8 border-t border-b border-arena-border">
          {[
            { label: "Active Debaters", value: "128" },
            { label: "Debates Today", value: "47" },
            { label: "Topics", value: "30+" },
            { label: "Avg. Quality Score", value: "72.4" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-bold text-arena-accent">{stat.value}</p>
              <p className="text-sm text-arena-muted">{stat.label}</p>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section className="py-16">
          <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Join a Debate",
                desc: "Pick a topic or get matched randomly. Choose your time limit and stance.",
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ),
              },
              {
                step: "2",
                title: "Argue Your Case",
                desc: "Opening statements, free discussion, and closing arguments — all via live audio.",
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                ),
              },
              {
                step: "3",
                title: "Get Scored",
                desc: "AI analyzes coherence, evidence, and engagement. Community votes on the winner.",
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="bg-arena-surface border border-arena-border rounded-xl p-6 text-center">
                <div className="w-14 h-14 bg-arena-accent/10 text-arena-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  {item.icon}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-arena-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
