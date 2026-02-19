import { notFound } from "next/navigation";
import { getDebateSSR } from "@/lib/queries/getDebateSSR";
import DebateClient from "./DebateClient";

export async function generateMetadata({ params }) {
  const { id: debateId } = params;
  const debate = await getDebateSSR(debateId);

  if (!debate) {
    return { title: "Debate Not Found | Arena.gg" };
  }

  const topicTitle =
    debate.topics?.title || debate.topic_title || "Quick Match";
  const proName = debate.pro_username || "Pro";
  const conName = debate.con_username || "Con";

  let title, description;

  if (debate.status === "completed" || debate.status === "forfeited") {
    const winner = debate.winner;
    const winnerName =
      winner === "pro" ? proName : winner === "con" ? conName : null;
    title = `${proName} vs ${conName} — ${topicTitle} | Arena.gg`;
    description =
      winner === "draw"
        ? `Draw! Quality scores: ${debate.pro_quality_score ?? "?"} vs ${debate.con_quality_score ?? "?"}`
        : winnerName
        ? `Winner: ${winnerName} · Quality scores: ${debate.pro_quality_score ?? "?"} vs ${debate.con_quality_score ?? "?"}`
        : `Debate completed · ${topicTitle}`;
  } else {
    title = `${topicTitle} — Live Debate | Arena.gg`;
    description = `${proName} vs ${conName} are debating right now`;
  }

  const ogImageUrl = `/api/og?debateId=${debateId}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function DebatePage({ params }) {
  const { id: debateId } = params;
  const debate = await getDebateSSR(debateId);

  if (!debate) {
    notFound();
  }

  // Flatten nested joins so DebateClient receives the same shape
  // as it gets from getDebateDetail() at runtime
  const flatDebate = {
    ...debate,
    topic_title: debate.topics?.title || debate.topic_title,
    topic_description: debate.topics?.description || debate.topic_description,
    pro_username: debate.pro_username || debate.pro_user?.username || null,
    pro_rank_tier: debate.pro_rank_tier || debate.pro_user?.rank_tier || null,
    con_username: debate.con_username || debate.con_user?.username || null,
    con_rank_tier: debate.con_rank_tier || debate.con_user?.rank_tier || null,
  };

  return <DebateClient initialDebate={flatDebate} params={params} />;
}
