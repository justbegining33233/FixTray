import { NextRequest } from 'next/server';
import { POST as claimReward } from '@/app/api/customers/rewards/route';

// Legacy compatibility endpoint.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const tierId = body.tierId || body.rewardId;

  const cloned = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ tierId }),
  });

  return claimReward(cloned as unknown as NextRequest);
}
