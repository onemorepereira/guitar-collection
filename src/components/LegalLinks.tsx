/**
 * Links to the static legal pages. The version query makes browsers that
 * cached an older copy (earlier deploys sent a 1-year max-age) fetch the
 * current one; bump it when the pages change. CloudFront ignores the query.
 */
export const LEGAL_VERSION = '2026111402';
export const PRIVACY_URL = `/privacy.html?v=${LEGAL_VERSION}`;
export const TERMS_URL = `/terms.html?v=${LEGAL_VERSION}`;

export const LegalLinks = ({ className = '' }: { className?: string }) => (
  <p className={`text-center text-xs text-gray-500 dark:text-gray-400 ${className}`}>
    <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="hover:underline">
      Privacy
    </a>
    {' · '}
    <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="hover:underline">
      Terms
    </a>
  </p>
);
