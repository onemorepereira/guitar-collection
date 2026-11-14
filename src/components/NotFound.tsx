import { Link } from 'react-router-dom';

export const NotFound = () => (
  <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center bg-gray-50 dark:bg-gray-900">
    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Page not found</h1>
    <p className="text-gray-600 dark:text-gray-400">That page doesn't exist.</p>
    <Link to="/" className="text-primary-600 dark:text-primary-400 underline">Go to the GuitarHelp homepage</Link>
  </main>
);
