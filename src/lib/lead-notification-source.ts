import { attributionFromRow } from './lead-attribution';

const CHANNELS: Record<string, string> = {
  direct: 'Direct', 'google-ads': 'Google Ads', 'meta-ads': 'Meta Ads',
  'microsoft-ads': 'Microsoft Ads', 'google-organic': 'Google organic search',
  'organic-search': 'Organic search', 'paid-search': 'Other paid campaign',
  'ai-referral': 'AI referral', referral: 'Referral', campaign: 'Campaign',
};

/** Use stored attribution; a contact form is a capture location, not a channel. */
export function leadNotificationSource(row: Record<string, unknown>) {
  const attribution = attributionFromRow(row);
  const source = typeof row.source === 'string' ? row.source : '';
  const channel = source === 'meta-lead-ad' ? 'meta-ads'
    : source === 'google-ads-lead-form' ? 'google-ads' : attribution.channel;
  return {
    channel: CHANNELS[channel] || 'Unknown',
    capture: source === 'meta-lead-ad' ? 'Facebook/Instagram Instant Form'
      : source === 'google-ads-lead-form' ? 'Google Ads lead form' : source,
    campaign: attribution.utmCampaign,
    adSet: attribution.utmTerm,
    ad: attribution.utmContent,
    landingPage: attribution.landingPath,
    referrer: attribution.referrer,
    utmSource: attribution.utmSource,
    utmMedium: attribution.utmMedium,
  };
}
