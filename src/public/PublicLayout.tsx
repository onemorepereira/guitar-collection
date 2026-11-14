import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { PickIcon } from '../components/PickIcon';
import { PRIVACY_URL, TERMS_URL } from '../components/LegalLinks';
import { FEATURE_LINKS } from './links';

const navLink = 'text-gray-700 dark:text-gray-200 hover:text-primary-600 dark:hover:text-primary-400';

/** Header and footer for the public, indexable pages. Works without JavaScript. */
export const PublicLayout = ({ children }: { children: ReactNode }) => {
  const menu = useRef<HTMLDetailsElement>(null);
  const { pathname } = useLocation();
  // Close the mobile menu after client-side navigation
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="GuitarHelp home">
            <span className="w-9 h-9 bg-primary-600 dark:bg-primary-500 rounded-full flex items-center justify-center">
              <PickIcon className="w-9 h-9 text-white" />
            </span>
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">GuitarHelp</span>
          </Link>

          <nav aria-label="Main" className="hidden md:flex items-center gap-6 text-sm font-medium">
            {FEATURE_LINKS.map((f) => (
              <Link key={f.to} to={f.to} className={navLink}>{f.label}</Link>
            ))}
            <Link to="/faq" className={navLink}>FAQ</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-secondary text-sm">Sign in</Link>
            <Link to="/register" className="btn-primary text-sm hidden sm:inline-flex">Get started free</Link>
            <details ref={menu} className="md:hidden relative">
              <summary className="list-none cursor-pointer p-2 rounded-md text-gray-700 dark:text-gray-200" aria-label="Menu">
                <Menu className="w-5 h-5" />
              </summary>
              <nav aria-label="Mobile" className="absolute right-0 mt-2 w-64 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 flex flex-col text-sm">
                {FEATURE_LINKS.map((f) => (
                  <Link key={f.to} to={f.to} className={`px-3 py-2 rounded ${navLink}`}>{f.label}</Link>
                ))}
                <Link to="/faq" className={`px-3 py-2 rounded ${navLink}`}>FAQ</Link>
                <Link to="/register" className={`px-3 py-2 rounded ${navLink}`}>Get started free</Link>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid gap-6 sm:grid-cols-3 text-sm">
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">GuitarHelp</p>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Free guitar collection manager. Runs in your browser.</p>
          </div>
          <nav aria-label="Features">
            <p className="font-semibold text-gray-900 dark:text-gray-100">Features</p>
            <ul className="mt-1 space-y-1">
              {FEATURE_LINKS.map((f) => (
                <li key={f.to}><Link to={f.to} className="text-gray-600 dark:text-gray-400 hover:underline">{f.label}</Link></li>
              ))}
            </ul>
          </nav>
          <nav aria-label="About">
            <p className="font-semibold text-gray-900 dark:text-gray-100">About</p>
            <ul className="mt-1 space-y-1">
              <li><Link to="/faq" className="text-gray-600 dark:text-gray-400 hover:underline">FAQ</Link></li>
              <li><a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-gray-400 hover:underline">Privacy</a></li>
              <li><a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-gray-400 hover:underline">Terms</a></li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
};
