import Link from "next/link";

export const metadata = {
  title: "About Arena.gg",
  description: "Learn about Arena.gg, a voice-based debate platform where you can argue with strangers.",
  openGraph: {
    title: "About Arena.gg",
    description: "Learn about Arena.gg, a voice-based debate platform where you can argue with strangers.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Arena.gg",
    description: "Learn about Arena.gg, a voice-based debate platform where you can argue with strangers.",
  },
};

export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-4">
      {/* Hero Section */}
      <section className="py-16 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          Save your friendships, spare your spouse —{" "}
          <span className="text-arena-accent">argue with strangers online.</span>
        </h1>
        <p className="text-lg text-arena-muted max-w-2xl mx-auto">
          A place to test your arguments, sharpen your thinking, and discover different perspectives.
        </p>
      </section>

      {/* Introduction Section */}
      <section className="py-12 border-t border-arena-border">
        <h2 className="text-2xl font-bold mb-6">The Problem with Modern Discourse</h2>
        <p className="text-arena-muted leading-relaxed mb-4">
          Social media has made us more polarized. We're surrounded by algorithms that show us what we already believe,
          trapped in echo chambers that reinforce our biases. Real debate—the kind where you actually listen to the other
          side and consider their points—has become increasingly rare.
        </p>
        <p className="text-arena-muted leading-relaxed">
          Arena.gg is different. It's not about winning arguments on the internet. It's about having real conversations
          with real people who disagree with you.
        </p>
      </section>

      {/* Not for Everyone Section */}
      <section className="py-12 border-t border-arena-border">
        <h2 className="text-2xl font-bold mb-6">This Platform Isn't for Everyone</h2>
        <p className="text-arena-muted leading-relaxed mb-4">
          Arena.gg requires something increasingly rare: the willingness to be wrong. To listen to someone you disagree
          with. To change your mind when presented with a good argument. If you're not interested in that, this isn't
          the platform for you.
        </p>
        <p className="text-arena-muted leading-relaxed">
          But if you're genuinely curious, intellectually honest, and want to test your ideas against real opposition,
          you've found your place.
        </p>
      </section>

      {/* How It Works Section */}
      <section className="py-12 border-t border-arena-border">
        <h2 className="text-2xl font-bold mb-8">How It Works</h2>
        <div className="grid sm:grid-cols-2 gap-8">
          {[
            {
              icon: "🔒",
              title: "Private Rooms",
              desc: "Your debates are anonymous and private. No audience, no followers, no performance—just genuine discussion.",
            },
            {
              icon: "🎙️",
              title: "Voice Only",
              desc: "Real-time voice conversations keep discussions honest. No time to craft the perfect tweet. Just real talk.",
            },
            {
              icon: "📝",
              title: "Transcripts",
              desc: "Every debate is automatically transcribed so you can review what was said and learn from the discussion.",
            },
            {
              icon: "⚖️",
              title: "Basic Rules",
              desc: "Simple, fair rules enforced by AI to keep discussions productive. No personal attacks, no bad faith arguments.",
            },
          ].map((feature) => (
            <div key={feature.title} className="bg-arena-surface border border-arena-border rounded-xl p-6">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-sm text-arena-muted">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Goal Section */}
      <section className="py-12 border-t border-arena-border">
        <h2 className="text-2xl font-bold mb-6">Our Goal</h2>
        <p className="text-arena-muted leading-relaxed mb-4">
          We want to create a generation of more thoughtful thinkers. People who can articulate why they believe what they believe.
          People who can respectfully disagree. People who can change their minds when the evidence demands it.
        </p>
        <p className="text-arena-muted leading-relaxed">
          In a world of increasingly tribal politics and algorithmic echo chambers, that feels revolutionary.
        </p>
      </section>

      {/* Community Scoring Section */}
      <section className="py-12 border-t border-arena-border">
        <h2 className="text-2xl font-bold mb-6">Community Scoring</h2>
        <p className="text-arena-muted leading-relaxed">
          Debates are scored by both AI analysis and community voting. Your performance determines your rank and standing
          in the Arena.gg community. Climb from Bronze through Silver, Gold, Platinum, and Diamond based on the quality of
          your arguments and the respect you earn from your opponents.
        </p>
      </section>

      {/* Matchmaking Timeout Section */}
      <section className="py-12 border-t border-arena-border">
        <h2 className="text-2xl font-bold mb-6">Matchmaking Timeout</h2>
        <p className="text-arena-muted leading-relaxed mb-4">
          We implement mandatory timeout periods between debates. Not as punishment, but as protection—for you and for others.
          Time to cool down, reflect on what you learned, and prepare for your next debate with a clear head.
        </p>
        <p className="text-arena-muted leading-relaxed">
          Intellectual growth requires rest. We built that principle directly into the platform.
        </p>
      </section>

      {/* FAQ Section */}
      <section className="py-12 border-t border-arena-border">
        <h2 className="text-2xl font-bold mb-8">Frequently Asked Questions</h2>
        <div className="space-y-6">
          {[
            {
              q: "Is this a debate competition?",
              a: "Not exactly. While debates are scored and you climb rankings, the primary goal is intellectual growth, not winning arguments.",
            },
            {
              q: "What topics can we debate?",
              a: "Almost anything—politics, philosophy, science, culture, technology. The main restriction is no content that violates our community guidelines.",
            },
            {
              q: "How long are debates?",
              a: "You choose when you join. Debates typically range from 10 to 60 minutes depending on the topic and both debaters' preferences.",
            },
            {
              q: "Do I need to be an expert?",
              a: "No. Arena.gg is for everyone willing to engage in good faith. You learn by debating, not by already being an expert.",
            },
          ].map((item) => (
            <div key={item.q}>
              <h3 className="font-semibold mb-2">{item.q}</h3>
              <p className="text-sm text-arena-muted">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 border-t border-arena-border text-center">
        <h2 className="text-2xl font-bold mb-6">Ready to Test Your Ideas?</h2>
        <Link
          href="/topics"
          className="inline-block px-8 py-3 bg-arena-accent text-white rounded-lg font-semibold hover:bg-arena-accent/80 transition-colors text-lg"
        >
          Browse Debates
        </Link>
      </section>
    </div>
  );
}
