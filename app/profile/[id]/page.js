import { notFound } from "next/navigation";
import { getProfileSSR } from "@/lib/queries/getProfileSSR";
import ProfileClient from "./ProfileClient";

export async function generateMetadata({ params }) {
  const { id: profileId } = params;
  const profile = await getProfileSSR(profileId);

  if (!profile) {
    return { title: "Profile Not Found | Arena.gg" };
  }

  const username = profile.username || "Debater";
  const rankTier = profile.rank_tier || "Bronze";
  const wins = profile.wins || 0;
  const losses = profile.losses || 0;
  const qualityScore = parseFloat(
    profile.quality_score_avg || profile.quality_score || 50
  ).toFixed(1);

  const title = `@${username} | Arena.gg`;
  const description = `${rankTier} · ${wins}W ${losses}L · Quality Score: ${qualityScore}`;
  const ogImageUrl = `/api/og/profile?userId=${profileId}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ProfilePage({ params }) {
  const { id: profileId } = params;
  const profile = await getProfileSSR(profileId);

  if (!profile) {
    notFound();
  }

  return <ProfileClient initialProfile={profile} profileId={profileId} />;
}
