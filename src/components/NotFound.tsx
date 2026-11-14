import { Link } from 'react-router-dom';
import { PublicLayout } from '../public/PublicLayout';

/** Catch-all route; pre-rendered to 404.html, served by CloudFront with status 404. */
export const NotFound = () => (
  <PublicLayout>
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Page not found</h1>
      <p className="mt-3 text-gray-600 dark:text-gray-400">That page doesn’t exist, or it has moved.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primary">Go to the homepage</Link>
        <Link to="/faq" className="btn-secondary">Read the FAQ</Link>
      </div>
    </div>
  </PublicLayout>
);
