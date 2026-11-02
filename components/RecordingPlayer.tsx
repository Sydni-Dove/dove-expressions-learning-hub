import { isVideoName } from "@/lib/recordings";
import { MEDIA_UNAVAILABLE } from "@/lib/storage";

/** Plays a recording. `signedUrl` is a short-lived URL minted for the signed-in viewer. */
export default function RecordingPlayer({ label, original, signedUrl }: { label: string; original: string; signedUrl: string }) {
  if (!signedUrl || signedUrl === MEDIA_UNAVAILABLE) return <p className="font-ui text-xs text-charcoal/60">Recording unavailable.</p>;
  const isLink = /^https:\/\//i.test(original);
  if (isLink) return <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="break-all font-ui text-sm text-burgundy underline">{label}: {original}</a>;
  return <figure className="space-y-1"><figcaption className="font-ui text-xs font-semibold text-charcoal/70">{label}</figcaption>
    {isVideoName(original)
      ? <video controls preload="metadata" playsInline src={signedUrl} className="w-full max-w-md rounded-xl bg-charcoal"/>
      : <audio controls preload="metadata" src={signedUrl} className="w-full max-w-md"/>}
  </figure>;
}
