"""Summarize an exported multiline TSV without counting identical files twice.

Usage: python scripts/analyze-ai-visibility.py export.tsv [another-export.tsv]
Outputs aggregate findings only; raw model responses and attachment paths stay local.
"""
import argparse
import collections
import csv
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

BRAND = re.compile(r"\bspectra[\s-]+pack(?:\s+machines?)?\b", re.I)
TARGETS = {
    "Pallet stretch wrapping": "/solutions/pallet-stretch-wrapping",
    "Shrink wrapping and sealing": "/solutions/shrink-wrapping-sealing",
    "Automatic liquid filling lines": "/solutions/liquid-filling-lines",
    "Conveyor belt systems": "/solutions/conveyor-systems",
    "Vacuum packaging systems": "/solutions/vacuum-packaging",
    "Brand Questions": "/about",
}


def summarize(group):
    mentioned = [row for row in group if row["mentioned"].upper() == "TRUE"]
    return {"responses": len(group), "mentions": len(mentioned),
            "mention_rate_percent": round(100 * len(mentioned) / len(group), 1) if group else 0,
            "positive_sentiment_values": dict(collections.Counter(row["positive_sentiment"] or "unspecified" for row in group)),
            "reported_positions_when_mentioned": dict(collections.Counter(row["position"] or "unspecified" for row in mentioned))}


def analyze(paths):
    hashes, rows = [], []
    for path in paths:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest in hashes:
            continue
        hashes.append(digest)
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows.extend(csv.DictReader(handle, delimiter="\t"))
    if not rows:
        raise ValueError("No exported responses found")
    required = {"run_at", "prompt_text", "topic_name", "platform", "mentioned", "position", "positive_sentiment", "response"}
    if not required.issubset(rows[0]):
        raise ValueError("Export is missing required TSV columns")
    pairs = collections.Counter((r["prompt_text"], r["platform"]) for r in rows)
    domains, anomalies, site_links, entity_review = collections.Counter(), [], [], []
    for number, row in enumerate(rows, 2):
        text_mention = bool(BRAND.search(row["response"]))
        flagged = row["mentioned"].upper() == "TRUE"
        if row["topic_name"] == "Brand Questions" and re.search(r"\bbreast[\s-]*pumps?\b", row["response"], re.I):
            entity_review.append({"row": number, "platform": row["platform"], "prompt": row["prompt_text"], "reason": "Unrelated product terms: inspect entity match manually"})
        if text_mention != flagged or (row["position"] and not flagged):
            anomalies.append({"row": number, "platform": row["platform"], "prompt": row["prompt_text"],
                              "mentioned": flagged, "text_mention": text_mention, "reported_position": row["position"]})
        hosts = set()
        # Markdown link destinations, excluding image embeds and tracking/image hosts.
        for url in re.findall(r"(?<!!)\[[^\]\n]*\]\((https?://[^\s)]+)\)", row["response"]):
            host = (urlsplit(url).hostname or "").removeprefix("www.")
            if host in {"m.justdial.com", "dir.indiamart.com"}:
                host = host.split(".", 1)[1]
            if host and not any(asset in host for asset in ("google.com", "googleusercontent.com", "dataforseo.com", "gstatic.com", "images.openai.com")):
                hosts.add(host)
        domains.update(hosts)
        if "spectrapackmachines.com" in hosts:
            site_links.append({"platform": row["platform"], "prompt": row["prompt_text"]})
    service_rows = [r for r in rows if r["topic_name"] != "Brand Questions"]
    prompts = []
    for prompt in dict.fromkeys(row["prompt_text"] for row in rows):
        group = [r for r in rows if r["prompt_text"] == prompt]
        target = TARGETS.get(group[0]["topic_name"], "/solutions")
        if "cama" in prompt.lower() or " vs " in prompt.lower():
            target = "/blog/spectra-pack-machines-cama-krones-application-comparison"
        elif "krones alternatives" in prompt.lower():
            target = "/blog/krones-alternatives-bottle-filling-capping-line-maharashtra"
        prompts.append({"prompt": prompt, "topic": group[0]["topic_name"], "target": target, **summarize(group)})
    return {"source_files_supplied": len(paths), "unique_source_files": len(hashes), "source_sha256": hashes,
            "snapshot_dates": sorted({r["run_at"][:10] for r in rows}), "overall": summarize(rows),
            "brand_queries": summarize([r for r in rows if r["topic_name"] == "Brand Questions"]),
            "service_queries": summarize(service_rows), "unique_prompts": len(prompts),
            "unique_prompt_platform_pairs": len(pairs), "repeated_prompt_platform_observations": sum(count - 1 for count in pairs.values()),
            "by_platform": {k: summarize([r for r in rows if r["platform"] == k]) for k in sorted({r["platform"] for r in rows})},
            "by_topic": {k: summarize([r for r in rows if r["topic_name"] == k]) for k in sorted({r["topic_name"] for r in rows})},
            "inconsistent_rows": anomalies, "entity_review_rows": entity_review, "linked_domains_by_response": dict(domains.most_common(20)),
            "responses_with_direct_site_links": site_links, "prompt_coverage": prompts,
            "limitations": ["One historical snapshot, not a current platform rerun or proof of ranking improvement.",
                            "Repeated observations are retained in raw rates and separately counted; they are not independent keyword wins.",
                            "Mention flags can include incorrect entity matches. Sentiment is the export's flag, not an independent quality judgment.",
                            "Position fields on non-mentioned rows are inconsistent and must not be reported as achieved ranks.",
                            "Google redirect destinations cannot be resolved from these exports; direct domain links are a lower bound."]}


