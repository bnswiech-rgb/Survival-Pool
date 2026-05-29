import { NextRequest, NextResponse } from 'next/server';
import { getUserState, isRestrictedState } from '@/lib/geo';

export async function GET(request: NextRequest) {
  const state = getUserState(request.headers);
  const restricted = isRestrictedState(state);
  return NextResponse.json({ restricted, state });
}
