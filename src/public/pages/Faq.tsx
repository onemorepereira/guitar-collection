import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../PublicLayout';
import { useDocumentHead } from '../useDocumentHead';
import { PRIVACY_URL } from '../../components/LegalLinks';

const a = 'text-primary-600 dark:text-primary-400 underline';

const FAQ: [string, ReactNode][] = [
  [
    'Is GuitarHelp free?',
    'Yes. There is no paid plan, no ads and no limit on how many guitars you add. It is a hobby project.',
  ],
  [
    'Do I need to install anything?',
    'No. GuitarHelp runs in any modern web browser on a computer, tablet or phone. You need an internet connection to use it.',
  ],
  [
    'Who can see my guitars?',
    <>
      Only you. Others can see a guitar in two cases, both off until you turn them on: you create a share link
      for it (and pick which fields the link shows), or you add it to the public gallery on the homepage. Private
      details such as purchase price, receipts and notes never appear in the gallery. See{' '}
      <Link to="/features/selling" className={a}>selling a guitar</Link>.
    </>,
  ],
  [
    'Can I get my data out?',
    'Yes. On the Account page you can export everything: a ZIP with all your records and every photo, receipt and document you uploaded. It is usually ready within minutes and can be downloaded for 7 days.',
  ],
  [
    'How do I delete my account?',
    <>
      On the Account page, with your password. Deletion takes about 20 minutes and removes your guitars, photos,
      documents, share links and sign-in account. A few backup copies expire on their own afterwards; the{' '}
      <a href={`${PRIVACY_URL}#retention`} className={a}>privacy policy</a> lists each one and how long it is kept.
    </>,
  ],
  [
    'Does GuitarHelp use AI?',
    <>
      Yes, for reading documents, receipts and spec sheets, and for drafting provenance reports and sales
      listings. Uploaded documents are read automatically; the other features run when you ask. The AI services
      run on Amazon Web Services. See{' '}
      <Link to="/features/ai-import" className={a}>AI import</Link> and the{' '}
      <a href={`${PRIVACY_URL}#ai`} className={a}>privacy policy</a> for what is sent.
    </>,
  ],
  [
    'Is my data secure?',
    'All traffic uses HTTPS, and your records and files are encrypted at rest. GuitarHelp doesn’t sell data, show ads, use cookies or run analytics. No system is perfectly secure, so keep your own export as a backup.',
  ],
  [
    'Which guitars does GuitarHelp know?',
    'As you type, it suggests about 160 popular models from 20 brands, including Fender, Gibson, PRS, Ibanez, ESP, Gretsch, Rickenbacker, Taylor and Martin, and can fill in typical specs for those brands. You can add any guitar, though; for others you type the specs yourself or import them from a spec sheet.',
  ],
  [
    'Can it help me insure my collection?',
    <>
      It keeps what an insurer usually asks for: serial numbers, photos, receipts, purchase price, current value
      and condition. It doesn’t fill in insurance forms or value guitars for you. See{' '}
      <Link to="/features/insurance-inventory" className={a}>insurance-ready inventory</Link>.
    </>,
  ],
  [
    'How is it different from guitar inventory apps in the app stores?',
    'GuitarHelp runs in the browser, so there is nothing to install and it works the same on every device. It is free, it can read receipts, spec sheets and scanned documents with AI, it records condition on a diagram of the guitar, and it can share a guitar through a link. It doesn’t work offline.',
  ],
  [
    'Who runs GuitarHelp?',
    <>
      It is a free hobby project, run by the owner of the{' '}
      <a href="https://github.com/onemorepereira/guitar-collection" className={a}>GitHub repository</a> where
      its code is published. Questions and requests go through GitHub, as described in the{' '}
      <a href={`${PRIVACY_URL}#contact`} className={a}>privacy policy</a>.
    </>,
  ],
];

/** FAQ page, pre-rendered at build time (no FAQPage markup: those rich results ended in May 2026). */
export const Faq = () => {
  useDocumentHead('/faq');
  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">GuitarHelp FAQ</h1>
        <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">
          Short answers about what GuitarHelp is, what it costs and what happens to your data.
        </p>
        {FAQ.map(([q, ans]) => (
          <section key={q} className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{q}</h2>
            <p className="mt-2 text-gray-700 dark:text-gray-300 leading-relaxed">{ans}</p>
          </section>
        ))}
        <section className="mt-12 rounded-xl bg-primary-50 dark:bg-gray-800 p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Ready to try it?</h2>
          <Link to="/register" className="btn-primary px-8 mt-4 inline-flex">Start your collection</Link>
        </section>
      </article>
    </PublicLayout>
  );
};
