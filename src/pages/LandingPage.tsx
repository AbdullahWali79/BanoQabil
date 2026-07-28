import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Menu,
  Monitor,
  PenTool,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it Works' },
  { href: '#courses', label: 'Courses' },
  { href: '#stories', label: 'Success Stories' },
] as const;

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Assignments & submissions',
    text: 'Students submit YouTube or Drive links. Teachers grade with marks students can see instantly.',
  },
  {
    icon: CalendarCheck,
    title: 'Attendance tracking',
    text: 'Teachers mark class attendance by date. Students view percentage and absent days in one place.',
  },
  {
    icon: Users,
    title: 'Class & progress',
    text: 'Every teacher sees their own class roster, assignment marks, and attendance detail per student.',
  },
  {
    icon: ShieldCheck,
    title: 'Admin control',
    text: 'Admins approve users, assign teachers to courses, manage batches, and review institute reports.',
  },
] as const;

const STEPS = [
  {
    step: '01',
    title: 'Apply & get approved',
    text: 'Create your account. Admin reviews and approves your profile for the right role.',
  },
  {
    step: '02',
    title: 'Join your class',
    text: 'Students are placed in a course batch. Teachers get their assigned course and gender scope.',
  },
  {
    step: '03',
    title: 'Learn, submit, grow',
    text: 'Open assignments, submit work to your teacher, check grades, attendance, and notifications.',
  },
] as const;

const COURSES = [
  { name: 'Graphic Designing', icon: PenTool, detail: 'Visual design skills for real projects' },
  { name: 'Digital Marketing', icon: Monitor, detail: 'Campaigns, content, and growth basics' },
  { name: 'Essential of AI', icon: Sparkles, detail: 'Practical AI foundations for beginners' },
  {
    name: 'Computer Information & Technology',
    icon: GraduationCap,
    detail: 'Core IT skills for the workplace',
  },
] as const;

