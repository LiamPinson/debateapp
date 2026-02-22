// Direct Supabase service-role query — no HTTP round-trip, no auth middleware
// Used exclusively in server components and API routes (never in client components)
import { createServiceClient } from "@/lib/supabase";

export async function getDebateSSR(debateId) {
  const supabase = createServiceClient();

  // Fetch the debate row on its own — avoiding the ambiguous multi-FK join to
  // the users table (users!pro_user_id + users!con_user_id) which can cause
  // PostgREST to return a 400 / null data when FK constraints aren't cached.
  const { data: debate, error } = await supabase
    .from("debates")
    .select("*, topics(title, short_title, category, description)")
    .eq("id", debateId)
    .single();

  console.log("getDebateSSR:", debateId, "data:", !!debate, "error:", error?.message || null);

  if (!debate) return null;

  // Fetch user display names separately to avoid the ambiguous FK join.
  const [proUser, conUser] = await Promise.all([
    debate.pro_user_id
      ? supabase
          .from("users")
          .select("username, rank_tier")
          .eq("id", debate.pro_user_id)
          .maybeSingle()
          .then((r) => r.data)
      : null,
    debate.con_user_id
      ? supabase
          .from("users")
          .select("username, rank_tier")
          .eq("id", debate.con_user_id)
          .maybeSingle()
          .then((r) => r.data)
      : null,
  ]);

  return {
    ...debate,
    pro_username: proUser?.username || null,
    pro_rank_tier: proUser?.rank_tier || null,
    con_username: conUser?.username || null,
    con_rank_tier: conUser?.rank_tier || null,
  };
}
