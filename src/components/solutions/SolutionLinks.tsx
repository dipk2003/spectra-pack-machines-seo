import Link from 'next/link';
import { PACKAGING_SOLUTIONS, solutionsForProductSlug } from '@/lib/packaging-solutions';

export default function SolutionLinks({ productSlug }: { productSlug?: string }) {
  const solutions = productSlug ? solutionsForProductSlug(productSlug) : PACKAGING_SOLUTIONS;
  if (!solutions.length) return null;
  return (
    <section className="section section-alt" aria-label="Packaging solutions and buying advice">
      <div className="container">
        <span className="section-label">Choose by your application</span>
        <h2>Packaging solutions, trials and quotation guides</h2>
        <p>Compare the process, product fit and full installed scope before choosing a machine.</p>
        <div className="seo-guide-grid">
          {solutions.map(solution => (
            <Link key={solution.slug} href={`/solutions/${solution.slug}`} className="seo-guide-card">
              <h3>{solution.name}</h3><p>{solution.description}</p><span>Review the application guide →</span>
            </Link>
          ))}
        </div>
        <p><Link href="/solutions">Compare all packaging solutions</Link> · <Link href="/about#company-facts">Company facts and supplier verification</Link></p>
      </div>
    </section>
  );
}
