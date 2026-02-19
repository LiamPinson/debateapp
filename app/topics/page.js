import { createServiceClient } from "@/lib/supabase";
import TopicsFilter from "./TopicsFilter";

export const revalidate = 300; // ISR: re-generate at most every 5 minutes

export async function generateMetadata() {
  return {
    title: "Browse Debate Topics | Arena.gg",
    description:
      "Debate politics, philosophy, science, and more. Pick a topic and get matched instantly.",
    openGraph: {
      title: "Browse Debate Topics | Arena.gg",
      description:
        "Debate politics, philosophy, science, and more. Pick a topic and get matched instantly.",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Browse Debate Topics | Arena.gg",
      description:
        "Debate politics, philosophy, science, and more. Pick a topic and get matched instantly.",
    },
  };
}

export default async function TopicsPage() {
  const supabase = createServiceClient();
  const { data: topics } = await supabase
    .from("topics")
    .select("*")
    .order("category")
    .order("title");

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Topics</h1>
      <TopicsFilter topics={topics || []} />
    </div>
  );
}