def markdown(data):
    lines = ["# AI visibility baseline and remediation map", "", "Snapshot: " + ", ".join(data["snapshot_dates"]), "",
             f"{data['source_files_supplied']} files supplied; {data['unique_source_files']} unique file. "
             f"{data['overall']['responses']} responses across {data['unique_prompts']} prompts and four platforms.", "",
             f"Brand questions: {data['brand_queries']['mentions']}/{data['brand_queries']['responses']} mentions. "
             f"Service questions: {data['service_queries']['mentions']}/{data['service_queries']['responses']} mentions.", "",
             "## Platform baseline", "", "| Platform | Mentions / responses | Mention rate |", "|---|---:|---:|"]
    for name, group in data["by_platform"].items():
        lines.append(f"| {name} | {group['mentions']}/{group['responses']} | {group['mention_rate_percent']}% |")
    lines += ["", "## Topic baseline", "", "| Topic | Mentions / responses | Target |", "|---|---:|---|"]
    for name, group in data["by_topic"].items():
        lines.append(f"| {name} | {group['mentions']}/{group['responses']} | {TARGETS.get(name, '/solutions')} |")
    lines += ["", "## Data quality and trust issues", "",
              f"- {data['repeated_prompt_platform_observations']} repeated prompt/platform observations; {data['unique_prompt_platform_pairs']} distinct pairs.",
              f"- {len(data['inconsistent_rows'])} inconsistent mention/position rows. Do not treat these as achieved ranks.",
              f"- {len(data['entity_review_rows'])} brand answer(s) contain unrelated breast-pump terms and require entity review. In this snapshot, Claude describes that unrelated product despite a positive brand-mention flag.",
              "- Owner confirmed: business establishment is 2025; team packaging-industry experience dates to 2001. These must be separate in visible copy and Organization schema.",
              "- The snapshot predates the new content. No post-release platform ranking result has been measured.", "",
              "## Query-to-page coverage", "", "| Reported question | Mentions / responses | Destination |", "|---|---:|---|"]
    for item in data["prompt_coverage"]:
        lines.append(f"| {item['prompt']} | {item['mentions']}/{item['responses']} | {item['target']} |")
    lines += ["", "## Website remediation in this release", "",
              "- Five application pages explain machine selection, small-business use, quotation inputs, acceptance trials and service coverage. They link to published machine models and existing technical guides.",
              "- The homepage, product pages, city/product pages, service pages and footer provide contextual links to these solutions.",
              "- About-page company facts and FAQs distinguish establishment in 2025 from team experience since 2001. The shared Organization schema uses 2025 as foundingDate.",
              "- A supplier-comparison guide distinguishes shrink wrapping, pallet wrapping, case packing and beverage filling using official Cama Group and Krones sources.",
              "- The sitemap and llms.txt include the new pages; public search/fetch crawler rules retain private-route exclusions.",
              "- Reproduce the website checks with `npm run verify:ai-visibility -- https://spectrapackmachines.com` after deployment. A successful check is not a new AI ranking measurement.",
              "", "## Work outside the website", "",
              "- Align establishment year, company name, address, phone and website on the owner's Google Business Profile, IndiaMART and TradeIndia accounts. Keep company establishment separate from team experience.",
              "- Add genuine customer-approved installation photos, product trial records and customer references. Do not create testimonials, ratings, certifications or performance figures without evidence.",
              "- Use the owner's Search Console and Bing Webmaster Tools to inspect the new canonical pages, sitemap status and crawl errors. robots.txt access does not establish that a CDN/WAF permits verified bots.",
              "- Rerun the same prompts on all four platforms after recrawling; compare branded and non-branded mention rates separately, plus correct identity, direct citations and qualified enquiries.",
              "- No third-party listings, customer messages or account settings were changed by this website release.", "",
              "## Interpretation limits", ""] + ["- " + item for item in data["limitations"]]
    lines += ["", "## Official implementation references", "",
              "- [Google AI features and your website](https://developers.google.com/search/docs/appearance/ai-features): ordinary search eligibility and useful content still apply; the website changes are not a guarantee of AI inclusion.",
              "- [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots): distinguish search/user fetch access from model-training crawlers.",
              "- [Perplexity crawler documentation](https://docs.perplexity.ai/docs/resources/perplexity-crawlers): public content and verified bot network access must both be available.",
              "- [Anthropic crawler documentation](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler): Claude-SearchBot and Claude-User serve different retrieval roles."]
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("exports", nargs="+", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("reports"))
    args = parser.parse_args()
    result = analyze(args.exports)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    stem = "ai-visibility-" + result["snapshot_dates"][-1]
    (args.output_dir / (stem + ".json")).write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (args.output_dir / (stem + ".md")).write_text(markdown(result), encoding="utf-8")
    print(json.dumps({"responses": result["overall"]["responses"], "service_mentions": result["service_queries"]["mentions"],
                      "report": str(args.output_dir / (stem + ".md"))}))
