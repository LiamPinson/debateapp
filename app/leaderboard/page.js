import Link from "next/link";
import { createServiceClient } from "@/lib/supabase";
import RankBadge from "@/app/components/RankBadge";

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: "Leaderboard | Arena.gg" };
}

export default async function LeaderboardPage() {
  const db = createServiceClient();
  const { data: users } = await db
    .from("users")
    .select("id, username, rank_tier, quality_score_avg, wins, losses, draws, total_debates")
    .order("quality_score_avg", { ascending: false })
    .limit(50);

  return (
    <main className="max-w-4xl mx-auto px-4 pt-24 pb-12">
      <h1 className="text-2xl font-bold mb-1">Leaderboard</h1>
      <p className="text-sm text-arena-muted mb-6">Top 50 debaters by quality score</p>

      <div className="bg-arena-surface border border-arena-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-arena-border text-arena-muted text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 w-10">#</th>
              <th className="text-left px-4 py-3">Player</th>
              <th className="text-right px-4 py-3 hidden sm:table-cell">W / L / D</th>
              <th className="text-right px-4 py-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {(users || []).map((user, i) => (
              <tr
                key={user.id}
                className="border-b border-arena-border/50 last:border-0 hover:bg-arena-border/20 transition-colors"
              >
                <td className="px-4 py-3 text-arena-muted font-mono">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/profile/${user.id}`}
                      className="font-medium hover:text-arena-accent transition-colors"
                    >
                      {user.username}
                    </Link>
                    <RankBadge rank={user.rank_tier} />
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-arena-muted hidden sm:table-cell">
                  <span className="text-arena-pro">{user.wins ?? 0}</span>
                  {" / "}
                  <span className="text-arena-con">{user.losses ?? 0}</span>
                  {" / "}
                  <span>{user.draws ?? 0}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium">
                  {(user.quality_score_avg ?? 0).toFixed(1)}
                </td>
              </tr>
            ))}
            {(!users || users.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-arena-muted">
                  No ranked players yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
