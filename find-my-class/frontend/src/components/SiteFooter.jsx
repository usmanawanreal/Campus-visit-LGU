import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Mail, Github, Linkedin, Share2 } from 'lucide-react';

const social = [
  { icon: Share2, href: '#', label: 'Updates' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Github, href: '#', label: 'GitHub' }
];

export default function SiteFooter() {
  return (
    <footer id="contact-footer" className="relative border-t border-gray-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-gray-900 dark:text-gray-50">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/25">
                <GraduationCap className="h-5 w-5" aria-hidden />
              </span>
              Find My Class
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              Campus navigation and classroom discovery — built for students, staff, and visitors.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-gray-100">Explore</h3>
            <ul className="mt-4 space-y-2">
              {[
                { to: '/search', label: 'Search classroom' },
                { to: '/map', label: 'Campus map' },
                { to: '/#about-section', label: 'About' },
                { to: '/login', label: 'Sign in' }
              ].map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-sm text-gray-600 transition-colors hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-gray-100">Resources</h3>
            <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>
                <a href="#about-section" className="transition-colors hover:text-brand-600 dark:hover:text-brand-400">
                  How it works
                </a>
              </li>
              <li>
                <a href="#jobs-section" className="transition-colors hover:text-brand-600 dark:hover:text-brand-400">
                  Featured spaces
                </a>
              </li>
              <li>
                <Link to="/map" className="transition-colors hover:text-brand-600 dark:hover:text-brand-400">
                  Indoor routes
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-gray-100">Stay in touch</h3>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Newsletter (demo — no backend)</p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <label htmlFor="footer-email" className="sr-only">
                Email
              </label>
              <input
                id="footer-email"
                type="email"
                placeholder="you@university.edu"
                className="min-w-0 flex-1 rounded-full border border-gray-200 bg-gray-50/80 px-4 py-2.5 text-sm text-gray-900 outline-none ring-brand-500/30 transition-all focus:border-brand-500 focus:bg-white focus:ring-4 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100 dark:focus:border-brand-500 dark:focus:bg-slate-800"
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
              >
                Join
              </motion.button>
            </form>
            <div className="mt-6 flex gap-3">
              {social.map(({ icon: Icon, href, label }) => (
                <motion.a
                  key={label}
                  href={href}
                  aria-label={label}
                  whileHover={{ y: -3, scale: 1.08 }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-brand-200 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-400 dark:hover:border-brand-600 dark:hover:text-brand-400"
                >
                  <Icon className="h-4 w-4" />
                </motion.a>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-8 dark:border-slate-800 sm:flex-row">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} Find My Class. All rights reserved.
          </p>
          <p className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
            <Mail className="h-4 w-4" aria-hidden />
            contact@campus.edu
          </p>
        </div>
      </div>
    </footer>
  );
}
