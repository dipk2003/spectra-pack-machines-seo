import { NextRequest, NextResponse } from 'next/server';
import { getAdminRequestContext } from '@/lib/admin-auth';
import { writeCrmWork } from '@/lib/crm-work';
import { crmErrorResponse, CRM_PRIVATE_HEADERS, crmUnauthorizedResponse, crmOriginResponse, isTrustedCrmMutation, readCrmInput } from '@/lib/crm-http';
import { enforceMappedRateLimit } from '@/lib/rate-limit';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  const viewer = await getAdminRequestContext(req);
  if (!viewer) return crmUnauthorizedResponse();
  if (!isTrustedCrmMutation(req)) return crmOriginResponse();
  const quota = await enforceMappedRateLimit(req, 'workReporting');
  if (quota.limitedResponse) return quota.limitedResponse;
  try {
    return NextResponse.json(await writeCrmWork(viewer, await readCrmInput(req), req.headers.get('user-agent') || ''), { headers: CRM_PRIVATE_HEADERS });
  } catch (error) { return crmErrorResponse(error); }
}
