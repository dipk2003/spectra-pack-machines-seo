import { NextRequest, NextResponse } from 'next/server';
import { getAdminRequestContext } from '@/lib/admin-auth';
import { CrmAccessError } from '@/lib/crm';
import { crmErrorResponse, crmHeaders, crmOriginResponse, crmUnauthorizedResponse, isTrustedCrmMutation, readCrmInput } from '@/lib/crm-http';
import { enforceMappedRateLimit } from '@/lib/rate-limit';
import { syncMetaLeadBatch } from '@/lib/meta-lead-import';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const viewer = await getAdminRequestContext(req);
  if (!viewer) return crmUnauthorizedResponse();
  if (!isTrustedCrmMutation(req)) return crmOriginResponse();
  try {
    if (!viewer.canManageTeam) throw new CrmAccessError('Only CRM owners can import Meta leads.');
    const limit = await enforceMappedRateLimit(req, 'adminWrites');
    if (limit.limitedResponse) return limit.limitedResponse;
    const input = await readCrmInput(req);
    const result = await syncMetaLeadBatch(input.cursor);
    return NextResponse.json(result, { headers: crmHeaders(limit.headers) });
  } catch (error) {
    if (error instanceof Error && error.message) {
      return NextResponse.json({ error: error.message, code: 'META_LEAD_SYNC_FAILED' }, { status: 502, headers: crmHeaders() });
    }
    return crmErrorResponse(error);
  }
}
