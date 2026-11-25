import { completePageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import AnimatedSection from '@/components/ui/AnimatedSection';
import Counter from '@/components/ui/Counter';
import { COMPANY_INFO } from '@/lib/data';
import { Building2, Eye, Factory, Globe, Leaf, Target, Users } from 'lucide-react';
import styles from './page.module.css';

export const metadata: Metadata = completePageMetadata({
  title: 'About Our Packaging Machine Factory in Vasai',
  description:
    'Meet Spectra Pack Machines in Vasai, Maharashtra. Business established in 2025, with team industry experience since 2001 and pan-India machine support.',
  alternates: { canonical: '/about' },
  openGraph: { title: 'About Spectra Pack Machines', url: '/about' },
});

const companyQuestions = [
  { q: 'What is Spectra Pack Machines?', a: 'Spectra Pack Machines is an industrial packaging machinery manufacturer and supplier based in Vasai, near Mumbai, Maharashtra, India. Its equipment covers filling, capping, labelling, shrink wrapping, sealing, vacuum packaging, conveyors and pallet stretch wrapping.' },
  { q: 'Was the company established in 2001 or 2025?', a: 'The business was established in 2025. The team\'s packaging-industry experience dates to 2001. The team\'s prior experience is separate from the business establishment date.' },
  { q: 'How can a buyer verify the supplier before ordering?', a: 'Contact the published business numbers, arrange a factory discussion or product trial, and request the legal business and tax details used on the quotation. Ask for the proposed configuration, applicable customer references, written warranty and service scope before ordering.' },
  { q: 'Do Pune or Delhi pages mean there is a local factory?', a: 'No. The head office is in Vasai West and the manufacturing facility is in Vasai East, Palghar, in the Mumbai region. City pages help buyers plan delivery, installation and service enquiries; those arrangements are confirmed per project.' },
];

export default function AboutPage() {
  const timeline = [
    {
      year: '2025',
      event: 'Spectra Pack Machines was established as a business. The team brings prior packaging-industry experience dating to 2001.',
    },
    {
      year: 'Expansion',
      event: 'The company expanded across shrink wrapping, sealing, vacuum packaging, conveyors, and end-of-line packaging applications.',
    },
    {
      year: 'Leadership',
      event: 'Under the guidance of Mr. Mata Prasad Pandey and Mr. Shubham J. Mishra, the business continued scaling its capabilities and market reach.',
    },
    {
      year: 'Today',
      event: 'Our Vasai West head office and Chinchoti manufacturing facility support domestic and international customers with reliable machine execution.',
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        { '@context': 'https://schema.org', '@type': 'AboutPage', '@id': `${COMPANY_INFO.website}/about#webpage`, url: `${COMPANY_INFO.website}/about`, name: 'About Spectra Pack Machines', mainEntity: { '@id': `${COMPANY_INFO.website}/#organization` } },
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: companyQuestions.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
      ]).replace(/</g, '\\u003c') }} />
      <section className={styles.hero}>
        <div className="container">
          <AnimatedSection>
            <span className="section-label" style={{ color: 'var(--accent)' }}>
              About Spectra Pack Machines
            </span>
            <h1 className={styles.heroTitle}>
              Packaging Machine Manufacturing
            </h1>
            <p className={styles.heroDesc}>
              {COMPANY_INFO.companyDescription[0]}
            </p>
          </AnimatedSection>
        </div>
      </section>

      <section className={styles.statsSection}>
        <div className="container">
          <div className={styles.statsGrid}>
            {[
              {
                num: COMPANY_INFO.yearsOfExperience,
                suffix: '+',
                label: 'Years of Team Experience',
              },
              {
                num: COMPANY_INFO.machineSolutions,
                suffix: '+',
                label: 'Machine Solutions',
              },
              {
                num: COMPANY_INFO.industryApplications,
                suffix: '+',
                label: 'Industry Applications',
              },
              {
                num: COMPANY_INFO.clientsServed,
                suffix: '+',
                label: 'Clients Served',
              },
            ].map((s, i) => (
              <AnimatedSection key={i} delay={i * 0.1}>
                <div className={styles.statCard}>
                  <Counter end={s.num} suffix={s.suffix} className={styles.statNum} />
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className={styles.storyGrid}>
            <AnimatedSection direction="left">
              <span className="section-label">Company Description</span>
              <h2 className="section-title">
                Built Around Reliable
                <br />
                Packaging Solutions
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '1rem' }}>
                {COMPANY_INFO.companyDescription[1]}
              </p>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '1rem' }}>
                {COMPANY_INFO.companyDescription[2]}
              </p>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                {COMPANY_INFO.companyDescription[4]}
              </p>
            </AnimatedSection>

            <AnimatedSection direction="right">
              <div className={styles.valuesGrid}>
                {[
                  {
                    icon: <Target size={24} />,
                    title: 'Quality Focus',
                    desc: 'Every machine build is shaped around precision, durability, and dependable long-term use.',
                  },
                  {
                    icon: <Leaf size={24} />,
                    title: 'Practical Engineering',
                    desc: 'Solutions are planned around actual production flow, efficiency, and usable layouts.',
                  },
                  {
                    icon: <Globe size={24} />,
                    title: 'Industry Coverage',
                    desc: 'The machine range supports FMCG, pharma, food, logistics, retail, and manufacturing lines.',
                  },
                  {
                    icon: <Users size={24} />,
                    title: 'Leadership & Support',
                    desc: 'Technical execution stays close to customer needs through responsive guidance and service.',
                  },
                ].map((v, i) => (
                  <div key={i} className={styles.valueCard}>
                    <div className={styles.valueIcon}>{v.icon}</div>
                    <h3>{v.title}</h3>
                    <p>{v.desc}</p>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      <section className="section section-dark">
        <div className="container">
          <div className="grid-2">
            <AnimatedSection delay={0.1}>
              <div className={styles.vmCard}>
                <div className={styles.vmIcon}>
                  <Eye size={28} />
                </div>
                <h3>Our Vision</h3>
                <p>
                  To remain one of India&apos;s trusted packaging machine partners by combining quality,
                  innovation, and practical engineering in every solution we deliver.
                </p>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={0.2}>
              <div className={styles.vmCard}>
                <div className={styles.vmIcon}>
                  <Target size={28} />
                </div>
                <h3>Our Mission</h3>
                <p>
                  To help businesses improve packaging performance through reliable machines, custom-fit
                  solutions, sustainable thinking, and strong after-sales support.
                </p>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <AnimatedSection>
            <div className={styles.infrastructureIntro}>
              <span className="section-label">Infrastructure</span>
              <h2 className="section-title">Office and Manufacturing Backbone</h2>
              <p className="section-subtitle" style={{ margin: '0 auto' }}>
                {COMPANY_INFO.infrastructure.summary}
              </p>
            </div>
          </AnimatedSection>

          <div className={styles.infrastructureGrid}>
            <AnimatedSection delay={0.05}>
              <div className={styles.infrastructureCard}>
                <div className={styles.infrastructureIcon}>
                  <Building2 size={24} />
                </div>
                <h3>{COMPANY_INFO.infrastructure.officeTitle}</h3>
                {COMPANY_INFO.infrastructure.officeDescription.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <div className={styles.infrastructureCard}>
                <div className={styles.infrastructureIcon}>
                  <Factory size={24} />
                </div>
                <h3>{COMPANY_INFO.infrastructure.factoryTitle}</h3>
                {COMPANY_INFO.infrastructure.factoryDescription.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </AnimatedSection>

            <AnimatedSection delay={0.15}>
              <div className={`${styles.infrastructureCard} ${styles.leadershipCard}`}>
                <div className={styles.infrastructureIcon}>
                  <Users size={24} />
                </div>
                <h3>Leadership</h3>
                <p>{COMPANY_INFO.companyDescription[3]}</p>
                <div className={styles.leadershipList}>
                  {COMPANY_INFO.leadership.map((leader) => (
                    <div key={leader.name} className={styles.leadershipItem}>
                      <strong>{leader.name}</strong>
                      <span>{leader.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <AnimatedSection>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <span className="section-label">How We Have Evolved</span>
              <h2 className="section-title">Company Snapshot</h2>
            </div>
          </AnimatedSection>

          <div className={styles.timeline}>
            {timeline.map((item, i) => (
              <AnimatedSection key={i} delay={i * 0.1} direction={i % 2 === 0 ? 'left' : 'right'}>
                <div className={styles.timelineItem}>
                  <div className={styles.timelineYear}>{item.year}</div>
                  <div className={styles.timelineDot} />
                  <div className={styles.timelineContent}>{item.event}</div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>
      <section id="company-facts" className={`section section-alt ${styles.companyFactsSection}`}>
        <div className="container">
          <span className="section-label">Company facts</span><h2 className="section-title">Establishment, experience and supplier verification</h2>
          <dl className={styles.companyFacts}>
            <div><dt>Business name</dt><dd>{COMPANY_INFO.legalName}</dd></div>
            <div><dt>Business established</dt><dd>{COMPANY_INFO.foundedYear}</dd></div>
            <div><dt>Team industry experience</dt><dd>Since {COMPANY_INFO.industryExperienceSince}; prior experience is separate from company establishment.</dd></div>
            <div><dt>Official website</dt><dd><a href={COMPANY_INFO.website}>{COMPANY_INFO.website}</a></dd></div>
            <div><dt>Head office</dt><dd>{COMPANY_INFO.headOffice}</dd></div>
            <div><dt>Manufacturing facility</dt><dd>{COMPANY_INFO.factory}</dd></div>
          </dl>
          <p>Use the <Link href="/contact">published contact details</Link> to request a configuration-specific quotation, arrange a product trial or coordinate a factory visit. Ask for current registration details and relevant customer references directly; website information is not an independent certification or customer review.</p>
          <div className={styles.companyQuestions}>{companyQuestions.map(({ q, a }) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
          <p><Link href="/solutions">Explore machine applications and buying guides</Link> · <Link href="/schedule-meeting">Arrange a technical discussion</Link></p>
        </div>
      </section>
    </>
  );
}
