import { PublicLanding } from "@/components/PublicLanding";
import { createClient } from "@/lib/supabase/server";
import type { Pathway } from "@/lib/types";

async function loadPublicPathways(): Promise<Pathway[] | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("dp_pathways").select("*").order("order_index");

    if (error) return null;
    return data as Pathway[];
  } catch {
    return null;
  }
}

export default async function LandingPage() {
  const pathways = await loadPublicPathways();
  return <PublicLanding pathways={pathways} />;
}
