import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Search,
  Menu,
  X,
  ChevronDown
} from 'lucide-react';

const navLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/search', label: 'Search' },
  { to: '/map', label: 'Campus Map' },
  { to: '/#about-section', label: 'About', hash: true },
  { to: '/#contact-footer', label: 'Contact', hash: true }
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMegaOpen(false);
  }, [location.pathname]);

  /** Solid bar behind links — blur + translucent white can look “washed” over light sections and wash out dark-mode text. */
  const isSolidBar = scrolled || mobileOpen;
  const navClass = isSolidBar
    ? 'border-b border-gray-200/80 bg-white/95 shadow-sm backdrop-blur-xl dark:border-slate-700 dark:bg-[#0f172a] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)] dark:backdrop-blur-none'
    : 'border-b border-transparent bg-transparent dark:bg-transparent';

  const linkMuted = isSolidBar
    ? 'text-gray-700 hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-400'
    : 'text-gray-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400';

  const linkInactiveNav = isSolidBar
    ? 'text-gray-700 group-hover:text-brand-600 dark:text-slate-200 dark:group-hover:text-brand-400'
    : 'text-gray-600 group-hover:text-brand-600 dark:text-slate-300 dark:group-hover:text-brand-400';

  return (
    <>
      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed inset-x-0 top-0 z-[100] transition-[background,border] duration-300 ${navClass}`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-[4.25rem] sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-gray-900 dark:text-slate-50"
          >
            <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/35 ring-4 ring-brand-500/15">
              <GraduationCap className="h-6 w-6" aria-hidden />
              <span className="pointer-events-none absolute inset-0 rounded-2xl bg-white/15 opacity-0 blur-md transition-opacity group-hover:opacity-40" />
            </span>
            Find My Class
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map(({ to, label, end, hash }) =>
              hash ? (
                <a
                  key={to}
                  href={to}
                  className={`group relative px-3 py-2 text-sm font-medium transition-colors ${linkMuted}`}
                >
                  <span>{label}</span>
                  <span className="absolute inset-x-3 bottom-1 h-0.5 origin-left scale-x-0 rounded-full bg-brand-500 transition-transform duration-300 ease-out group-hover:scale-x-100" />
                </a>
              ) : (
                <NavLink key={to} to={to} end={end} className="group relative px-3 py-2 text-sm font-medium">
                  {({ isActive }) => (
                    <>
                      <span
                        className={
                          isActive
                            ? 'text-brand-600 dark:text-brand-400'
                            : linkInactiveNav
                        }
                      >
                        {label}
                      </span>
                      <span
                        className={`absolute inset-x-3 bottom-1 h-0.5 origin-left rounded-full bg-brand-500 transition-transform duration-300 ease-out ${
                          isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                        }`}
                      />
                    </>
                  )}
                </NavLink>
              )
            )}
            <div
              className="relative ml-2"
              onMouseEnter={() => setMegaOpen(true)}
              onMouseLeave={() => setMegaOpen(false)}
            >
              <button
                type="button"
                className={`flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-800 ${
                  isSolidBar
                    ? 'text-gray-700 dark:text-slate-200 dark:hover:text-brand-400'
                    : 'text-gray-600 dark:text-slate-300 dark:hover:text-brand-400'
                }`}
              >
                Quick links
                <ChevronDown className={`h-4 w-4 transition ${megaOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {megaOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="absolute left-1/2 top-full z-[110] mt-3 w-[min(100vw-2rem,28rem)] -translate-x-1/2 rounded-3xl border border-gray-100 bg-white/95 p-6 shadow-xl shadow-brand-900/10 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/98 dark:shadow-black/40"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Link
                        to="/search"
                        className="group rounded-2xl border border-gray-100 bg-gradient-to-br from-brand-50/90 to-white p-4 transition hover:border-brand-200 hover:shadow-md dark:border-slate-700 dark:from-slate-800/90 dark:to-slate-900 dark:hover:border-brand-600/50"
                      >
                        <p className="font-display font-semibold text-gray-900 dark:text-gray-100">Room lookup</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Find any classroom by number.</p>
                      </Link>
                      <Link
                        to="/map"
                        className="group rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-brand-50/50 p-4 transition hover:border-brand-200 hover:shadow-md dark:border-slate-700 dark:from-slate-900 dark:to-slate-800/80 dark:hover:border-brand-600/50"
                      >
                        <p className="font-display font-semibold text-gray-900 dark:text-gray-100">Interactive map</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Navigate floors with corridor routing.</p>
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle solidBar={isSolidBar} />
            <Link
              to="/search"
              aria-label="Search classrooms"
              className={`rounded-full p-2.5 transition hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-slate-800 dark:hover:text-brand-400 ${
                isSolidBar
                  ? 'text-gray-600 dark:text-slate-300'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Search className="h-5 w-5" />
            </Link>
            {isAuthenticated ? (
              <>
                {isAdmin ? (
                  <Link
                    to="/admin/dashboard"
                    className="hidden rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 shadow-sm transition hover:bg-brand-100 dark:border-brand-700/50 dark:bg-slate-800 dark:text-brand-300 dark:hover:bg-slate-700 sm:inline-flex"
                  >
                    Dashboard
                  </Link>
                ) : (
                  <span
                    className="hidden max-w-[10rem] truncate px-2 text-sm font-semibold text-gray-800 dark:text-slate-100 sm:inline-block"
                    title={user?.name || 'Signed in'}
                  >
                    {user?.name || 'Signed in'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`hidden rounded-full px-3 py-2 text-sm font-medium transition hover:bg-gray-100 sm:inline-flex ${
                    isSolidBar
                      ? 'text-gray-700 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-slate-800 dark:hover:text-gray-100'
                  }`}
                >
                  Log out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="hidden rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-brand-300 hover:bg-white hover:text-brand-700 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-200 dark:hover:border-brand-500 dark:hover:bg-slate-800 dark:hover:text-brand-400 sm:inline-flex"
              >
                Log in
              </Link>
            )}
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/map"
                className="hidden rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 ring-4 ring-brand-500/15 transition hover:shadow-glow dark:shadow-brand-900/40 dark:ring-brand-400/25 sm:inline-flex"
              >
                Get started
              </Link>
            </motion.div>
            <button
              type="button"
              className={`rounded-xl p-2 lg:hidden ${
                isSolidBar ? 'text-gray-800 dark:text-slate-200' : 'text-gray-700 dark:text-gray-300'
              }`}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="overflow-hidden border-t border-gray-100 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/98 lg:hidden"
            >
              <div className="flex flex-col gap-1 px-4 py-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-slate-800">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Appearance</span>
                  <ThemeToggle solidBar={isSolidBar} />
                </div>
                {navLinks.map(({ to, label, end, hash }) =>
                  hash ? (
                    <a key={to} href={to} className="rounded-xl px-3 py-3 text-gray-700 hover:bg-brand-50 dark:text-gray-200 dark:hover:bg-slate-800">
                      {label}
                    </a>
                  ) : (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        `rounded-xl px-3 py-3 ${isActive ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-slate-800 dark:text-brand-400' : 'text-gray-700 hover:bg-brand-50 dark:text-gray-200 dark:hover:bg-slate-800'}`
                      }
                    >
                      {label}
                    </NavLink>
                  )
                )}
                {isAuthenticated ? (
                  <>
                    {isAdmin ? (
                      <Link
                        to="/admin/dashboard"
                        className="mt-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-center font-semibold text-brand-800 dark:border-brand-700/60 dark:bg-slate-800 dark:text-brand-300"
                      >
                        Dashboard
                      </Link>
                    ) : (
                      <p className="mt-2 rounded-xl bg-gray-50 px-4 py-3 text-center font-semibold text-gray-800 dark:bg-slate-800 dark:text-gray-100">
                        {user?.name || 'Signed in'}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        handleLogout();
                        setMobileOpen(false);
                      }}
                      className="rounded-xl border border-gray-200 px-4 py-3 text-center font-semibold text-gray-800 dark:border-slate-600 dark:text-gray-200"
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    className="mt-2 rounded-xl border border-gray-200 px-4 py-3 text-center font-semibold text-gray-800 dark:border-slate-600 dark:text-gray-200"
                  >
                    Log in
                  </Link>
                )}
                <Link
                  to="/map"
                  className="rounded-xl bg-brand-600 px-4 py-3 text-center font-semibold text-white shadow-lg shadow-brand-600/25"
                >
                  Get started
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
      {/* spacer for fixed header */}
      <div className="h-16 shrink-0 sm:h-[4.25rem]" aria-hidden />
    </>
  );
}
