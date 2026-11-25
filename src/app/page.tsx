import { completePageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';
import { getSiteSetting, listCategories, listProducts } from '@/lib/cms';
import { parseHeroCarouselSettings } from '@/lib/home-hero';
import { FAQS, PRODUCTS } from '@/lib/data';
import { withTimeout } from '@/lib/async-timeout';
import SolutionLinks from '@/components/solutions/SolutionLinks';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = completePageMetadata({
  title: { absolute: 'Packaging Machine Manufacturer in India | Spectra Pack Machines' },
  description:
    'Spectra Pack Machines manufactures shrink wrapping, sealing, vacuum packaging, filling and conveyor systems in Mumbai, with supply and support across India.',
  keywords: [
    'packaging machine manufacturer in India',
    'packing machine',
    'Spectra Pack Machine',
    'spectrapackmachine',
    'shrink wrapping machine',
    'sealing machine manufacturer',
    'vacuum packaging machine',
    'conveyor system manufacturer',
    'pallet stretch wrapping machine',
  ],
  alternates: { canonical: '/' },
}, { keepBrand: true, maxLength: 160 });

const getHomePageData = async () => {
  try {
    const [products, categories, heroSetting] = await withTimeout(
      Promise.all([
        listProducts({ publishedOnly: true }),
        listCategories({ publishedOnly: true }),
        getSiteSetting('hero_carousel_overrides', { access: 'public' }),
      ]),
      8000,
      'Homepage CMS data',
    );
    const rawHeroSettings = heroSetting?.jsonValue || (() => {
      try {
        return heroSetting?.value ? JSON.parse(heroSetting.value) : {};
      } catch {
        return {};
      }
    })();

    return {
      products,
      categories,
      heroSettings: parseHeroCarouselSettings(rawHeroSettings),
    };
  } catch {
    return {
      products: PRODUCTS,
      categories: [],
      heroSettings: {
        overrides: {},
        orderedIds: [],
        hiddenIds: [],
        customSlides: [],
      },
    };
  }
};

export default async function HomePage() {
  const { products, categories, heroSettings } = await getHomePageData();

  const homeStructuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.a,
        },
      })),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeStructuredData) }}
      />
      <HomePageClient
        initialProducts={products}
        initialCategories={categories}
        initialHeroSettings={heroSettings}
      />
      <SolutionLinks />
    </>
  );
}