const STORIES = [
  {
    title: 'From signup to classroom',
    text: 'Students join a clean portal: profile, assignments, attendance, and grades — all under their course teacher.',
    tag: 'Students',
  },
  {
    title: 'Teachers stay in control',
    text: 'Create assignments, grade submissions, mark attendance, and message the whole class or one student.',
    tag: 'Teachers',
  },
  {
    title: 'Institute stays organized',
    text: 'Admins manage teachers, students, courses, batches, and reports without handling day-to-day grading.',
    tag: 'Admins',
  },
] as const;

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="landing-page min-h-screen bg-white text-slate-900 [font-family:Outfit,system-ui,sans-serif]">
      {/* Soft white atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.07),_transparent_55%),linear-gradient(180deg,#ffffff_0%,#f8fafc_45%,#ffffff_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(15,23,42,0.06) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />

      <header
        className={`sticky top-0 z-50 border-b transition-all duration-300 ${
          scrolled
            ? 'border-slate-200/80 bg-white/95 shadow-sm backdrop-blur'
            : 'border-transparent bg-white/80 backdrop-blur-sm'
        }`}
      >
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <BrandLogo
            imgClassName="h-10"
            textClassName="text-[1.35rem] font-semibold tracking-tight text-slate-900 [font-family:Fraunces,Georgia,serif]"
          />

          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/login"
              className="text-sm font-semibold text-slate-700 transition-colors hover:text-slate-900"
            >
              Log In
            </Link>
            <Button asChild className="rounded-full px-5">
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-800 md:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>

        {menuOpen ? (
          <div className="border-t border-slate-200 bg-white md:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className="rounded-xl px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-3">
                <Button asChild variant="outline" className="rounded-full" onClick={closeMenu}>
                  <Link to="/login">Log In</Link>
                </Button>
                <Button asChild className="rounded-full" onClick={closeMenu}>
                  <Link to="/signup">Get Started</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {/* Hero — brand first, white plane */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:px-8 lg:py-20">
          <div>
            <p className="landing-fade-up text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              Free IT education
            </p>
            <div className="landing-fade-up landing-fade-up-delay-1 mt-5">
              <BrandLogo
                to=""
                imgClassName="h-16 sm:h-20"
                textClassName="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 [font-family:Fraunces,Georgia,serif]"
              />
            </div>
            <h1 className="landing-fade-up landing-fade-up-delay-2 mt-6 max-w-xl text-2xl font-semibold leading-snug tracking-tight text-slate-800 sm:text-3xl">
              Learn tech skills free — managed in one student, teacher & admin portal.
            </h1>
            <p className="landing-fade-up landing-fade-up-delay-3 mt-4 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
              Assignments, attendance, grades, and class tools built for BanoQabil Educational
              Institute.
            </p>
            <div className="landing-fade-up landing-fade-up-delay-3 mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                <Link to="/signup" className="inline-flex items-center gap-2">
                  Apply as Student
                  <ArrowRight size={18} />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-slate-300 bg-white px-7 text-base text-slate-800 hover:bg-slate-50"
              >
                <Link to="/login">Open Portal</Link>
              </Button>
            </div>
          </div>

          <div className="landing-fade-up landing-fade-up-delay-2 relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="landing-soft-float relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] sm:p-10">
              <div
                aria-hidden
                className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl"
              />
              <div
                aria-hidden
                className="absolute -bottom-12 -left-8 h-44 w-44 rounded-full bg-sky-400/10 blur-2xl"
              />
              <img
                src="/banoqabil_logo.png"
                alt="BanoQabil"
                className="relative mx-auto h-28 w-auto object-contain sm:h-36"
              />
              <p className="relative mt-6 text-center text-sm font-medium text-slate-500">
                Graphic Designing · Digital Marketing · AI · CIT
              </p>
              <div className="relative mt-8 grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Courses', value: '4' },
                  { label: 'Roles', value: '3' },
                  { label: 'Fee', value: 'Free' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-100 bg-slate-50/80 px-2 py-3"
                  >
                    <p className="text-lg font-bold text-slate-900">{item.value}</p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-24 border-t border-slate-100 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              Features
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 [font-family:Fraunces,Georgia,serif] sm:text-4xl">
              Built for how BanoQabil actually runs
            </h2>
            <p className="mt-3 text-base text-slate-600 sm:text-lg">
              One LMS for students, teachers, and admins — without mixing their jobs.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="group flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-blue-700 transition-colors group-hover:border-blue-200 group-hover:bg-blue-50">
                  <feature.icon size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 sm:text-base">
                    {feature.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="scroll-mt-24 border-y border-slate-100 bg-slate-50/70 py-20 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              How it Works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 [font-family:Fraunces,Georgia,serif] sm:text-4xl">
              Three clear steps
            </h2>
            <p className="mt-3 text-base text-slate-600 sm:text-lg">
              From application to classroom tools — simple for every role.
            </p>
          </div>

          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((item) => (
              <li key={item.step} className="relative rounded-3xl border border-slate-200 bg-white p-6 sm:p-7">
                <p className="text-sm font-bold tracking-widest text-blue-700">{item.step}</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Courses */}
      <section id="courses" className="scroll-mt-24 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              Courses
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 [font-family:Fraunces,Georgia,serif] sm:text-4xl">
              Programs we offer
            </h2>
            <p className="mt-3 text-base text-slate-600 sm:text-lg">
              Subject courses with Male / Female class groups managed by assigned teachers.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {COURSES.map((course) => (
              <div
                key={course.name}
                className="flex items-start gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-5 transition-colors hover:border-blue-200 hover:bg-slate-50/80"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <course.icon size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{course.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{course.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Success stories */}
      <section
        id="stories"
        className="scroll-mt-24 border-y border-slate-100 bg-slate-50/70 py-20 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              Success Stories
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 [font-family:Fraunces,Georgia,serif] sm:text-4xl">
              Outcomes the portal is built for
            </h2>
            <p className="mt-3 text-base text-slate-600 sm:text-lg">
              Real workflows for every role at BanoQabil — not a generic LMS demo.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STORIES.map((story) => (
              <article
                key={story.title}
                className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6"
              >
                <span className="inline-flex w-fit rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                  {story.tag}
                </span>
                <h3 className="mt-4 text-xl font-semibold text-slate-900">{story.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{story.text}</p>
                <div className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-800">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Live in the portal
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-8 rounded-[2rem] border border-slate-200 bg-slate-900 px-6 py-10 text-white sm:px-10 sm:py-12 md:flex-row md:items-center">
            <div className="max-w-xl">
              <h2 className="text-3xl font-bold tracking-tight [font-family:Fraunces,Georgia,serif]">
                Ready to join BanoQabil?
              </h2>
              <p className="mt-3 text-sm text-slate-300 sm:text-base">
                Sign up as a student, or log in if you already have an approved account.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-white px-7 text-slate-900 hover:bg-slate-100"
              >
                <Link to="/signup">Create account</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/30 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/login">Log in</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:px-8">
          <div className="max-w-sm">
            <BrandLogo
              imgClassName="h-9"
              textClassName="text-lg font-semibold text-slate-900 [font-family:Fraunces,Georgia,serif]"
            />
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              BanoQabil Educational Institute — free, high-quality IT education with a modern LMS.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Explore</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="hover:text-slate-900">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Portal</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>
                  <Link to="/login" className="hover:text-slate-900">
                    Log In
                  </Link>
                </li>
                <li>
                  <Link to="/signup" className="hover:text-slate-900">
                    Sign Up
                  </Link>
                </li>
              </ul>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Roles</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="inline-flex items-center gap-2">
                  <ClipboardList size={14} /> Student
                </li>
                <li className="inline-flex items-center gap-2">
                  <Users size={14} /> Teacher
                </li>
                <li className="inline-flex items-center gap-2">
                  <ShieldCheck size={14} /> Admin
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} BanoQabil Educational Institute. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
