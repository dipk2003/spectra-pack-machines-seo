# AI visibility baseline and remediation map

Snapshot: 2026-11-24

2 files supplied; 1 unique file. 99 responses across 23 prompts and four platforms.

Brand questions: 19/20 mentions. Service questions: 4/79 mentions.

## Platform baseline

| Platform | Mentions / responses | Mention rate |
|---|---:|---:|
| ChatGPT | 7/25 | 28.0% |
| Claude | 5/25 | 20.0% |
| Google AI Overviews | 5/24 | 20.8% |
| Perplexity | 6/25 | 24.0% |

## Topic baseline

| Topic | Mentions / responses | Target |
|---|---:|---|
| Automatic liquid filling lines | 1/24 | /solutions/liquid-filling-lines |
| Brand Questions | 19/20 | /about |
| Conveyor belt systems | 0/4 | /solutions/conveyor-systems |
| Pallet stretch wrapping | 2/23 | /solutions/pallet-stretch-wrapping |
| Shrink wrapping and sealing | 1/24 | /solutions/shrink-wrapping-sealing |
| Vacuum packaging systems | 0/4 | /solutions/vacuum-packaging |

## Data quality and trust issues

- 7 repeated prompt/platform observations; 92 distinct pairs.
- 3 inconsistent mention/position rows. Do not treat these as achieved ranks.
- 1 brand answer(s) contain unrelated breast-pump terms and require entity review. In this snapshot, Claude describes that unrelated product despite a positive brand-mention flag.
- Owner confirmed: business establishment is 2025; team packaging-industry experience dates to 2001. These must be separate in visible copy and Organization schema.
- The snapshot predates the new content. No post-release platform ranking result has been measured.

## Query-to-page coverage

| Reported question | Mentions / responses | Destination |
|---|---:|---|
| Best pallet stretch wrapping machine manufacturer in Delhi? | 0/4 | /solutions/pallet-stretch-wrapping |
| Best pallet stretch wrapping machine for a small warehouse? | 0/7 | /solutions/pallet-stretch-wrapping |
| Is Spectra Pack Machines worth it? | 4/4 | /about |
| Best shrink wrapping machine manufacturer in Pune? | 0/4 | /solutions/shrink-wrapping-sealing |
| Cama Group alternatives for shrink wrapping machines in Maharashtra? | 1/4 | /blog/spectra-pack-machines-cama-krones-application-comparison |
| Best pallet stretch wrapping machine for a small factory? | 0/4 | /solutions/pallet-stretch-wrapping |
| Best automatic liquid filling machine manufacturer in Delhi? | 0/4 | /solutions/liquid-filling-lines |
| Best shrink wrapping machine for small business? | 0/8 | /solutions/shrink-wrapping-sealing |
| Best automatic liquid filling line for a small beverage business? | 0/4 | /solutions/liquid-filling-lines |
| Cama Group alternatives for pallet wrapping in Maharashtra? | 2/4 | /blog/spectra-pack-machines-cama-krones-application-comparison |
| Best pallet stretch wrapping machine manufacturer in Pune? | 0/4 | /solutions/pallet-stretch-wrapping |
| What is Spectra Pack Machines? | 4/4 | /about |
| Best automatic filling line for bottled water or juice? | 0/4 | /solutions/liquid-filling-lines |
| Krones alternatives for bottle filling and capping line in Maharashtra? | 1/4 | /blog/krones-alternatives-bottle-filling-capping-line-maharashtra |
| Is Spectra Pack Machines legit? | 3/4 | /about |
| Best automatic bottle filling line for a small plant? | 0/4 | /solutions/liquid-filling-lines |
| Spectra Pack Machines vs Cama Group | 4/4 | /blog/spectra-pack-machines-cama-krones-application-comparison |
| Best automatic liquid filling machine manufacturer in Pune? | 0/4 | /solutions/liquid-filling-lines |
| What is the best flat belt conveyor systems in Maharashtra? | 0/4 | /solutions/conveyor-systems |
| Best shrink wrapping machine manufacturer in Delhi? | 0/4 | /solutions/shrink-wrapping-sealing |
| Spectra Pack Machines vs Krones | 4/4 | /blog/spectra-pack-machines-cama-krones-application-comparison |
| Best shrink wrapping machine for a small business? | 0/4 | /solutions/shrink-wrapping-sealing |
| Industrial vacuum sealer machine price in Maharashtra? | 0/4 | /solutions/vacuum-packaging |

## Website remediation in this release

- Five application pages explain machine selection, small-business use, quotation inputs, acceptance trials and service coverage. They link to published machine models and existing technical guides.
- The homepage, product pages, city/product pages, service pages and footer provide contextual links to these solutions.
- About-page company facts and FAQs distinguish establishment in 2025 from team experience since 2001. The shared Organization schema uses 2025 as foundingDate.
- A supplier-comparison guide distinguishes shrink wrapping, pallet wrapping, case packing and beverage filling using official Cama Group and Krones sources.
- The sitemap and llms.txt include the new pages; public search/fetch crawler rules retain private-route exclusions.
- Reproduce the website checks with `npm run verify:ai-visibility -- https://spectrapackmachines.com` after deployment. A successful check is not a new AI ranking measurement.

## Work outside the website

- Align establishment year, company name, address, phone and website on the owner's Google Business Profile, IndiaMART and TradeIndia accounts. Keep company establishment separate from team experience.
- Add genuine customer-approved installation photos, product trial records and customer references. Do not create testimonials, ratings, certifications or performance figures without evidence.
- Use the owner's Search Console and Bing Webmaster Tools to inspect the new canonical pages, sitemap status and crawl errors. robots.txt access does not establish that a CDN/WAF permits verified bots.
- Rerun the same prompts on all four platforms after recrawling; compare branded and non-branded mention rates separately, plus correct identity, direct citations and qualified enquiries.
- No third-party listings, customer messages or account settings were changed by this website release.

## Interpretation limits

- One historical snapshot, not a current platform rerun or proof of ranking improvement.
- Repeated observations are retained in raw rates and separately counted; they are not independent keyword wins.
- Mention flags can include incorrect entity matches. Sentiment is the export's flag, not an independent quality judgment.
- Position fields on non-mentioned rows are inconsistent and must not be reported as achieved ranks.
- Google redirect destinations cannot be resolved from these exports; direct domain links are a lower bound.

## Official implementation references

- [Google AI features and your website](https://developers.google.com/search/docs/appearance/ai-features): ordinary search eligibility and useful content still apply; the website changes are not a guarantee of AI inclusion.
- [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots): distinguish search/user fetch access from model-training crawlers.
- [Perplexity crawler documentation](https://docs.perplexity.ai/docs/resources/perplexity-crawlers): public content and verified bot network access must both be available.
- [Anthropic crawler documentation](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler): Claude-SearchBot and Claude-User serve different retrieval roles.
