import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../PublicLayout';
import { FEATURE_LINKS } from '../links';
import { useDocumentHead } from '../useDocumentHead';
import type { FeatureSlug } from '../pages';
import { PRIVACY_URL } from '../../components/LegalLinks';

interface Section {
  heading: string;
  body: ReactNode;
}

interface Shot {
  /** File in src/assets/features/ (1200×750 WebP, metadata stripped). */
  file: string;
  alt: string;
  caption: string;
  /** Shown after this section index. */
  after: number;
}

interface Feature {
  slug: FeatureSlug;
  breadcrumb: string;
  h1: string;
  intro: string;
  sections: Section[];
  shots: Shot[];
}

// Screenshots, fingerprinted by Vite; a shot renders only once its file exists.
const SHOT_URLS = Object.fromEntries(
  Object.entries(import.meta.glob('../../assets/features/*.webp', { eager: true, import: 'default' })).map(
    ([path, url]) => [path.split('/').pop() as string, url as string]
  )
);
const SHOT_WIDTH = 1200;
const SHOT_HEIGHT = 750;

const p = 'mt-3 text-gray-700 dark:text-gray-300 leading-relaxed';
const ul = 'mt-3 list-disc pl-6 space-y-1 text-gray-700 dark:text-gray-300';

const FEATURES: Record<FeatureSlug, Feature> = {
  'insurance-inventory': {
    slug: 'insurance-inventory',
    breadcrumb: 'Insurance-ready inventory',
    h1: 'A guitar inventory you can hand to your insurer',
    intro:
      'If a guitar is stolen or damaged, an insurer will ask what it was, what it was worth and how you can prove it. GuitarHelp keeps those answers for every guitar in your collection in one place, so you are not hunting through drawers, inboxes and old phones when it matters.',
    shots: [
      { file: 'insurance-guitar-record.webp', alt: 'A guitar record in GuitarHelp with photos, specs and purchase details', caption: 'One record per guitar: photos, specs and purchase details together.', after: 0 },
      { file: 'insurance-documents.webp', alt: 'The documents list with a receipt and a manual linked to a guitar', caption: 'Receipts and manuals linked to the guitars they belong to.', after: 1 },
    ],
    sections: [
      {
        heading: 'What you can record for each guitar',
        body: (
          <>
            <p className={p}>Each guitar has its own record. Beyond the brand, model, year, type and colour, you can keep:</p>
            <ul className={ul}>
              <li>the serial number;</li>
              <li>the purchase date, price and where you bought it;</li>
              <li>its current value and your insurance details;</li>
              <li>the receipt, as a PDF or a photo;</li>
              <li>as many photos as you like, from any angle;</li>
              <li>specs such as body and neck woods, fretboard, pickups, bridge, tuners, finish and modifications;</li>
              <li>notes, and a condition report showing every mark on the body.</li>
            </ul>
            <p className={p}>
              Purchase details, receipts and notes are private information: they never appear in the public
              gallery, and a share link only shows them if you tick them yourself.
            </p>
          </>
        ),
      },
      {
        heading: 'Keep the paperwork with the guitar',
        body: (
          <p className={p}>
            Upload manuals, certificates of authenticity, appraisals, setup sheets and catalog pages as PDFs or
            images, and link each one to the guitars it belongs to. Documents are read automatically, so you can
            search for a word that appears inside a scanned page, not just its file name.
          </p>
        ),
      },
      {
        heading: 'Export everything in one file',
        body: (
          <>
            <p className={p}>
              From your Account page you can export your whole collection at any time. You get a ZIP with a data
              file holding every record you have entered, plus every photo, receipt and document you uploaded. It
              is usually ready within minutes and stays available to download for 7 days.
            </p>
            <p className={p}>
              Keep a copy somewhere safe, away from the guitars themselves, so the records survive whatever
              happens to the instruments. GuitarHelp doesn’t fill in insurance forms or value your guitars for
              you; it keeps the facts and the evidence organised so you can.
            </p>
          </>
        ),
      },
      {
        heading: 'Why it helps',
        body: (
          <ul className={ul}>
            <li>A claim goes faster when you can send the serial number, receipt and photos at once.</li>
            <li>Police and pawn-shop searches for stolen guitars need serial numbers and clear photos.</li>
            <li>Insurers often ask for proof of ownership and condition before a loss, not after.</li>
          </ul>
        ),
      },
    ],
  },
  'condition-reports': {
    slug: 'condition-reports',
    breadcrumb: 'Condition reports',
    h1: 'Document every scratch with a condition report',
    intro:
      'Words like “excellent” or “some playwear” mean different things to different people. A condition report in GuitarHelp shows exactly where each mark is, what it is and how serious it is, on a drawing of your guitar’s body.',
    shots: [
      { file: 'condition-diagram.webp', alt: 'A condition diagram of a guitar body with coloured markers for each issue', caption: 'Each marker is an issue; the colour shows how serious it is.', after: 0 },
      { file: 'condition-report.webp', alt: 'A condition report showing the score, its label and the list of issues', caption: 'The score and every issue, grouped by severity.', after: 1 },
    ],
    sections: [
      {
        heading: 'Mark issues on a diagram of your guitar',
        body: (
          <>
            <p className={p}>
              Pick the body shape closest to your guitar: Stratocaster, Telecaster, Les Paul, SG, semi-hollow,
              offset, superstrat, Explorer, Flying V or Rickenbacker style. Then click on the front or back of the
              drawing wherever there is something to record.
            </p>
            <p className={p}>For each mark you choose:</p>
            <ul className={ul}>
              <li>
                the type: scratch, ding or dent, chip, crack, wear, fret issue, hardware issue, electronics issue,
                repair, modification or other;
              </li>
              <li>the severity: minor, moderate or major;</li>
              <li>a note with the details.</li>
            </ul>
          </>
        ),
      },
      {
        heading: 'A condition score from 0 to 100',
        body: (
          <p className={p}>
            GuitarHelp turns the marks into a score: it starts at 100 and takes off 2 points for each minor
            issue, 5 for each moderate one and 10 for each major one. The score comes with a label, from Mint
            (95 and up) through Excellent (85+), Very Good (70+), Good (55+) and Fair (40+) to Poor (below 40). The report lists every
            issue grouped by severity, so the score is never a mystery.
          </p>
        ),
      },
      {
        heading: 'Share it with a buyer, a tech or an insurer',
        body: (
          <p className={p}>
            When you create a share link for a guitar, you can include its condition report. The person you send
            it to sees the diagram with every marker and the list of issues, without an account. It is a quick
            way to show a buyer what they are getting, or to show a repair shop what needs attention.
          </p>
        ),
      },
      {
        heading: 'Keep it current',
        body: (
          <p className={p}>
            Add a marker when something happens. Once it is fixed, remove the marker or add a repair marker in
            the same spot, so the history stays visible. Over time the report becomes a record of how the guitar
            has been looked after, which matters when you sell it or make a claim.
          </p>
        ),
      },
      {
        heading: 'What a condition report is, and isn’t',
        body: (
          <>
            <p className={p}>
              A condition report records what you can see and what you know about the guitar. It isn’t a
              professional appraisal, and the score doesn’t set a price; it is a consistent way to describe wear
              so that you, a buyer or a repair shop are talking about the same marks.
            </p>
            <ul className={ul}>
              <li>Photograph each marked area as well, and keep the photos with the guitar.</li>
              <li>Record the condition when the guitar arrives, then again after big changes like a refret.</li>
              <li>Use the note on each marker for the details a buyer would ask about, such as size or depth.</li>
            </ul>
          </>
        ),
      },
    ],
  },
  selling: {
    slug: 'selling',
    breadcrumb: 'Selling a guitar',
    h1: 'Sell a guitar with a share link and a ready-made listing',
    intro:
      'When you sell a guitar, buyers want photos, specs and an honest account of its condition. GuitarHelp already has all of that, so you can share it in a link and draft the listing text from it.',
    shots: [
      { file: 'selling-share-options.webp', alt: 'The share dialog with checkboxes for the fields a share link shows', caption: 'Choose exactly what a share link shows.', after: 0 },
      { file: 'selling-share-page.webp', alt: 'A shared guitar page as a buyer sees it, with watermarked photos', caption: 'What the buyer sees, without an account.', after: 1 },
    ],
    sections: [
      {
        heading: 'A share link that shows only what you choose',
        body: (
          <>
            <p className={p}>
              Create a share link for any guitar and tick the fields the recipient may see: basic details such as
              brand, model and year; specifications; detailed specs; the condition report; and, only if you want,
              private details like the purchase price and date, your notes or documents. You also choose which
              photos to include.
            </p>
            <p className={p}>
              The photos on a share page are resized copies with a small GuitarHelp watermark. Anyone with the link
              can open the page without signing up. You can revoke a link at any time, and the page stops working.
            </p>
          </>
        ),
      },
      {
        heading: 'See when the link is opened',
        body: (
          <p className={p}>
            Each share link counts its views and shows you when it was opened and from what kind of browser, so
            you know whether a buyer has looked. No IP addresses are recorded.
          </p>
        ),
      },
      {
        heading: 'Draft the listing from the guitar’s details',
        body: (
          <p className={p}>
            GuitarHelp can generate a sales listing for a guitar using its specs, notes, condition and linked
            documents. Read it, edit it to your taste and paste it into the marketplace you sell on. It saves the
            blank-page part of writing an ad, and it only uses what you have recorded.
          </p>
        ),
      },
      {
        heading: 'Why it helps',
        body: (
          <ul className={ul}>
            <li>Buyers trust a listing that shows every flaw up front, and ask fewer questions.</li>
            <li>One link works everywhere: marketplaces, forums, chat apps and email.</li>
            <li>You decide what stays private, guitar by guitar.</li>
          </ul>
        ),
      },
      {
        heading: 'Before you list, and after you sell',
        body: (
          <>
            <p className={p}>
              Before you list a guitar, bring its record up to date: check the specs, add a few clear photos and
              make sure the condition report shows every mark. A buyer who sees the flaws in advance is less
              likely to ask for money back later.
            </p>
            <p className={p}>
              After the sale, revoke the share link, or delete the guitar from your collection if you no longer
              want its record. Deleting a guitar also deletes its share links and their view history. If you want
              to keep the paperwork, export your data first.
            </p>
          </>
        ),
      },
    ],
  },
  'ai-import': {
    slug: 'ai-import',
    breadcrumb: 'AI import',
    h1: 'Fill in specs, receipts and documents with AI',
    intro:
      'Typing in every spec of every guitar is the part that makes people give up on an inventory. GuitarHelp does as much of it for you as it can, and shows you what it filled in before anything is saved.',
    shots: [
      { file: 'ai-autofill.webp', alt: 'Model suggestions while typing a guitar name, with specs ready to fill in', caption: 'Suggestions as you type, with typical specs for known models.', after: 0 },
      { file: 'ai-receipt-review.webp', alt: 'Purchase details read from a sample receipt, shown for review before applying', caption: 'Receipt details are shown for review before anything is applied (sample receipt).', after: 2 },
    ],
    sections: [
      {
        heading: 'Specs that fill in as you type',
        body: (
          <p className={p}>
            Start typing a brand and model and GuitarHelp suggests matches, even with a short or misspelt name
            like “strat”. For about 160 popular models from 20 brands, including Fender, Gibson, PRS, Ibanez,
            Gretsch, Taylor and Martin, choosing a model fills in typical specs such as woods, scale length,
            pickups and frets. You can change anything that differs on your guitar.
          </p>
        ),
      },
      {
        heading: 'Import specs from a spec sheet',
        body: (
          <p className={p}>
            Paste text from a manufacturer’s page or upload a PDF or text file, and AI pulls out the
            specifications. Before you apply them, you review each field next to the place in the source text it
            came from, and keep only what is right.
          </p>
        ),
      },
      {
        heading: 'Read a receipt for you',
        body: (
          <p className={p}>
            Upload a receipt as a PDF or photo, or paste its text, and GuitarHelp extracts the purchase details,
            such as the date, price and seller, so you can add them to the guitar’s record after checking them.
          </p>
        ),
      },
      {
        heading: 'Make scanned documents searchable',
        body: (
          <p className={p}>
            When you upload a PDF or image to your documents, it is read automatically in the background. Scanned
            pages are turned into text, and photos get a short description, so a search for a word or a model
            name finds the catalog page or manual that mentions it.
          </p>
        ),
      },
      {
        heading: 'You stay in control',
        body: (
          <ul className={ul}>
            <li>Auto-filled specs are suggestions in the form; nothing is saved until you save the guitar.</li>
            <li>Imported specs and receipt details are shown for review first, and you choose what to apply.</li>
            <li>
              Each document shows whether it has been read yet: pending, processing, completed or failed, and you
              can filter the list by that status.
            </li>
          </ul>
        ),
      },
      {
        heading: 'How your content is processed',
        body: (
          <p className={p}>
            These features use AI services on Amazon Web Services (Amazon Textract and Amazon Bedrock). The{' '}
            <a href={`${PRIVACY_URL}#ai`} className="text-primary-600 dark:text-primary-400 underline">
              privacy policy
            </a>{' '}
            explains exactly what is sent and how AWS treats it.
          </p>
        ),
      },
    ],
  },
};

