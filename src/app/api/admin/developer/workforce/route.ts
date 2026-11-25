import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { getDeveloperAccess } from '@/lib/developer-access';
import { getDeveloperPinState, isDeveloperPinUnlocked } from '@/lib/developer-pin';
import { getCrmWorkReport } from '@/lib/crm-work';
import { CRM_PRIVATE_HEADERS } from '@/lib/crm-http';
export const dynamic = 'force-dynamic';
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!(await getDeveloperAccess(session)).allowed) return NextResponse.json({ error: 'Developer access required.' }, { status: 403, headers: CRM_PRIVATE_HEADERS });
  const state = await getDeveloperPinState();
  if (!state.available || !state.configured || !(await isDeveloperPinUnlocked(String(session?.user?.id || ''), state))) {
    return NextResponse.json({ error: 'Unlock the developer PIN first.' }, { status: 423, headers: CRM_PRIVATE_HEADERS });
  }
  try { return NextResponse.json(await getCrmWorkReport(), { headers: CRM_PRIVATE_HEADERS }); }
  catch { return NextResponse.json({ error: 'Work visibility is temporarily unavailable.' }, { status: 503, headers: CRM_PRIVATE_HEADERS }); }
}
