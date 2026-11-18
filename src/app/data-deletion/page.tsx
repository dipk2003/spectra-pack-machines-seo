import type { Metadata } from 'next';
import { completePageMetadata } from '@/lib/seo';
import { COMPANY_INFO } from '@/lib/data';
import styles from '../privacy-policy/page.module.css';

export const metadata: Metadata = completePageMetadata({
  title: 'Data Deletion Instructions',
  description: 'How to request deletion of information held by Spectra Pack Machines.',
  alternates: { canonical: '/data-deletion' },
  robots: { index: true, follow: true },
});

export default function DataDeletionPage() {
  return (
    <main className={styles.page}>
      <div className="container">
        <article className={styles.card}>
          <span className="section-label">Privacy & Data Use</span>
          <h1>Data Deletion Instructions</h1>
          <p>
            You can ask Spectra Pack Machines to delete personal information you submitted through our website,
            WhatsApp Business account, or an advertising lead form that was added to our sales CRM.
          </p>
          <h2>How to request deletion</h2>
          <ol>
            <li>
              Email <a href={`mailto:${COMPANY_INFO.email[0]}`}>{COMPANY_INFO.email[0]}</a> with the subject
              “Data deletion request”.
            </li>
            <li>Tell us the email address or phone number used for the enquiry and which information you want deleted.</li>
            <li>We may contact you to verify that you are the person the information is about.</li>
          </ol>
          <p>
            After verification, we will delete or de-identify the information we control, unless we must retain
            particular records for legal, security, or legitimate business recordkeeping requirements. This request
            covers records held by Spectra Pack Machines; Meta may separately retain information under its own
            policies. For information held by Meta, use Meta’s privacy and account controls as well.
          </p>
          <h2>Contact</h2>
          <p>
            You can also use our <a href="/contact">contact page</a>. See our <a href="/privacy-policy">Privacy Policy</a>
            {' '}for more information about how we use and retain enquiry data.
          </p>
        </article>
      </div>
    </main>
  );
}
