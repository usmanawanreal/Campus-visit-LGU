import { useMemo, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import {
  MapPin,
  Search as SearchIcon,
  ArrowRight,
  Sparkles,
  Navigation,
  ShieldCheck,
  Zap,
  Heart,
  Upload,
  Building2,
  Briefcase,
  Star
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }
  })
};

const features = [
  {
    icon: Navigation,
    title: 'Turn-by-turn indoors',
    desc: 'Corridor-aware routing on your floor plans — walk the hallways, not through walls.'
  },
  {
    icon: Zap,
    title: 'Instant search',
    desc: 'Look up any classroom by number and jump straight to building and floor context.'
  },
  {
    icon: ShieldCheck,
    title: 'Trusted data',
    desc: 'Admins curate buildings, doors, and paths so directions stay accurate across terms.'
  },
  {
    icon: Sparkles,
    title: 'Premium map UX',
    desc: 'Glass panels, fluid motion, and a crisp emerald palette built for clarity.'
  }
];

const demoJobs = [
  {
    id: '1',
    company: 'Main Hall',
    logo: '🏛️',
    title: 'Study Commons — Quiet zone',
    location: 'Floor 2 · Wing B',
    salary: 'Open access',
    type: 'Study',
    exp: 'All levels'
  },
  {
    id: '2',
    company: 'Science Block',
    logo: '🔬',
    title: 'Lab 204 — Chemistry',
    location: 'Floor 1 · East',
    salary: 'Scheduled',
    type: 'Lab',
    exp: 'Staff-led'
  },
  {
    id: '3',
    company: 'Arts Center',
    logo: '🎭',
    title: 'Studio A — Digital media',
    location: 'Ground · North',
    salary: 'Booking',
    type: 'Creative',
    exp: 'Intermediate'
  },
  {
    id: '4',
    company: 'Library',
    logo: '📚',
    title: 'Research Desk — Quiet floor',
    location: 'Floor 3 · Central',
    salary: 'Walk-in',
    type: 'Support',
    exp: 'Everyone'
  }
];

const categories = ['All', 'Study', 'Lab', 'Creative', 'Support'];

const testimonials = [
  {
    name: 'Amina Rahman',
    role: 'Graduate student',
    avatar: 'AR',
    text: 'The map finally matches how I actually walk between buildings. The corridor lines make sense.',
    rating: 5
  },
  {
    name: 'Jordan Lee',
    role: 'Visitor',
    avatar: 'JL',
    text: 'Found my exam room in minutes. Search + map combo is miles ahead of PDF floor plans.',
    rating: 5
  },
  {
    name: 'Prof. Elena Costa',
    role: 'Faculty',
    avatar: 'EC',
    text: 'We publish updates once; students always see the latest routes. Huge time saver.',
    rating: 5
  }
];

const partners = ['Campus North', 'Innovation Hub', 'Student Union', 'Athletics', 'Research Park', 'Health Sci'];

function AnimatedCounter({ target, suffix = '' }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let frame;
    const duration = 1800;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setVal(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [isInView, target]);

  return (
    <span ref={ref}>
      {val}
      {suffix}
    </span>
  );
}

