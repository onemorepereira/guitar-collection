import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const THEME_ORDER = ['light', 'dark', 'system'] as const;

export const ThemeToggle = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const cycleTheme = () => {
    const currentIndex = THEME_ORDER.indexOf(theme);
    const nextIndex = (currentIndex + 1) % THEME_ORDER.length;
    setTheme(THEME_ORDER[nextIndex]);
  };

  const getIcon = () => {
    if (theme === 'system') {
      return <Monitor className="w-5 h-5" />;
    }
    return resolvedTheme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />;
  };

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light mode';
      case 'dark':
        return 'Dark mode';
      case 'system':
        return `System (${resolvedTheme})`;
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100
                 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800
                 transition-colors duration-200"
      title={getLabel()}
      aria-label={`Theme: ${getLabel()}. Click to change.`}
    >
      {getIcon()}
    </button>
  );
};
