import Link from "next/link";

export default function HelpPage() {
  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <div>
        <h1 className="font-display text-3xl text-burgundy">Help</h1>
        <p className="mt-1 font-body text-charcoal/70">
          A few places to go depending on what you need.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="font-display text-lg text-burgundy">Something about your account or a course</h2>
        <p className="mt-2 font-body text-sm text-charcoal/70">
          Message your mentor or teacher directly, or reach an administrator through your program's usual
          contact channel.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="font-display text-lg text-burgundy">A concern about another user, content, or how you were treated</h2>
        <p className="mt-2 font-body text-sm text-charcoal/70">
          File a report. Faculty and administrators review every report, and it's never visible to the person
          you're reporting.
        </p>
        <Link href="/report" className="btn-secondary mt-4 inline-flex">
          Report a concern
        </Link>
      </div>

      <div className="card border border-coral/30 bg-coral/10 p-6">
        <h2 className="font-display text-lg text-[#7a2c1c]">In danger or in crisis right now</h2>
        <p className="mt-2 font-body text-sm text-[#7a2c1c]">
          This platform is not a crisis service. Please contact local emergency services or a crisis line
          immediately rather than waiting for a reply here.
        </p>
      </div>
    </div>
  );
}
