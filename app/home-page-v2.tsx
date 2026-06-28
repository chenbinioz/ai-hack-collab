import type { ReactNode, SVGProps } from "react";
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

function IconFile(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClipboard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

function FeatureCard({
  icon,
  iconClassName,
  title,
  description,
}: {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  description: string;
}) {
  return (
    <li className="group flex flex-col rounded-2xl border border-black/6 bg-background p-6 transition hover:border-brand/25 hover:shadow-md dark:border-white/10">
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClassName}`}>{icon}</span>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{description}</p>
    </li>
  );
}

export default function HomePageV2() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-50 border-b border-black/5 bg-surface/80 backdrop-blur-md dark:border-white/10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center gap-3">
            <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-foreground">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-brand to-brand-deep text-white shadow-sm">
                <IconSpark className="h-5 w-5" />
              </span>
              <span className="hidden sm:inline">Cohort Connect</span>
            </Link>

            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
              <nav className="flex items-center gap-1 sm:gap-1.5" aria-label="Primary">
                <a
                  href="#how"
                  className="rounded-lg px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground sm:text-sm"
                >
                  How it works
                </a>
                <a
                  href="#students"
                  className="rounded-lg px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground sm:text-sm"
                >
                  For students
                </a>
                <a
                  href="#educators"
                  className="rounded-lg px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground sm:text-sm"
                >
                  For educators
                </a>
              </nav>
              <span className="hidden h-5 w-px bg-black/10 sm:block dark:bg-white/15" aria-hidden />
              <Link
                href="/login/student"
                className="hidden rounded-lg px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground sm:inline sm:text-sm"
              >
                Student log in
              </Link>
              <Link
                href="/login/educator"
                className="hidden rounded-lg px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground md:inline md:text-sm"
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
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-black/5 dark:border-white/10">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(0,62,116,0.14),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(212,239,252,0.12),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:pb-28 lg:pt-24">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-deep dark:text-brand">
              From fair matching to better teamwork
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
              Smarter groups, clearer briefs, and tools to collaborate.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
              Cohort Connect matches students into balanced project teams using academic background and
              collaboration preferences — then gives each team a workspace with assignment briefs, chat, coaching,
              and feedback so groups can actually work well together.
            </p>
            <div className="mt-10" id="get-started">
              <a
                href="#join"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-8 text-base font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-deep"
              >
                Join your cohort
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
                  Organised around classes and assignments so everyone shares the same syllabus, briefs, and
                  deadlines.
                </dd>
              </div>
              <div className="rounded-2xl border border-black/6 bg-surface p-5 shadow-sm dark:border-white/10">
                <dt className="text-sm font-semibold text-foreground">Transparent for staff</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted">
                  Educators set matching priorities, review teams with clear rationale, and track how groups are
                  collaborating.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="border-b border-black/5 bg-surface py-16 dark:border-white/10"
          aria-labelledby="features-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="features-heading" className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Matching and collaboration in one place
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted">
              A calm workspace for students to work in teams — and for educators to run assignments without
              spreadsheets.
            </p>

            <div id="students" className="mt-14 scroll-mt-24">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-brand">For students</h3>
              <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <FeatureCard
                  icon={<IconClipboard className="h-6 w-6" />}
                  iconClassName="bg-brand/15 text-brand"
                  title="One-time profile survey"
                  description="Share academic strengths, working style, and collaboration preferences once — used for every assignment in your classes."
                />
                <FeatureCard
                  icon={<IconBook className="h-6 w-6" />}
                  iconClassName="bg-brand/15 text-brand"
                  title="Join your class"
                  description="Enter the invite code from your lecturer. You only see classmates taking the same assessed work."
                />
                <FeatureCard
                  icon={<IconFile className="h-6 w-6" />}
                  iconClassName="bg-accent/15 text-accent"
                  title="Assignment briefs"
                  description="View deadlines, descriptions, and downloadable resources for each piece of coursework."
                />
                <FeatureCard
                  icon={<IconUsers className="h-6 w-6" />}
                  iconClassName="bg-accent/15 text-accent"
                  title="Team Hub"
                  description="See your teammates, team name, and a written explanation of why you were matched together."
                />
                <FeatureCard
                  icon={<IconChat className="h-6 w-6" />}
                  iconClassName="bg-brand/15 text-brand"
                  title="Team chat and Coach"
                  description="Message your team, share files, and receive automated coaching tips tailored to your group."
                />
                <FeatureCard
                  icon={<IconChart className="h-6 w-6" />}
                  iconClassName="bg-brand/15 text-brand"
                  title="Skills over time"
                  description="Visualise your confidence across subject areas and update your skills after each project completes."
                />
              </ul>
            </div>

            <div id="educators" className="mt-14 scroll-mt-24">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-brand">For educators</h3>
              <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <FeatureCard
                  icon={<IconBook className="h-6 w-6" />}
                  iconClassName="bg-brand/15 text-brand"
                  title="Class and assignment management"
                  description="Create classes, add assignments with due dates and team sizes, and share join codes with students."
                />
                <FeatureCard
                  icon={<IconSpark className="h-6 w-6" />}
                  iconClassName="bg-accent/15 text-accent"
                  title="AI team generation"
                  description="Configure matching priorities per assignment, then generate or regenerate balanced teams with one click."
                />
                <FeatureCard
                  icon={<IconFile className="h-6 w-6" />}
                  iconClassName="bg-brand/15 text-brand"
                  title="Share resources"
                  description="Upload briefs, rubrics, and reference files so students have everything they need in one place."
                />
                <FeatureCard
                  icon={<IconChart className="h-6 w-6" />}
                  iconClassName="bg-accent/15 text-accent"
                  title="Feedback analytics"
                  description="Track team satisfaction, collaboration balance, and engagement with match explanations and coaching."
                />
              </ul>
            </div>
          </div>
        </section>

        {/* Explainable AI */}
        <section id="matching" className="border-b border-black/5 py-16 dark:border-white/10" aria-labelledby="matching-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 id="matching-heading" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Matching you can explain — to students and to staff
              </h2>
              <p className="mt-4 text-muted">
                AI-assisted grouping balances similarity in how teams work with diversity in what they bring — and
                every placement comes with a human-readable explanation.
              </p>
            </div>
            <ul className="mt-12 grid gap-6 sm:grid-cols-3">
              <li className="rounded-2xl border border-black/6 bg-surface p-6 dark:border-white/10">
                <h3 className="font-semibold text-foreground">Alignment</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Teams share similar communication and deadline preferences so day-to-day collaboration feels
                  natural.
                </p>
              </li>
              <li className="rounded-2xl border border-black/6 bg-surface p-6 dark:border-white/10">
                <h3 className="font-semibold text-foreground">Complementarity</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Technical strengths are spread across the team so multifaceted projects get the skills they need.
                </p>
              </li>
              <li className="rounded-2xl border border-black/6 bg-surface p-6 dark:border-white/10">
                <h3 className="font-semibold text-foreground">Transparency</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Students see why they matched; educators review team names, reasons, and matching traces before
                  groups go live.
                </p>
              </li>
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-24 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">How Cohort Connect works</h2>
                <p className="mt-4 text-muted">
                  From first sign-up to finishing a group project — five clear steps for students and educators.
                </p>
                <ol className="mt-8 space-y-5">
                  {[
                    {
                      title: "Complete your profile survey",
                      body: "Once per account: academic strengths, working style, and collaboration preferences. Nothing about appearance.",
                    },
                    {
                      title: "Join your class",
                      body: "Enter the invite code from your lecturer. You only see classmates in the same module.",
                    },
                    {
                      title: "Educator publishes assignments",
                      body: "Each assignment has a brief, deadline, team size, and optional files for students to download.",
                    },
                    {
                      title: "Get matched per assignment",
                      body: "Your lecturer generates teams when ready. You receive teammates and a written match explanation.",
                    },
                    {
                      title: "Collaborate in Team Hub",
                      body: "Chat with your team, follow coaching tips, share feedback, and track skills as the project progresses.",
                    },
                  ].map((step, index) => (
                    <li key={step.title} className="flex gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="font-semibold text-foreground">{step.title}</h3>
                        <p className="mt-1 text-sm text-muted">{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Team Hub mock */}
              <div className="rounded-2xl border border-black/6 bg-surface p-6 shadow-lg dark:border-white/10">
                <div className="flex items-start justify-between gap-3 border-b border-black/6 pb-4 dark:border-white/10">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">Team Hub</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">Kinetics lab report</p>
                    <p className="mt-0.5 text-xs text-accent">Due in 3 days</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand">
                    Catalyst Crew
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-background p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Why you were matched</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">
                    Your team combines strong analytical skills with complementary writing strengths, and shared
                    preferences for structured deadlines.
                  </p>
                </div>

                <ul className="mt-4 space-y-2">
                  {["Alex Chen", "Jordan Lee", "Sam Patel", "You"].map((name) => (
                    <li
                      key={name}
                      className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm ${
                        name === "You" ? "bg-brand/8 ring-1 ring-brand/20" : "bg-background"
                      }`}
                    >
                      <span className={name === "You" ? "font-medium text-foreground" : "text-muted"}>{name}</span>
                      {name === "You" && <span className="text-xs font-medium text-brand">You</span>}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 space-y-2 rounded-xl bg-background p-3">
                  <p className="text-xs font-semibold text-muted">Team chat</p>
                  <div className="rounded-lg bg-accent/10 px-3 py-2 text-xs text-foreground">
                    <span className="font-semibold text-accent">Team Coach · </span>
                    You have diverse problem-solving styles — agree on how you&apos;ll divide the analysis section
                    before your next meeting.
                  </div>
                  <div className="rounded-lg px-3 py-2 text-xs text-muted">Jordan: Draft intro is in the shared folder.</div>
                </div>

                <p className="mt-4 flex items-start gap-2 rounded-xl bg-background p-3 text-xs text-muted">
                  <IconShield className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  Matching uses coursework signals and stated preferences. It does not use photos, names for
                  sorting, or protected characteristics.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Educators */}
        <section
          id="educators-overview"
          className="border-t border-black/5 bg-linear-to-b from-brand/8 to-background py-16 dark:border-white/10 dark:from-brand/10"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  For lecturers and module leads
                </h2>
                <p className="mt-4 text-muted">
                  Run group coursework from one dashboard — no spreadsheet wrangling, no opaque allocation.
                </p>
                <ul className="mt-8 space-y-4">
                  {[
                    "Create a class and share the join code with students.",
                    "Add assignments with due dates, team size, and matching priorities.",
                    "Upload briefs and reference files students can download.",
                    "Generate AI teams, review match explanations, and track feedback analytics.",
                  ].map((item) => (
                    <li key={item} className="flex gap-3 text-sm text-muted">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup/educator"
                  className="mt-8 inline-flex h-12 items-center justify-center rounded-xl border-2 border-brand bg-surface px-8 text-base font-semibold text-brand transition hover:bg-brand/10"
                >
                  Create educator account
                </Link>
              </div>

              <div className="rounded-2xl border border-black/6 bg-surface p-6 shadow-lg dark:border-white/10">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Assignment dashboard</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Thermodynamics group project</p>
                <p className="mt-0.5 text-xs text-muted">Max team size: 4 · Due 14 Apr</p>
                <ul className="mt-4 space-y-2">
                  {[
                    { name: "Reaction Runners", satisfaction: "4.2/5" },
                    { name: "Heat Wave", satisfaction: "3.8/5" },
                    { name: "Entropy Squad", satisfaction: "4.5/5" },
                  ].map((team) => (
                    <li
                      key={team.name}
                      className="flex items-center justify-between rounded-xl bg-background px-4 py-3 text-sm"
                    >
                      <span className="font-medium text-foreground">{team.name}</span>
                      <span className="text-xs text-muted">Avg satisfaction {team.satisfaction}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 rounded-xl bg-brand/8 px-4 py-3 text-xs text-muted">
                  Matching priorities: skills diversity, working style, availability
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16" id="join">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div
              id="account"
              className="overflow-hidden rounded-3xl bg-linear-to-br from-brand to-brand-deep px-6 py-12 text-center shadow-xl shadow-brand/30 sm:px-12 sm:py-16"
            >
              <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready to meet your cohort?</h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-white/90">
                Students: sign up, complete the profile survey, then join your class with the code from your
                lecturer. Educators can create an account and set up their first class today.
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
