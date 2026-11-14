/**
 * Public, indexable pages: the single source for head tags, pre-render
 * targets, the sitemap and the CloudFront router's public list.
 */
export const SITE_URL = 'https://guitarhelp.click';
export const SITE_NAME = 'GuitarHelp';
export const OG_IMAGE = `${SITE_URL}/og/guitarhelp-1200x630.png`;
export const OG_IMAGE_ALT = 'GuitarHelp: a free guitar collection manager that runs in your browser';

export interface PublicPage {
  path: string;
  /** Output file relative to dist/ (prerendered) or the static file in public/. */
  file: string;
  title: string;
  description: string;
  /** Source files whose last commit date becomes the sitemap <lastmod>. */
  sources: string[];
  /** Static pages (legal) are hand-written HTML: listed for the sitemap and tests only. */
  static?: boolean;
  jsonLd?: object[];
}

export const FEATURE_SLUGS = ['insurance-inventory', 'condition-reports', 'selling', 'ai-import'] as const;
export type FeatureSlug = (typeof FEATURE_SLUGS)[number];

const homeJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description:
      'A free guitar collection manager in your browser: specs, photos, receipts, documents, condition reports and share links for every guitar you own.',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Any (web browser)',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${SITE_URL}/`,
  },
];

export const PUBLIC_PAGES: PublicPage[] = [
  {
    path: '/',
    file: 'index.html',
    title: 'GuitarHelp: Free Guitar Collection Manager',
    description:
      'Keep every guitar you own in one place: specs, photos, receipts, documents and condition. Free, runs in your browser, nothing to install.',
    sources: ['src/public/pages/Home.tsx'],
    jsonLd: homeJsonLd,
  },
  {
    path: '/features/insurance-inventory',
    file: 'features/insurance-inventory/index.html',
    title: 'Guitar Inventory for Insurance | GuitarHelp',
    description:
      'Record serial numbers, photos, receipts and purchase details for every guitar, so you have what an insurer asks for. Export it all as a ZIP anytime.',
    sources: ['src/public/pages/features.tsx'],
  },
  {
    path: '/features/condition-reports',
    file: 'features/condition-reports/index.html',
    title: 'Guitar Condition Reports | GuitarHelp',
    description:
      'Mark scratches, dings and repairs on a diagram of your guitar, rate how serious each one is, and get a condition score you can share with a buyer.',
    sources: ['src/public/pages/features.tsx'],
  },
  {
    path: '/features/selling',
    file: 'features/selling/index.html',
    title: 'Sell a Guitar with a Share Link | GuitarHelp',
    description:
      'Share a guitar with a private link showing only the fields you choose, with watermarked photos, and draft a sales listing from its details.',
    sources: ['src/public/pages/features.tsx'],
  },
  {
    path: '/features/ai-import',
    file: 'features/ai-import/index.html',
    title: 'AI Spec, Receipt and Document Import | GuitarHelp',
    description:
      'Fill in guitar specs from a model name or a spec sheet, pull purchase details from a receipt, and make scanned manuals and catalogs searchable with AI.',
    sources: ['src/public/pages/features.tsx'],
  },
  {
    path: '/faq',
    file: 'faq/index.html',
    title: 'Guitar Collection App FAQ | GuitarHelp',
    description:
      'Answers about GuitarHelp: what it costs, who can see your guitars, how AI is used, exporting and deleting your data, and how it compares to apps.',
    sources: ['src/public/pages/Faq.tsx'],
  },
  {
    path: '/privacy.html',
    file: 'privacy.html',
    title: 'Privacy Policy | GuitarHelp',
    description:
      'What GuitarHelp collects, who can see your guitars, how AI services process your documents, how long data is kept, and how to export or delete it.',
    sources: ['public/privacy.html'],
    static: true,
  },
  {
    path: '/terms.html',
    file: 'terms.html',
    title: 'Terms of Service | GuitarHelp',
    description:
      'The plain-English terms for using GuitarHelp, a free hobby project: your content stays yours, what we will and will not do, and our limits of liability.',
    sources: ['public/terms.html'],
    static: true,
  },
];

export const pageFor = (path: string) => PUBLIC_PAGES.find((p) => p.path === path);
