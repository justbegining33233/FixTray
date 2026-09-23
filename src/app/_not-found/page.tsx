'use client';

import { usePhrase } from '@/lib/usePhrase';
export default function NotFoundPage() {
  const say = usePhrase();
  return (
    <div style={{padding:40,fontFamily:'sans-serif'}}>
      <h1>{say("404  -  Not Found")}</h1>
      <p>{say("The requested page was not found.")}</p>
    </div>
  );
}
