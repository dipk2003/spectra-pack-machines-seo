import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listProducts, listServices } from '@/lib/cms';
import { COMPANY_INFO, PRODUCTS, SERVICES } from '@/lib/data';
import { listPublicBlogs } from '@/lib/public-blogs';
import { resolveGuideProduct } from '@/lib/editorial-links';
import { getPackagingSolution, PACKAGING_SOLUTIONS } from '@/lib/packaging-solutions';
import { completePageMetadata } from '@/lib/seo';
import { withTimeout } from '@/lib/async-timeout';
import styles from '../page.module.css';

export const dynamic = 'force-dynamic';
type Props = { params: { slug: string } };
export function generateStaticParams() { return PACKAGING_SOLUTIONS.map(({ slug }) => ({ slug })); }
export function generateMetadata({ params }: Props) {
  const solution = getPackagingSolution(params.slug);
  if (!solution) return {};
  return completePageMetadata({ title: solution.title, description: solution.description, alternates: { canonical: `/solutions/${solution.slug}` } });
}

export default async function SolutionPage({ params }: Props) {
  const solution = getPackagingSolution(params.slug);
  if (!solution) notFound();
  const [catalog, services, blogs] = await Promise.all([
    withTimeout(listProducts({ publishedOnly: true }), 8000, 'Solution catalog').catch(() => PRODUCTS),
    withTimeout(listServices({ publishedOnly: true }), 8000, 'Solution services').catch(() => SERVICES),
    withTimeout(listPublicBlogs(), 8000, 'Solution guides').catch(() => []),
  ]);
  const products = Array.from(new Map(solution.productSlugs.map(slug => resolveGuideProduct(slug, catalog))
    .filter((product): product is NonNullable<typeof product> => Boolean(product)).map(product => [product.slug, product])).values());
  const guides = solution.guideSlugs.map(slug => blogs.find(blog => blog.slug === slug)).filter((blog): blog is NonNullable<typeof blog> => Boolean(blog));
  const url = `${COMPANY_INFO.website}/solutions/${solution.slug}`;
  const quote = `/contact?${new URLSearchParams({ machine: solution.name, source: 'solution-page' }).toString()}`;
  const schema = [
    { '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${url}#webpage`, url, name: solution.title,
      description: solution.description, about: { '@id': `${COMPANY_INFO.website}/#organization` }, mainEntity: { '@id': `${url}#service` } },
    { '@context': 'https://schema.org', '@type': 'Service', '@id': `${url}#service`, url, name: solution.name,
      serviceType: `${solution.name}: machine selection, supply and integration`, description: solution.answer,
      provider: { '@id': `${COMPANY_INFO.website}/#organization` }, areaServed: { '@type': 'Country', name: 'India' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: solution.faqs.map(faq => ({
      '@type': 'Question', name: faq.q, acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: COMPANY_INFO.website },
      { '@type': 'ListItem', position: 2, name: 'Packaging solutions', item: `${COMPANY_INFO.website}/solutions` },
      { '@type': 'ListItem', position: 3, name: solution.name, item: url },
    ] },
  ];
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
    <header className={styles.hero}><div className="container">
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/solutions">Solutions</Link><span aria-hidden="true">/</span><span>{solution.name}</span></nav>
      <span className="section-label">Spectra Pack Machines · Maharashtra</span>
      <h1>{solution.title}</h1><p>{solution.answer}</p>
      <div className={styles.actions}><Link href={quote} className="btn btn-primary">Request an application review</Link><Link href="#selection" className="btn btn-outline">Compare your options</Link></div>
    </div></header>
    <div className={`container ${styles.layout}`}>
      <article className={styles.content}>
        <section id="selection"><h2>How to choose the right configuration</h2>
          {solution.selection.map(item => <div key={item.title}><h3>{item.title}</h3><p>{item.text}</p></div>)}
        </section>
        <section id="quotation"><h2>What to send for a comparable quotation</h2><ul className={styles.bulletList}>{solution.quotation.map(item => <li key={item}>{item}</li>)}</ul>
          <p>Confirm price, taxes, freight, installation, training, warranty and service inclusions in writing. Final configuration and availability depend on your application.</p>
        </section>
        <section id="trial"><h2>Agree a sample trial before purchase</h2><ol className={styles.orderedList}>{solution.trial.map(item => <li key={item}>{item}</li>)}</ol></section>
        <section id="faq"><h2>Questions buyers ask</h2>{solution.faqs.map(faq => <details key={faq.q} className={styles.faq}><summary>{faq.q}</summary><p>{faq.a}</p></details>)}</section>
        <section id="service"><h2>Installation, training and service</h2><p>Ask who handles placement, utilities, commissioning, operator handover, consumables and spares. Agree travel, response arrangements and any annual service terms for your plant; a delivery area is not a promise of a local office or a fixed response time.</p>
          <ul className={styles.bulletList}>{services.map(service => <li key={service.slug}><Link href={`/services/${service.slug}`}>{service.title}</Link></li>)}</ul>
        </section>
        <section id="markets"><h2>Supply enquiries for Maharashtra, Pune and Delhi</h2><p>Our head office is in Vasai West and manufacturing facility in Vasai East, Palghar, in the Mumbai region. Supply and service are coordinated for the delivery location and agreed scope.</p>
          <p><Link href="/packaging-machines/pune">Plan a Pune enquiry</Link> · <Link href="/packaging-machines/delhi">Plan a Delhi enquiry</Link> · <Link href="/packaging-machines/india/maharashtra">Maharashtra supply planning</Link></p>
          <Link href={quote} className="btn btn-primary">Discuss your product and output</Link>
        </section>
      </article>
      <aside className={styles.sidebar}>
        <nav className={styles.sidebarBox} aria-label="On this page"><h2>Plan your enquiry</h2><ul>{[['selection', 'Choose a configuration'], ['quotation', 'Prepare a quotation brief'], ['trial', 'Set trial criteria'], ['faq', 'Buyer questions'], ['service', 'Installation and service'], ['markets', 'Supply by location']].map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ul></nav>
        <section className={styles.sidebarBox}><h2>Machine models to review</h2>{products.length ? <ul>{products.map(product => <li key={product.slug}><Link href={`/products/${product.slug}`}>{product.title}</Link></li>)}</ul> : <p><Link href="/machines">Open the current machine catalog</Link> or ask our team to confirm the proposed configuration.</p>}</section>
        {guides.length > 0 && <section className={styles.sidebarBox}><h2>Further reading</h2><ul>{guides.map(guide => <li key={guide.slug}><Link href={`/blog/${guide.slug}`}>{guide.title}</Link></li>)}</ul></section>}
        <section className={styles.sidebarBox}><h2>About the manufacturer</h2><p>Established {COMPANY_INFO.foundedYear}. Team packaging-industry experience since {COMPANY_INFO.industryExperienceSince}.</p><Link href="/about#company-facts">View company facts and contact details</Link></section>
      </aside>
    </div>
  </>;
}