export default function Home() {
  const [jobQuery, setJobQuery] = useState('');
  const [locQuery, setLocQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [saved, setSaved] = useState({});
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  const filteredJobs = useMemo(() => {
    if (category === 'All') return demoJobs;
    return demoJobs.filter((j) => j.type === category);
  }, [category]);

  useEffect(() => {
    const id = setInterval(() => {
      setTestimonialIdx((i) => (i + 1) % testimonials.length);
    }, 5200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="overflow-x-hidden bg-[#f9fafb]">
      {/* Hero */}
      <section className="relative min-h-[88vh] overflow-hidden bg-hero-gradient px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ y: [0, -18, 0], rotate: [0, 4, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-brand-400/15 blur-3xl"
          />
          <motion.div
            animate={{ y: [0, 22, 0], rotate: [0, -3, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -right-16 top-40 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl"
          />
          <motion.div
            animate={{ scale: [1, 1.06, 1], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 7, repeat: Infinity }}
            className="absolute bottom-10 left-1/3 h-48 w-48 rounded-[2rem] bg-white/60 blur-2xl"
          />
        </div>

        <div className="relative mx-auto max-w-7xl pt-10">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              show: { transition: { staggerChildren: 0.08 } }
            }}
            className="mx-auto max-w-4xl text-center"
          >
            <motion.span
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-700 shadow-sm backdrop-blur-md"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Campus navigation · refined
            </motion.span>
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="font-display mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl lg:leading-[1.08]"
            >
              Find your classroom{' '}
              <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-brand-600 bg-clip-text text-transparent">
                faster
              </span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mx-auto mt-5 max-w-2xl text-lg text-gray-600 sm:text-xl"
            >
              Search rooms, explore multi-floor maps, and follow corridor-smart routes — all in one calm,
              modern experience inspired by leading travel and hiring products.
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.55 }}
            className="relative mx-auto mt-12 max-w-4xl"
          >
            <div className="rounded-[1.35rem] border border-white/80 bg-white/75 p-2 shadow-xl shadow-brand-900/10 backdrop-blur-xl ring-1 ring-brand-500/10">
              <div className="flex flex-col gap-2 rounded-2xl bg-gray-50/90 p-3 sm:flex-row sm:items-stretch">
                <label className="relative flex flex-1 items-center gap-3 rounded-xl border border-gray-200/80 bg-white px-4 py-3 shadow-sm transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/15">
                  <Briefcase className="h-5 w-5 shrink-0 text-brand-500" aria-hidden />
                  <input
                    type="text"
                    placeholder="Room, lab, or place…"
                    value={jobQuery}
                    onChange={(e) => setJobQuery(e.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent text-gray-900 outline-none placeholder:text-gray-400"
                  />
                </label>
                <label className="relative flex flex-1 items-center gap-3 rounded-xl border border-gray-200/80 bg-white px-4 py-3 shadow-sm transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/15">
                  <MapPin className="h-5 w-5 shrink-0 text-brand-500" aria-hidden />
                  <input
                    type="text"
                    placeholder="Building or area…"
                    value={locQuery}
                    onChange={(e) => setLocQuery(e.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent text-gray-900 outline-none placeholder:text-gray-400"
                  />
                </label>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="sm:w-auto">
                  <Link
                    to="/search"
                    className="flex h-full min-h-[52px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-8 font-semibold text-white shadow-lg shadow-brand-500/35 transition hover:shadow-glow"
                  >
                    <SearchIcon className="h-5 w-5" />
                    Search
                  </Link>
                </motion.div>
              </div>
            </div>
            <p className="mt-4 text-center text-sm text-gray-500">
              Tip: Use Search for room numbers — open the Map for full indoor routing.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/search"
                className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-gray-800"
              >
                Find rooms
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/map"
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-8 py-3.5 text-sm font-semibold text-gray-800 shadow-md transition hover:border-brand-200 hover:text-brand-700"
              >
                Open map
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="about-section" className="scroll-mt-28 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">Why teams choose it</h2>
            <p className="mt-3 text-gray-600">
              Purpose-built flows for campuses: fast discovery, credible paths, calm visual design.
            </p>
          </motion.div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.07, duration: 0.45 }}
                whileHover={{ y: -8, transition: { duration: 0.25 } }}
                className="group relative overflow-hidden rounded-3xl border border-gray-100 bg-white/90 p-6 shadow-lg shadow-gray-900/5 backdrop-blur-sm transition hover:border-brand-200/80 hover:shadow-xl"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-500/0 via-brand-500/0 to-brand-500/[0.07] opacity-0 transition group-hover:opacity-100" />
                <div className="relative">
                  <motion.span
                    whileHover={{ rotate: [0, -6, 6, 0] }}
                    transition={{ duration: 0.5 }}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30"
                  >
                    <Icon className="h-6 w-6" />
                  </motion.span>
                  <h3 className="mt-4 font-display text-lg font-semibold text-gray-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{desc}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Job-style listing + filters */}
      <section id="jobs-section" className="scroll-mt-28 bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-14">
            <aside className="lg:w-72 lg:shrink-0">
              <div className="sticky top-28 rounded-3xl border border-gray-100 bg-gray-50/90 p-6 shadow-inner backdrop-blur-md">
                <h3 className="font-display text-lg font-semibold text-gray-900">Filters</h3>
                <p className="mt-1 text-xs text-gray-500">Demo filters — refine the sample cards below.</p>
                <div className="mt-6 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Category</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {categories.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCategory(c)}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                            category === c
                              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
                              : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-brand-200'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Salary</p>
                    <input type="range" min="0" max="100" defaultValue="60" className="mt-3 w-full accent-brand-600" />
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 text-xs text-gray-600 ring-1 ring-gray-100">
                    Job type & experience filters are visual demos on this landing page — Search and Map keep full
                    functionality.
                  </div>
                </div>
              </div>
            </aside>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-display text-3xl font-bold text-gray-900">Featured spaces</h2>
                  <p className="mt-2 text-gray-600">Campus-themed cards — tap through to the map experience.</p>
                </div>
                <Link to="/map" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                  View full map →
                </Link>
              </div>
              <div className="mt-10 grid gap-5 sm:grid-cols-2">
                {filteredJobs.map((job, i) => (
                  <motion.article
                    key={job.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -6 }}
                    className="group relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-lg shadow-gray-900/5 transition hover:border-brand-100 hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl shadow-inner">
                          {job.logo}
                        </span>
                        <div>
                          <p className="text-xs font-medium text-brand-600">{job.company}</p>
                          <h3 className="font-display font-semibold text-gray-900">{job.title}</h3>
                        </div>
                      </div>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        onClick={() =>
                          setSaved((s) => ({
                            ...s,
                            [job.id]: !s[job.id]
                          }))
                        }
                        className="rounded-full p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500"
                        aria-label="Save"
                      >
                        <Heart className={`h-5 w-5 ${saved[job.id] ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </motion.button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">{job.type}</span>
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-800">{job.salary}</span>
                      <span className="rounded-full border border-gray-100 px-2.5 py-1 text-gray-600">{job.exp}</span>
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-500">
                      <MapPin className="h-4 w-4 shrink-0 text-brand-500" />
                      {job.location}
                    </p>
                    <motion.div whileHover={{ x: 4 }} className="mt-5">
                      <Link
                        to="/map"
                        className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
                      >
                        View on map
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </motion.div>
                  </motion.article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partner strip — auto-infinite feel via duplicated row + CSS marquee */}
      <section className="border-y border-gray-100 bg-[#f9fafb] py-12">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400">Campus partners</p>
        <div className="relative mt-8 overflow-hidden">
          <div className="flex w-max animate-marquee gap-12 pr-12">
            {[...partners, ...partners].map((name, i) => (
              <motion.span
                key={`${name}-${i}`}
                whileHover={{ scale: 1.05 }}
                className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-lg font-semibold text-gray-400"
              >
                <Building2 className="h-6 w-6 text-brand-500/50" />
                {name}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats-section" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 rounded-[2rem] border border-gray-100 bg-gradient-to-br from-white via-brand-50/40 to-white px-8 py-14 shadow-xl shadow-brand-900/5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Rooms indexed', value: 1200, suffix: '+' },
            { label: 'Buildings', value: 24, suffix: '' },
            { label: 'Monthly visitors', value: 8500, suffix: '+' },
            { label: 'Route success', value: 98, suffix: '%' }
          ].map((s) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <p className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
                <AnimatedCounter target={s.value} suffix={s.suffix} />
              </p>
              <p className="mt-2 text-sm font-medium text-gray-600">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center font-display text-3xl font-bold text-gray-900">Loved by students & staff</h2>
          <div className="relative mx-auto mt-12 max-w-3xl">
            <motion.div
              key={testimonialIdx}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-[1.75rem] border border-white/60 bg-white/70 p-8 shadow-xl shadow-brand-900/10 backdrop-blur-xl"
            >
              <div className="flex gap-1">
                {Array.from({ length: testimonials[testimonialIdx].rating }).map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="mt-5 text-lg leading-relaxed text-gray-700">{testimonials[testimonialIdx].text}</p>
              <div className="mt-6 flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 font-display font-bold text-white shadow-lg">
                  {testimonials[testimonialIdx].avatar}
                </span>
                <div>
                  <p className="font-semibold text-gray-900">{testimonials[testimonialIdx].name}</p>
                  <p className="text-sm text-gray-500">{testimonials[testimonialIdx].role}</p>
                </div>
              </div>
            </motion.div>
            <div className="mt-6 flex justify-center gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTestimonialIdx(i)}
                  className={`h-2 rounded-full transition-all ${i === testimonialIdx ? 'w-8 bg-brand-600' : 'w-2 bg-gray-300'}`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-28 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-cta-green px-8 py-14 text-center shadow-2xl shadow-brand-900/25"
        >
          <div className="pointer-events-none absolute inset-0 animate-pulseGlow bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.15),transparent_40%)] opacity-90" />
          <div className="relative">
            <Upload className="mx-auto h-10 w-10 text-white/90" />
            <h2 className="font-display mt-4 text-3xl font-bold text-white sm:text-4xl">
              Ready to start your campus journey?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-emerald-50">
              Jump into search or open the interactive map — same trusted routes, refreshed interface.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/search"
                  className="inline-flex rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-brand-700 shadow-xl"
                >
                  Upload resume (demo)
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/map"
                  className="inline-flex rounded-full border-2 border-white/70 bg-transparent px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Post / edit map (admin tools)
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex gap-3 border-t border-gray-200 bg-white/95 p-3 backdrop-blur-xl md:hidden">
        <Link to="/search" className="flex flex-1 items-center justify-center rounded-full bg-brand-600 py-3 text-sm font-semibold text-white shadow-lg">
          Search
        </Link>
        <Link to="/map" className="flex flex-1 items-center justify-center rounded-full border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-800">
          Map
        </Link>
      </div>
      <div className="h-14 md:hidden" aria-hidden />
    </div>
  );
}
