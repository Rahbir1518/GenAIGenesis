import {
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import DiscordMockup from "./components/DiscordMockup";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="font-display font-bold text-lg tracking-[0.3em] text-foreground"
          >
            numen
          </Link>
          {/* THIS IS A TEST FOR THE GITHUB TUNNEL */}
          {/* This is the second test! */}
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton forceRedirectUrl="/dashboard">
                <button className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-foreground transition-colors cursor-pointer">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton forceRedirectUrl="/dashboard">
                <button className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:opacity-90 transition-opacity cursor-pointer">
                  Get Started
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative bg-dot-pattern">
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 lg:pt-32 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Copy — col-span-5 */}
            <div className="lg:col-span-5 animate-fade-in-up">
              <p className="font-mono text-xs tracking-widest uppercase text-gray-500 mb-4">
                Living knowledge infrastructure
              </p>
              <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
                Your team
                <br />
                shouldn&apos;t have to
                <br />
                <span className="text-accent">wait for answers.</span>
              </h1>
              <p className="mt-6 text-lg text-gray-500 max-w-lg">
                numen is a living knowledge graph that answers technical
                questions instantly — or routes to the right person in seconds.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <SignUpButton forceRedirectUrl="/dashboard">
                  <button className="px-6 py-3 text-sm font-semibold text-white bg-accent rounded-lg hover:opacity-90 transition-opacity cursor-pointer">
                    Start for free
                  </button>
                </SignUpButton>
                <a
                  href="#how-it-works"
                  className="px-6 py-3 text-sm font-semibold text-foreground border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
                >
                  See how it works
                </a>
              </div>
            </div>

            {/* Discord-style mockup — col-span-7 */}
            <DiscordMockup />
          </div>
        </div>
      </section>

      {/* ── Problem Section ── */}
      <section id="problem" className="bg-gray-50 py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Left — headline */}
            <div className="lg:col-span-5 animate-fade-in-up">
              <p className="font-mono text-xs tracking-widest uppercase text-gray-500 mb-4">
                The Problem
              </p>
              <h2 className="text-3xl lg:text-4xl font-extrabold leading-tight">
                Every question costs more than you think.
              </h2>
            </div>

            {/* Right — pain points */}
            <div className="lg:col-span-6 lg:col-start-7 space-y-6 animate-fade-in-up-delay-1">
              {[
                {
                  title: "Engineers context-switch.",
                  desc: "Sales reps ping Slack. Engineers lose 90 minutes of deep work per interruption cycle.",
                },
                {
                  title: "Answers live in someone's head.",
                  desc: "Critical product knowledge is trapped in DMs, docs, and tribal memory — not searchable.",
                },
                {
                  title: "Managers can't see the gaps.",
                  desc: "No visibility into what questions are being asked, how long they take, or where knowledge is missing.",
                },
              ].map((point, i) => (
                <div key={i} className="border-l-2 border-accent pl-5">
                  <h3 className="font-semibold text-foreground">
                    {point.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                    {point.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <p className="font-mono text-xs tracking-widest uppercase text-gray-500 mb-4 animate-fade-in-up">
            How It Works
          </p>
          <h2 className="text-3xl lg:text-4xl font-extrabold leading-tight animate-fade-in-up">
            Three steps. Zero Slack threads.
          </h2>

          <div className="mt-14 grid md:grid-cols-3 gap-0">
            {[
              {
                step: "01",
                title: "Ask in plain English",
                desc: "Sales reps type a natural-language question — no syntax, no tagging.",
              },
              {
                step: "02",
                title: "numen searches the graph",
                desc: "Your living knowledge graph finds the best match across code, docs, and past answers.",
              },
              {
                step: "03",
                title: "Answer or route",
                desc: "Get an instant AI answer with sources — or smart-route to the right engineer with full context.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className={`border-t-2 border-accent pt-6 ${i > 0 ? "md:pl-8" : ""} animate-fade-in-up-delay-${i + 1}`}
              >
                <p className="font-mono text-xs tracking-widest text-accent mb-2">
                  {item.step}
                </p>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Key Features ── */}
      <section className="bg-gray-50 py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <p className="font-mono text-xs tracking-widest uppercase text-gray-500 mb-4 animate-fade-in-up">
            Features
          </p>
          <h2 className="text-3xl lg:text-4xl font-extrabold leading-tight animate-fade-in-up">
            Built different. On purpose.
          </h2>

          <div className="mt-14 grid md:grid-cols-2 gap-6">
            {[
              {
                category: "KNOWLEDGE",
                title: "Living knowledge graph",
                desc: "Auto-updates from every PR merge — your knowledge base is always current, never stale.",
              },
              {
                category: "TRANSPARENCY",
                title: "Answer path visualization",
                desc: "See exactly how numen reasoned through your codebase to find the answer. Full traceability.",
              },
              {
                category: "ROUTING",
                title: "Smart engineer routing",
                desc: "When numen can't answer, it routes to the right engineer with pre-packaged context — no cold pings.",
              },
              {
                category: "ANALYTICS",
                title: "Interrupt cost dashboard",
                desc: "Track engineering time saved and quantify the ROI of knowledge infrastructure for leadership.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:border-accent group transition-colors"
              >
                <p className="font-mono text-xs tracking-widest text-gray-400 mb-3">
                  {feature.category}
                </p>
                <h3 className="text-base font-semibold group-hover:text-accent transition-colors">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Large stat */}
            <div className="md:col-span-6 border border-gray-200 rounded-lg p-10">
              <p className="font-mono text-xs tracking-widest uppercase text-gray-400 mb-3">
                Auto-Answer Rate
              </p>
              <p className="text-5xl lg:text-6xl font-extrabold text-accent">
                &gt;60%
              </p>
              <p className="mt-2 text-sm text-gray-500">
                of sales questions answered instantly without engineer involvement.
              </p>
            </div>

            {/* Two stacked stats */}
            <div className="md:col-span-6 flex flex-col gap-6">
              <div className="border border-gray-200 rounded-lg p-8 flex-1">
                <p className="font-mono text-xs tracking-widest uppercase text-gray-400 mb-3">
                  Answer Latency
                </p>
                <p className="text-4xl lg:text-5xl font-extrabold text-accent">
                  &lt;5s
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  from question to verified answer with source.
                </p>
              </div>
              <div className="border border-gray-200 rounded-lg p-8 flex-1">
                <p className="font-mono text-xs tracking-widest uppercase text-gray-400 mb-3">
                  Time Saved
                </p>
                <p className="text-4xl lg:text-5xl font-extrabold text-accent">
                  4.7 hrs
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  of engineering time recovered per day, per team.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="border-t border-gray-200 py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <p className="font-mono text-xs tracking-widest uppercase text-gray-500 mb-4 animate-fade-in-up">
            Get Started
          </p>
          <h2 className="text-3xl lg:text-4xl font-extrabold leading-tight animate-fade-in-up">
            Stop losing deals to
            <br />
            slow answers.
          </h2>
          <div className="mt-8 animate-fade-in-up-delay-1">
            <SignUpButton forceRedirectUrl="/dashboard">
              <button className="px-6 py-3 text-sm font-semibold text-white bg-accent rounded-lg hover:opacity-90 transition-opacity cursor-pointer">
                Start for free
              </button>
            </SignUpButton>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-4">
            <span className="font-display font-bold text-sm tracking-[0.2em] text-foreground">
              numen
            </span>
            <p>
              Built for{" "}
              <span className="font-medium text-gray-600">
                GenAI Genesis 2026
              </span>
            </p>
          </div>
          <div className="flex gap-6">
            <a
              href="#problem"
              className="hover:text-gray-600 transition-colors"
            >
              About
            </a>
            <a href="#" className="hover:text-gray-600 transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-gray-600 transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
