import type { SupabaseClient } from "@supabase/supabase-js";

/** What the signed-in person may do in Voice right now. The database enforces every one of these rules itself; this only drives what the screens say. */
export interface VoiceAccess { signed_in: boolean; enrolled: boolean; intake: boolean; paid: boolean; status: string }
export const NO_ACCESS: VoiceAccess = { signed_in: false, enrolled: false, intake: false, paid: false, status: "none" };

export async function getMyAccess(supabase: SupabaseClient): Promise<VoiceAccess> {
  const { data, error } = await supabase.rpc("dp_voice_my_access");
  return error || !data ? NO_ACCESS : (data as VoiceAccess);
}

const WHY: Record<string, string> = {
  none: "We haven't received a coaching payment for you yet.", pending: "Your payment is still pending.", failed: "Your last payment did not go through.",
  refunded: "Your coaching package was refunded.", partial: "Your coaching package is active.", paid: "Your coaching package is active.", complimentary: "Complimentary packages do not open this area."
};
export const paymentReason = (status: string) => WHY[status] ?? WHY.none;
