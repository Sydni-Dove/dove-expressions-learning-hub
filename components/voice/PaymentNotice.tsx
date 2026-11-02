import Link from "next/link";
import { paymentReason } from "@/lib/voice-access";

/** Shown instead of a feature that opens only after verified payment. Intake and everything the student has already done stay available. */
export default function PaymentNotice({ status, what }: { status: string; what: string }) {
  return (
    <div role="note" className="rounded-2xl border border-[#630000]/20 bg-[#FBF4F1] p-5">
      <h2 className="font-display text-xl text-[#630000]">{what} opens after your payment is confirmed</h2>
      <p className="mt-2 font-body text-[#201414]">{paymentReason(status)} Your goals intake and the Vocal Demo from your consultation do not need payment. Once your coaching payment is verified, your coach will choose what fits you.</p>
      <p className="mt-2 font-body text-sm"><Link href="/voice/intake" className="inline-flex min-h-[44px] items-center font-semibold text-[#630000] underline">Your goals intake</Link></p>
    </div>
  );
}
