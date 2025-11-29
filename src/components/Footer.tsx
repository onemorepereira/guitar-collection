export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          © {currentYear} Miguel Pereira
        </p>
      </div>
    </footer>
  );
};
