"use client";
import { useEffect, useState } from "react";

/** Formats an instant in the viewer's own time zone (server render shows UTC until mounted). */
export default function LocalTime({ iso, options }: { iso: string; options?: Intl.DateTimeFormatOptions }) {
  const fmt: Intl.DateTimeFormatOptions = options ?? { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  const [text, setText] = useState(() => new Date(iso).toLocaleString("en-US", { ...fmt, timeZone: "UTC", timeZoneName: "short" }));
  useEffect(() => { setText(new Date(iso).toLocaleString(undefined, fmt)); }, [iso]); // eslint-disable-line react-hooks/exhaustive-deps
  return <time dateTime={iso} suppressHydrationWarning>{text}</time>;
}
