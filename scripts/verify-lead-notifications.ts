import assert from 'node:assert/strict';
import { leadNotificationSource } from '../src/lib/lead-notification-source';

assert.equal(leadNotificationSource({ source: 'contact' }).channel, 'Direct');
assert.equal(leadNotificationSource({ source: 'contact', gclid: 'test-click' }).channel, 'Google Ads');
assert.equal(leadNotificationSource({ source: 'contact', utm_source: 'facebook', utm_medium: 'paid_social' }).channel, 'Meta Ads');
assert.equal(leadNotificationSource({ source: 'meta-lead-ad' }).channel, 'Meta Ads');
assert.equal(leadNotificationSource({ source: 'google-ads-lead-form' }).channel, 'Google Ads');
assert.equal(leadNotificationSource({ source: 'contact', referrer: 'www.google.com' }).channel, 'Google organic search');
const campaign = leadNotificationSource({ source: 'meta-lead-ad', utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: 'campaign-123', utm_content: 'form-456' });
assert.equal(campaign.capture, 'Facebook/Instagram Instant Form');
assert.equal(campaign.campaign, 'campaign-123');
assert.equal(campaign.ad, 'form-456');
assert.equal(leadNotificationSource({ attribution: { firstTouch: { gclid: 'old-paid-click' }, lastTouch: { referrer: 'www.google.com' } } }).channel, 'Google organic search');
console.log('Lead email source classification checks passed.');
