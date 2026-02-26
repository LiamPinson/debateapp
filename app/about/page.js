import Link from "next/link";

export const metadata = {
  title: "About Arena.gg",
  description: "Learn about Arena.gg, the platform for voice debates with strangers.",
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      {/* Hero Section */}
      <section className="text-center mb-16">
        <h1 className="text-4xl sm:text-5xl font-bold mb-6">
          Save your friendships, spare your spouse —{" "}
          <span className="text-arena-accent">argue with strangers online.</span>
        </h1>
      </section>

      {/* Main Content */}
      <section className="space-y-12">
        {/* Intro */}
        <div className="prose prose-invert max-w-none">
          <p className="text-lg text-arena-muted leading-relaxed">
            We all know social media, and now AI as well, is deeply bias confirming, designed to
            irritate you just enough so you keep scrolling, designed to show the worst of the "other
            side" so you stay firmly categorized in your group.
          </p>
        </div>

        {/* Not For Everyone */}
        <div className="bg-arena-surface border border-arena-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-3">This website is NOT for everyone.</h2>
          <p className="text-arena-muted">
            This is a place to scratch an itch, the itch to spar, debate, disagree, with real people,
            with real issues.
          </p>
        </div>

        {/* Key Features */}
        <div>
          <h2 className="text-2xl font-bold mb-6">How It Works</h2>
          <div className="space-y-4">
            <div className="border-l-2 border-arena-accent pl-4">
              <h3 className="font-semibold text-arena-accent mb-2">Debates are private rooms</h3>
              <p className="text-arena-muted">
                No spectators — like a match with a stranger on chess.com
              </p>
            </div>

            <div className="border-l-2 border-arena-accent pl-4">
              <h3 className="font-semibold text-arena-accent mb-2">Voice mode only</h3>
              <p className="text-arena-muted">No video.</p>
            </div>

            <div className="border-l-2 border-arena-accent pl-4">
              <h3 className="font-semibold text-arena-accent mb-2">Transcripts are public</h3>
              <p className="text-arena-muted">
                The transcript will be posted publicly, but the audio file will only be transcribed if
                BOTH players consent, after the match.
              </p>
            </div>

            <div className="border-l-2 border-arena-accent pl-4">
              <h3 className="font-semibold text-arena-accent mb-2">Basic rules</h3>
              <p className="text-arena-muted">
                Ad-hominem and <em>excess</em> profanity will be penalized. Instances of "bad faith"
                will be analyzed first by the AI, second by humans, before penalties are issued.
              </p>
            </div>
          </div>
        </div>

        {/* Goals */}
        <div className="bg-arena-surface border border-arena-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-3">The Goal</h2>
          <p className="text-arena-muted">
            The goal is not to agree, but to represent your case, test your verbal intelligence, train
            rhetorical skills, and blow off a little steam.
          </p>
        </div>

        {/* Community Voting */}
        <div>
          <h2 className="text-xl font-semibold mb-3">Community Scoring</h2>
          <p className="text-arena-muted">
            Registered users are able to vote, one vote per user, on the transcripts page. This
            community score is the only lasting record of wins and losses.
          </p>
        </div>

        {/* Matchmaking */}
        <div>
          <h2 className="text-xl font-semibold mb-3">Matchmaking Timeout</h2>
          <p className="text-arena-muted">
            If you navigate away from the browser window during matchmaking, you will be notified when
            a match is found, and have 60 seconds to join the room.
          </p>
        </div>

        {/* FAQ Placeholder */}
        <div className="border-t border-arena-border pt-8">
          <h2 className="text-2xl font-bold mb-6">FAQ</h2>
          <p className="text-arena-muted">FAQ content coming soon.</p>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="mt-16 pt-8 border-t border-arena-border text-center">
        <p className="text-arena-muted mb-4">Ready to debate?</p>
        <Link
          href="/topics"
          className="inline-block px-8 py-3 bg-arena-accent text-white rounded-lg font-semibold hover:bg-arena-accent/80 transition-colors"
        >
          Browse Debates
        </Link>
      </section>
    </div>
  );
}