/** One feature page, pre-rendered at build time. */
export const FeaturePage = ({ slug }: { slug: FeatureSlug }) => {
  const f = FEATURES[slug];
  useDocumentHead(`/features/${slug}`);
  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-gray-500 dark:text-gray-400">
          <Link to="/" className="hover:underline">Home</Link> › <span>{f.breadcrumb}</span>
        </nav>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">{f.h1}</h1>
        <p className="mt-4 text-lg text-gray-700 dark:text-gray-300 leading-relaxed">{f.intro}</p>
        {f.sections.map((s, i) => (
          <div key={s.heading}>
            <section className="mt-10">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{s.heading}</h2>
              {s.body}
            </section>
            {f.shots
              .filter((shot) => shot.after === i && SHOT_URLS[shot.file])
              .map((shot) => (
                <figure key={shot.file} className="mt-8">
                  <img
                    src={SHOT_URLS[shot.file]}
                    alt={shot.alt}
                    width={SHOT_WIDTH}
                    height={SHOT_HEIGHT}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    className="w-full h-auto rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
                  />
                  <figcaption className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">{shot.caption}</figcaption>
                </figure>
              ))}
          </div>
        ))}
        <section className="mt-12 rounded-xl bg-primary-50 dark:bg-gray-800 p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Try it with your own guitars</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">GuitarHelp is free and runs in your browser.</p>
          <Link to="/register" className="btn-primary px-8 mt-4 inline-flex">Start your collection</Link>
        </section>
        <nav aria-label="Related features" className="mt-12">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Related features</h2>
          <ul className="mt-2 space-y-1">
            {FEATURE_LINKS.filter((l) => l.to !== `/features/${slug}`).map((l) => (
              <li key={l.to}><Link to={l.to} className="text-primary-600 dark:text-primary-400 hover:underline">{l.label}</Link></li>
            ))}
            <li><Link to="/faq" className="text-primary-600 dark:text-primary-400 hover:underline">Frequently asked questions</Link></li>
          </ul>
        </nav>
      </article>
    </PublicLayout>
  );
};
