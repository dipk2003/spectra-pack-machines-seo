import Link from 'next/link';
import { COMPANY_INFO } from '@/lib/data';
import { PACKAGING_SOLUTIONS } from '@/lib/packaging-solutions';
import { completePageMetadata } from '@/lib/seo';
import styles from './page.module.css';

export const metadata = completePageMetadata({
  title: 'Packaging Solutions: Filling, Wrapping, Conveyors and Vacuum Sealing',
  description: 'Choose packaging equipment by application. Compare filling, shrink wrapping, pallet wrapping, conveyors and vacuum sealing with Spectra Pack Machines.',
  alternates: { canonical: '/solutions' },
});

export default function SolutionsPage() {
  const schema = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    '@id': `${COMPANY_INFO.website}/solutions#webpage`,
    name: 'Packaging solutions and buying guides', url: `${COMPANY_INFO.website}/solutions`,
    about: { '@id': `${COMPANY_INFO.website}/#organization` },
    mainEntity: { '@type': 'ItemList', itemListElement: PACKAGING_SOLUTIONS.map((solution, index) => ({
      '@type': 'ListItem', position: index + 1, name: solution.name, url: `${COMPANY_INFO.website}/solutions/${solution.slug}`,
    })) },
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
    <header className={styles.hero}><div className="container">
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span>Solutions</span></nav>
      <span className="section-label">Application first</span>
      <h1>Choose the packaging process your production needs</h1>
      <p>Spectra Pack Machines manufactures and supplies industrial packaging machinery from Vasai, near Mumbai, Maharashtra. Use these guides to compare the application, trial and support needs before requesting a configuration-specific quotation.</p>
      <div className={styles.actions}><Link href="/contact" className="btn btn-primary">Discuss your application</Link><Link href="/machines" className="btn btn-outline">Browse machine models</Link></div>
    </div></header>
    <div className={`container ${styles.index}`}>
      {PACKAGING_SOLUTIONS.map(solution => <article key={solution.slug} className={styles.indexRow}>
        <h2><Link href={`/solutions/${solution.slug}`}>{solution.name}</Link></h2>
        <div><p>{solution.answer}</p><Link href={`/solutions/${solution.slug}`}>Selection, quotation and trial guide →</Link></div>
      </article>)}
      <aside className={styles.notice}>
        <h2>Comparing suppliers or checking company details?</h2>
        <p><Link href="/blog/spectra-pack-machines-cama-krones-application-comparison">Compare Spectra Pack Machines, Cama Group and Krones by packaging process</Link>.</p>
        <p><Link href="/about#company-facts">Verify our company establishment, team experience and Maharashtra facilities</Link>.</p>
      </aside>
    </div>
  </>;
}
