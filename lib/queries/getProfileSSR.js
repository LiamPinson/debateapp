// Direct Supabase service-role query — no HTTP round-trip, no auth middleware
// Used exclusively in server components and API routes (never in client components)
import { createServiceClient } from "@/lib/supabase";

export async function getProfileSSR(userId) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("users")
    .select(
      "id, username, quality_score_avg, rank_tier, total_debates, wins, losses, draws"
    )
    .eq("id", userId)
    .single();
  return data; // null if not found
}
