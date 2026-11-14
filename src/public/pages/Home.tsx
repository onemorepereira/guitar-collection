import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, ClipboardList, Share2, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PublicLayout } from '../PublicLayout';
import { FEATURE_LINKS } from '../links';
import { useDocumentHead } from '../useDocumentHead';
import { Showcase } from './Showcase';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'An inventory your insurer can use',
    body: 'Serial numbers, photos, receipts, purchase price and documents for every guitar, kept together. Export everything as a ZIP whenever you need it.',
  },
  {
    icon: ClipboardList,
    title: 'Condition reports',
    body: 'Mark each scratch, ding or repair on a diagram of your guitar’s body, rate how serious it is, and get a condition score.',
  },
  {
    icon: Share2,
    title: 'Share or sell',
    body: 'Send a buyer a link that shows only the fields you pick, with watermarked photos, and draft a sales listing from the guitar’s details.',
  },
  {
    icon: Sparkles,
    title: 'Less typing with AI',
    body: 'Model suggestions as you type, typical specs filled in on request, and AI that reads a spec sheet, a receipt, or a scanned manual for you.',
  },
];

const STEPS = [
  ['Add a guitar', 'Type the brand and model and pick from suggestions (about 160 popular models from 20 brands); GuitarHelp can fill in the brand’s typical specs for you to adjust.'],
  ['Attach the paperwork', 'Upload photos, receipts, manuals and certificates. Documents are read automatically so you can find what is in them.'],
  ['Keep it up to date', 'Write notes, record the guitar’s condition on a diagram, and see your collection’s history on a timeline.'],
  ['Use it when it matters', 'Export a ZIP of all your data and files for your insurer or your own backup, or share a guitar with a buyer.'],
];

const FAQ_TEASER = [
  ['Is GuitarHelp free?', 'Yes. There is no paid plan and no ads.'],
  ['Do I need to install anything?', 'No. It runs in any modern web browser, on a computer, tablet or phone.'],
  ['Who can see my guitars?', 'Only you, unless you create a share link for a guitar or add it to the public gallery. Both are off until you turn them on.'],
];

/** Public homepage, pre-rendered at build time. */
export const Home = () => {
  useDocumentHead('/');
  const navigate = useNavigate();
  const { search } = useLocation();
  const { isAuthenticated } = useAuth();
  // Read after mount so the pre-rendered HTML and the first client render match
  const [accountDeleting, setAccountDeleting] = useState(false);

  useEffect(() => {
    setAccountDeleting(new URLSearchParams(search).get('account') === 'deleting');
  }, [search]);

  // Signed-in visitors go straight to their collection (owner decision 2026-11-14)
  useEffect(() => {
    if (isAuthenticated) navigate('/collection');
  }, [isAuthenticated, navigate]);

  return (
    <PublicLayout>
      {accountDeleting && (
        <div role="status" className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 text-sm text-center px-4 py-3">
          Your account is being deleted. This takes about 20 minutes.
        </div>
      )}

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100">
          GuitarHelp: a free guitar collection manager
        </h1>
        <p className="mt-6 text-lg text-gray-600 dark:text-gray-300">
          Once you own more than a couple of guitars, the details start to scatter: serial numbers in a
          drawer, receipts in an inbox, photos on a phone. GuitarHelp keeps the specs, photos,
          paperwork and condition of every guitar together in one place. It is free and runs in your
          browser, with nothing to install.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register" className="btn-primary px-8">Start your collection</Link>
          <Link to="/login" className="btn-secondary">Sign in</Link>
        </div>
      </section>

      <section aria-labelledby="features" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 id="features" className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">
          What you can do with it
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <Link
              key={f.title}
              to={FEATURE_LINKS[i].to}
              className="block bg-white dark:bg-gray-800 rounded-xl shadow p-6 hover:shadow-lg transition-shadow"
            >
              <f.icon className="w-8 h-8 text-primary-600 dark:text-primary-400" aria-hidden="true" />
              <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{f.title}</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-300">{f.body}</p>
              <span className="mt-3 inline-block text-sm font-medium text-primary-600 dark:text-primary-400">
                Learn more: {FEATURE_LINKS[i].label} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="how" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 id="how" className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">How it works</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="shrink-0 w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold">{i + 1}</span>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
                <p className="mt-1 text-gray-600 dark:text-gray-300">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Community gallery" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Showcase />
      </section>

      <section aria-labelledby="faq-teaser" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 id="faq-teaser" className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">Common questions</h2>
        <dl className="mt-6 space-y-4">
          {FAQ_TEASER.map(([q, a]) => (
            <div key={q}>
              <dt className="font-semibold text-gray-900 dark:text-gray-100">{q}</dt>
              <dd className="mt-1 text-gray-600 dark:text-gray-300">{a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-center">
          <Link to="/faq" className="font-medium text-primary-600 dark:text-primary-400 hover:underline">Read all the questions and answers →</Link>
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Start your collection</h2>
        <p className="mt-3 text-gray-600 dark:text-gray-300">Create a free account and add your first guitar in a couple of minutes.</p>
        <Link to="/register" className="btn-primary px-8 mt-6 inline-flex">Get started free</Link>
      </section>
    </PublicLayout>
  );
};
