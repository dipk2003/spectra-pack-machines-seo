import { completePageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = completePageMetadata({
  title: 'Contact & Packaging Machine Quote',
  description:
    'Contact Spectra Pack Machines for packaging machine quotes, application advice and service. Share your product, required output and delivery location.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact Spectra Pack Machines',
    url: '/contact',
  },
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
