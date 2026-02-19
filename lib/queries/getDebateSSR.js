// Direct Supabase service-role query — no HTTP round-trip, no auth middleware
// Used exclusively in server components and API routes (never in client components)
import { createServiceClient } from "@/lib/supabase";

export async function getDebateSSR(debateId) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("debates")
    .select(`
      *,
      topics(title, short_title, category, description),
      pro_user:users!pro_user_id(username, rank_tier),
      con_user:users!con_user_id(username, rank_tier)
    `)
    .eq("id", debateId)
    .single();

  if (!data) return null;

  // Flatten nested user joins into top-level fields
  return {
    ...data,
    pro_username: data.pro_user?.username || null,
    pro_rank_tier: data.pro_user?.rank_tier || null,
    con_username: data.con_user?.username || null,
    con_rank_tier: data.con_user?.rank_tier || null,
  };
}
