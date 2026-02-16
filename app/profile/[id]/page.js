"use client";

import { useState, useEffect } from "react";
import { getProfile } from "@/lib/api-client";
import { useSession } from "@/lib/SessionContext";
import RankBadge, { RankProgress } from "../../components/RankBadge";
import DebateCard from "../../components/DebateCard";

export default function ProfilePage({ params }) {
  const { id: profileId } = params;
  const { user } = useSession();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = user?.id === profileId;

  useEffect(() => {
    getProfile(profileId).then((data) => {
      setProfile(data.user || data);
      setLoading(false);
    });
  }, [profileId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-arena-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <p className="text-arena-muted">Profile not found.</p>
      </div>
    );
  }

  const totalDebates = profile.total_debates || 0;
  const wins = profile.wins || 0;
  const losses = profile.losses || 0;
  const draws = profile.draws || 0;
  const qualityScore = parseFloat(profile.quality_score_avg) || 50;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-arena-surface border border-arena-border rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-arena-accent/20 rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-arena-accent">
              {(profile.username || "?")[0].toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{profile.username}</h1>
            <div className="flex items-center gap-2 mt-1">
              <RankBadge rank={profile.rank_tier} size="lg" />
              {isOwnProfile && <span className="text-xs text-arena-muted">(You)</span>}
            </div>
          </div>
        </div>

        <RankProgress rank={profile.rank_tier} score={qualityScore} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Debates", value: totalDebates },
          { label: "Wins", value: wins, cls: "text-arena-pro" },
          { label: "Losses", value: losses, cls: "text-arena-con" },
          { label: "Draws", value: draws },
        ].map((stat) => (
          <div key={stat.label} className="bg-arena-surface border border-arena-border rounded-lg p-4 text-center">
            <p className={`text-2xl font-bold ${stat.cls || ""}`}>{stat.value}</p>
            <p className="text-xs text-arena-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quality Score */}
      <div className="bg-arena-surface border border-arena-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold">Quality Score</span>
          <span className="text-2xl font-bold text-arena-accent">{qualityScore.toFixed(1)}</span>
        </div>
        <div className="h-3 bg-arena-border rounded-full overflow-hidden">
          <div
            className="h-full bg-arena-accent rounded-full transition-all"
            style={{ width: `${qualityScore}%` }}
          />
        </div>
      </div>

      {/* Recent debates */}
      {profile.recent_debates?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Debates</h2>
          <div className="space-y-3">
            {profile.recent_debates.map((debate) => (
              <DebateCard key={debate.id} debate={debate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
