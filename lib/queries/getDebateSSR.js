// Direct Supabase service-role query — no HTTP round-trip, no auth middleware
// Used exclusively in server components and API routes (never in client components)
import { createServiceClient } from "@/lib/supabase";

export async function getDebateSSR(debateId) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("debates")
    .select("*, topics(title, short_title, category, description)")
    .eq("id", debateId)
    .single();
  return data; // null if not found
}
