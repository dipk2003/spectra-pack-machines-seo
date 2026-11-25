import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const origin = new URL(process.argv[2] || 'http://127.0.0.1:3000');
const canonicalOrigin = 'https://spectrapackmachines.com';
const slugs = ['pallet-stretch-wrapping', 'shrink-wrapping-sealing', 'liquid-filling-lines', 'conveyor-systems', 'vacuum-packaging'];
const comparison = '/blog/spectra-pack-machines-cama-krones-application-comparison';
const decode = text => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
async function load(path) {
  console.log(`Checking ${path}`);
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(60000) });
  assert.equal(response.status, 200, `${path}: HTTP status`);
  return { response, html: await response.text() };
}
function metadata(html, path) {
  const tags = html.match(/<meta\b[^>]*name="description"[^>]*>/g) || [];
  assert.equal(tags.length, 1, `${path}: one description`);
  const description = decode(tags[0].match(/content="([^"]*)"/)[1]);
  assert.ok(description.length >= 50 && description.length <= 160, `${path}: description length ${description.length}`);
  assert.ok(!description.endsWith('…'), `${path}: authored summary must not be cut off`);
  assert.ok(html.includes(`rel="canonical" href="${canonicalOrigin}${path}"`), `${path}: self canonical`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${path}: one H1`);
  assert.ok(!/<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html), `${path}: indexable`);
  return description;
}
function schemas(html) {
  return [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap(match => { const value = JSON.parse(match[1]); return value['@graph'] || value; });
}

const descriptions = new Set();
for (const slug of slugs) {
  const path = `/solutions/${slug}`;
  const { html } = await load(path);
  const description = metadata(html, path);
  assert.ok(!descriptions.has(description), `${path}: unique summary`);
  descriptions.add(description);
  const data = schemas(html);
  const org = data.filter(item => item['@type'] === 'Organization');
  assert.equal(org.length, 1, `${path}: one company entity`);
  assert.equal(org[0].foundingDate, '2025', `${path}: business establishment date`);
  const service = data.find(item => item['@type'] === 'Service');
  assert.equal(service.provider['@id'], `${canonicalOrigin}/#organization`);
  assert.equal(service.areaServed.name, 'India');
  const faq = data.find(item => item['@type'] === 'FAQPage');
  assert.equal(faq.mainEntity.length, 4);
  assert.equal((html.match(/<details\b/g) || []).length, 4, `${path}: four visible FAQ controls`);
  assert.ok(html.includes('href="/about#company-facts"'));
  assert.ok(html.includes('href="/packaging-machines/pune"') && html.includes('href="/packaging-machines/delhi"'));
  console.log(`PASS ${path}: summary ${description.length} chars, company entity, Service, visible FAQ and supply links`);
}
const index = (await load('/solutions')).html;
metadata(index, '/solutions');
for (const slug of slugs) assert.ok(index.includes(`href="/solutions/${slug}"`));
const about = (await load('/about')).html;
metadata(about, '/about');
assert.ok(about.includes('id="company-facts"') && about.includes('Business established') && about.includes('Since <!-- -->2001'));
const article = (await load(comparison)).html;
metadata(article, comparison);
assert.ok(article.includes('<table') && article.includes('https://camagroup.com/packaging-machines/'));
const robots = (await load('/robots.txt')).html;
for (const agent of ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User']) {
  assert.ok(robots.includes(`User-Agent: ${agent}`), `robots: ${agent}`);
}
assert.ok(robots.includes('Disallow: /admin') && robots.includes('Disallow: /api'));
const sitemap = (await load('/sitemap.xml')).html;
for (const path of ['/solutions', ...slugs.map(slug => `/solutions/${slug}`), comparison]) {
  assert.ok(sitemap.includes(`<loc>${canonicalOrigin}${path}</loc>`), `sitemap: ${path}`);
}
const { response: mapResponse, html: map } = await load('/llms.txt');
assert.ok(mapResponse.headers.get('content-type').startsWith('text/plain'));
assert.ok(map.includes('established in 2025') && map.includes('dates to 2001'));
for (const slug of slugs) assert.ok(map.includes(`/solutions/${slug}`));
for (const path of ['/', '/services', '/services/consultation', '/products/pvc-belt-conveyor', '/pune/pvc-belt-conveyor']) {
  const { html } = await load(path);
  assert.ok(html.includes('href="/solutions'), `${path}: contextual discovery links`);
}
const missing = await fetch(new URL('/solutions/not-a-published-solution', origin), { signal: AbortSignal.timeout(60000) });
assert.equal(missing.status, 404, 'Unknown solution must return 404');
const report = JSON.parse(await readFile(new URL('../reports/ai-visibility-2026-11-24.json', import.meta.url), 'utf8'));
assert.equal(report.unique_source_files, 1);
assert.equal(report.overall.responses, 99);
assert.equal(report.service_queries.mentions, 4);
assert.equal(report.inconsistent_rows.length, 3);
console.log('PASS solution hub, company facts, supplier comparison, crawler rules, sitemap, llms.txt, internal discovery, 404 handling and report baseline.');
