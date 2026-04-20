import type { SVGProps } from "react";
import Link from "next/link";

function IconBook(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSpark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="m12 3 1.9 5.8h6.1l-4.95 3.6 1.9 5.8-4.95-3.6-4.95 3.6 1.9-5.8L4.1 8.8h6.1L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconShield(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChat(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-50 border-b border-black/5 bg-surface/80 backdrop-blur-md dark:border-white/10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-brand to-brand-deep text-white shadow-sm">
              <IconSpark className="h-5 w-5" />
            </span>
            <span>Cohort Connect</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted md:flex" aria-label="Primary">
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#principles" className="transition-colors hover:text-foreground">
              Principles
            </a>
            <a href="#educators" className="transition-colors hover:text-foreground">
              For educators
            </a>
          </nav>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Link
              href="/login/student"
              className="rounded-lg px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground sm:text-sm"
            >
              Student log in
            </Link>
            <Link
              href="/login/educator"
              className="rounded-lg px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground sm:text-sm"
            >
              Educator log in
            </Link>
            <a
              href="#join"
              className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-deep sm:px-4 sm:text-sm"
            >
              Get started
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-black/5 dark:border-white/10">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(0,62,116,0.14),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(212,239,252,0.12),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:pb-28 lg:pt-24">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-deep dark:text-brand">
              Course-first grouping
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
              Coursework groups that fit how you learn — not arbitrary grouping.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
              Cohort Connect places students on the same course — Chemistry, Physics, and more — into balanced
              project teams using academic background and attitudes to collaboration. Fairer groups, fewer
              awkward mismatches, and a clearer path to doing your best work together.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center" id="get-started">
              <a
                href="#join"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-8 text-base font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-deep"
              >
                Join your cohort
              </a>
              <a
                href="#how"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-black/10 bg-surface px-8 text-base font-semibold text-foreground transition hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.06]"
              >
                See how matching works
              </a>
            </div>
            <dl className="mt-14 grid gap-6 sm:grid-cols-3" id="principles">
              <div className="rounded-2xl border border-black/6 bg-surface p-5 shadow-sm dark:border-white/10">
                <dt className="text-sm font-semibold text-foreground">Relevant signals only</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted">
                  Prior study, strengths, schedule constraints, and how you prefer to collaborate — not photos or
                  demographic guessing.
                </dd>
              </div>
              <div className="rounded-2xl border border-black/6 bg-surface p-5 shadow-sm dark:border-white/10">
                <dt className="text-sm font-semibold text-foreground">Built for real courses</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted">
                  Organised around modules and lab groups so everyone is actually on the same syllabus and
                  deadlines.
                </dd>
              </div>
              <div className="rounded-2xl border border-black/6 bg-surface p-5 shadow-sm dark:border-white/10">
                <dt className="text-sm font-semibold text-foreground">Transparent for staff</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted">
                  Educators set rules and can review cohorts with clear rationale — similar to tools you already
                  trust for teamwork.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="border-b border-black/5 bg-surface py-16 dark:border-white/10" aria-labelledby="features-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="features-heading" className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Everything you need for smarter groups
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted">
              A calm, focused workspace inspired by modern learning and collaboration products — clear cards,
              gentle colour, and actions where you expect them.
            </p>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <li className="group flex flex-col rounded-2xl border border-black/6 bg-background p-6 transition hover:border-brand/25 hover:shadow-md dark:border-white/10">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/15 text-brand">
                  <IconBook className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">Same course, shared goals</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                  Enrol by subject and cohort year. Matching stays inside your course so expectations and
                  assessment stay aligned.
                </p>
              </li>
              <li className="group flex flex-col rounded-2xl border border-black/6 bg-background p-6 transition hover:border-brand/25 hover:shadow-md dark:border-white/10">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <IconUsers className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">Balanced teams</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                  Spread skills and working styles across groups so no single team carries everyone — and no one
                  is left without support.
                </p>
              </li>
              <li className="group flex flex-col rounded-2xl border border-black/6 bg-background p-6 transition hover:border-brand/25 hover:shadow-md dark:border-white/10 sm:col-span-2 lg:col-span-1">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/15 text-brand">
                  <IconChat className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">Collaboration that suits you</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                  Optional prompts on communication style, meeting rhythm, and how you handle feedback help match
                  people who can work well together — without stereotyping or profiling.
                </p>
              </li>
            </ul>
          </div>
        </section>

        <section id="how" className="py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">How Cohort Connect works</h2>
                <p className="mt-4 text-muted">
                  Short steps, clear outcomes — similar to onboarding flows you know from learning platforms and
                  team hubs.
                </p>
                <ol className="mt-8 space-y-6">
                  <li className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                      1
                    </span>
                    <div>
                      <h3 className="font-semibold text-foreground">Share learning-relevant preferences</h3>
                      <p className="mt-1 text-sm text-muted">
                        Background topics you are confident in, areas you want to grow, and how you like to
                        collaborate. Nothing about appearance.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                      2
                    </span>
                    <div>
                      <h3 className="font-semibold text-foreground">Join your course space</h3>
                      <p className="mt-1 text-sm text-muted">
                        Enter an invite or module code. You only see others taking the same assessed work.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                      3
                    </span>
                    <div>
                      <h3 className="font-semibold text-foreground">Get placed and get started</h3>
                      <p className="mt-1 text-sm text-muted">
                        Receive your group with a brief explanation of why you were matched together.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>
              <div className="rounded-2xl border border-black/6 bg-surface p-6 shadow-lg dark:border-white/10">
                <div className="flex items-center justify-between border-b border-black/6 pb-4 dark:border-white/10">
                  <span className="text-sm font-semibold text-foreground">Your cohort — CHM201</span>
                  <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Live</span>
                </div>
                <ul className="mt-4 space-y-3">
                  <li className="flex items-center justify-between rounded-xl bg-background px-4 py-3 text-sm">
                    <span className="text-muted">Group A — Thermodynamics project</span>
                    <span className="font-medium text-foreground">4 members</span>
                  </li>
                  <li className="flex items-center justify-between rounded-xl bg-brand/8 px-4 py-3 text-sm ring-1 ring-brand/20">
                    <span className="font-medium text-foreground">Group B — Kinetics lab</span>
                    <span className="font-medium text-brand">You</span>
                  </li>
                  <li className="flex items-center justify-between rounded-xl bg-background px-4 py-3 text-sm">
                    <span className="text-muted">Group C — Thermodynamics project</span>
                    <span className="font-medium text-foreground">4 members</span>
                  </li>
                </ul>
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-background p-3 text-xs text-muted">
                  <IconShield className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  Matching uses coursework signals and stated preferences. It does not use photos, names for
                  sorting, or protected characteristics.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="educators" className="border-t border-black/5 bg-linear-to-b from-brand/8 to-background py-16 dark:border-white/10 dark:from-brand/10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">For lecturers and module leads</h2>
              <p className="mt-4 text-muted">
                Define cohort size, mixing rules, and deadlines in one place. Export group lists or push to your
                VLE when you are ready — without spending hours on spreadsheets.
              </p>
              <a
                href="#contact"
                className="mt-8 inline-flex h-12 items-center justify-center rounded-xl border-2 border-brand bg-surface px-8 text-base font-semibold text-brand transition hover:bg-brand/10"
              >
                Request a pilot
              </a>
            </div>
          </div>
        </section>

        <section className="py-16" id="join">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div
              id="account"
              className="overflow-hidden rounded-3xl bg-linear-to-br from-brand to-brand-deep px-6 py-12 text-center shadow-xl shadow-brand/30 sm:px-12 sm:py-16"
            >
              <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready to meet your cohort?</h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-white/90">
                Fairer groups start with better signals. Join when your institution enables Cohort Connect, or ask
                your module lead to get in touch.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/signup/student"
                  className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-xl bg-white px-8 text-base font-semibold text-brand-deep transition hover:bg-white/95"
                >
                  Create account
                </Link>
                <Link
                  href="/login/student"
                  className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-xl border-2 border-white/40 bg-white/10 px-8 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  Student log in
                </Link>
                <Link
                  href="/signup/educator"
                  className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-xl border-2 border-white/40 bg-white/10 px-8 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  Educator sign up
                </Link>
                <Link
                  href="/login/educator"
                  className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-xl border-2 border-white/40 bg-white/10 px-8 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  Educator log in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/5 bg-surface py-10 dark:border-white/10" id="contact">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15 text-brand">
              <IconSpark className="h-4 w-4" />
            </span>
            Cohort Connect
          </div>
          <p className="text-sm text-muted">
            © {new Date().getFullYear()} Cohort Connect. Built for equitable, course-aligned teamwork.
          </p>
        </div>
      </footer>
    </div>
  );
}
