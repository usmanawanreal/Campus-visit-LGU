import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

export default function ThemeToggle({ className = '', solidBar = false }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const tone = solidBar
    ? 'text-gray-600 dark:text-slate-300'
    : 'text-gray-500 dark:text-gray-400';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`rounded-full p-2.5 transition hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-slate-800 dark:hover:text-brand-400 ${tone} ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  );
}
