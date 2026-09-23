'use client';

import { usePhrase } from '@/lib/usePhrase';

/** Translate a fixed sentence from a server page without making the whole page a client component. */
export default function SayText({ text }: { text: string }) {
  const say = usePhrase();
  return <>{say(text)}</>;
}
