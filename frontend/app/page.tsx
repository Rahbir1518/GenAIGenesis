import {
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import GlobeWrapper from "./components/GlobeWrapper";
import ScrollFade from "./components/ScrollFade";
import DiscordMockup from "./components/DiscordMockup";

export default function Home() {
  return (
    <>
      {/* Fixed dark grid background */}
      <div className="fixed inset-0 bg-[#0D0B1A] bg-grid-dark -z-10" />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 pt-4 px-6">
        <div className="max-w-5xl mx-auto bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-6 h-12 flex items-center justify-between">
          <Link
            href="/"
            className="font-display font-bold text-lg tracking-[0.3em] text-white"
          >
            numen
          </Link>

          <div className="flex items-center gap-3">
            <a
              href="#how-it-works"
              className="hidden sm:inline px-3 py-1.5 text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              How it works
            </a>
            <Show when="signed-out">
              <SignInButton forceRedirectUrl="/dashboard">
                <button className="px-4 py-1.5 text-sm font-medium text-white/60 hover:text-white transition-colors cursor-pointer">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton forceRedirectUrl="/dashboard">
                <button className="px-4 py-1.5 text-sm font-medium text-white bg-accent rounded-full hover:opacity-90 transition-opacity cursor-pointer">
                  Get Started
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="px-4 py-1.5 text-sm font-medium text-white/60 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </nav>

      {/* ── Section 0: Hero ── */}
      <section className="min-h-[90vh] flex flex-col items-center justify-center px-6 overflow-hidden">
        <ScrollFade className="relative w-full max-w-3xl mx-auto">
          <GlobeWrapper />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <h1 className="font-display font-bold text-white text-[6rem] md:text-[10rem] lg:text-[12rem] tracking-[0.15em] leading-none select-none opacity-90 drop-shadow-[0_0_40px_rgba(255,255,255,0.1)]">
              numen
            </h1>
          </div>
        </ScrollFade>

        <ScrollFade stagger={2} className="text-center max-w-2xl mt-4">
          <p className="text-lg lg:text-xl text-white/60 mb-8">
            Your team shouldn&apos;t have to wait for answers.
            <br className="hidden sm:block" />
            A living knowledge graph that responds in seconds.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <SignUpButton forceRedirectUrl="/dashboard">
              <button className="px-8 py-3.5 text-sm font-semibold text-white bg-accent rounded-lg hover:opacity-90 transition-opacity cursor-pointer">
                Get Started
              </button>
            </SignUpButton>
            <a
              href="#how-it-works"
              className="px-8 py-3.5 text-sm font-semibold text-white border border-white/20 rounded-lg hover:border-white/40 transition-colors"
            >
              See how it works
            </a>
          </div>
        </ScrollFade>

        <ScrollFade stagger={3} className="mt-12">
          <svg
            className="w-5 h-5 text-white/40 animate-bounce"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </ScrollFade>
      </section>

      {/* ── Section 1: Problem ── */}
      <section className="min-h-screen flex items-center justify-center">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Problem text */}
            <div>
              <ScrollFade>
                <p className="font-mono text-xs tracking-widest uppercase text-gray-500 mb-6">
                  The Problem
                </p>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight mb-12 text-white">
                  Every question costs
                  <br />
                  more than you think.
                </h2>
              </ScrollFade>

              <div className="space-y-8">
                {[
                  {
                    title: "Engineers context-switch.",
                    desc: "Sales reps ping Slack. Engineers lose 90 minutes of deep work per interruption cycle.",
                  },
                  {
                    title: "Answers live in someone\u2019s head.",
                    desc: "Critical product knowledge is trapped in DMs, docs, and tribal memory \u2014 not searchable.",
                  },
                  {
                    title: "Managers can\u2019t see the gaps.",
                    desc: "No visibility into what questions are being asked, how long they take, or where knowledge is missing.",
                  },
                ].map((point, i) => (
                  <ScrollFade key={i} stagger={i + 1}>
                    <div className="border-l-2 border-white/20 pl-6">
                      <h3 className="font-semibold text-white text-lg">
                        {point.title}
                      </h3>
                      <p className="mt-1 text-white/60 leading-relaxed">
                        {point.desc}
                      </p>
                    </div>
                  </ScrollFade>
                ))}
              </div>
            </div>

            {/* Right: Chat animation */}
            <ScrollFade stagger={2}>
              <DiscordMockup />
            </ScrollFade>
          </div>
        </div>
      </section>

      {/* ── Section 2: How It Works ── */}
      <section id="how-it-works" className="min-h-screen flex items-center justify-center">
        <div className="max-w-4xl mx-auto px-6">
          <ScrollFade>
            <p className="font-mono text-xs tracking-widest uppercase text-gray-500 mb-4 text-center">
              How It Works
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold leading-tight text-center mb-16 text-white">
              Three steps. Zero Slack threads.
            </h2>
          </ScrollFade>

          <div className="space-y-0">
            {[
              {
                step: "01",
                title: "Ask in plain English",
                desc: "Sales reps type a natural-language question \u2014 no syntax, no tagging, no waiting for someone to come online.",
              },
              {
                step: "02",
                title: "numen searches the graph",
                desc: "Your living knowledge graph finds the best match across code, docs, and past answers in under five seconds.",
              },
              {
                step: "03",
                title: "Answer or route",
                desc: "Get an instant AI answer with traceable sources \u2014 or smart-route to the right engineer with full context attached.",
              },
            ].map((item, i) => (
              <ScrollFade key={i} stagger={i + 1}>
                <div
                  className={`flex items-start gap-6 lg:gap-10 py-10 ${
                    i < 2 ? "border-b border-white/10" : ""
                  }`}
                >
                  <span className="text-6xl lg:text-7xl font-extrabold text-accent/20 leading-none flex-shrink-0 font-mono">
                    {item.step}
                  </span>
                  <div className="pt-2">
                    <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-white/60 leading-relaxed max-w-lg">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </ScrollFade>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: Features Bento Grid ── */}
      <section className="min-h-screen flex items-center justify-center">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollFade>
            <p className="font-mono text-xs tracking-widest uppercase text-gray-500 mb-4 text-center">
              Why numen
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold leading-tight text-center mb-14 text-white">
              Built different. On purpose.
            </h2>
          </ScrollFade>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ScrollFade stagger={1} className="md:col-span-2">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-accent group transition-colors h-full">
                <p className="font-mono text-[10px] tracking-widest text-gray-500 mb-3">
                  KNOWLEDGE
                </p>
                <h3 className="text-base font-semibold text-white group-hover:text-accent transition-colors">
                  Living knowledge graph
                </h3>
                <p className="mt-2 text-sm text-white/50 leading-relaxed">
                  Auto-updates from every PR merge — your knowledge base is always
                  current, never stale.
                </p>
              </div>
            </ScrollFade>

            <ScrollFade stagger={1} className="md:col-span-1">
              <div className="bg-accent text-white rounded-xl p-6 flex flex-col justify-between h-full">
                <p className="font-mono text-[10px] tracking-widest text-white/60 mb-2">
                  AUTO-ANSWER RATE
                </p>
                <p className="text-4xl font-extrabold">&gt;60%</p>
                <p className="mt-1 text-sm text-white/70">
                  without engineer involvement
                </p>
              </div>
            </ScrollFade>

            <ScrollFade stagger={1} className="md:col-span-1">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-accent group transition-colors h-full">
                <p className="font-mono text-[10px] tracking-widest text-gray-500 mb-3">
                  TRANSPARENCY
                </p>
                <h3 className="text-base font-semibold text-white group-hover:text-accent transition-colors">
                  Answer path visualization
                </h3>
                <p className="mt-2 text-sm text-white/50 leading-relaxed">
                  See exactly how numen reasoned through your codebase. Full
                  traceability.
                </p>
              </div>
            </ScrollFade>

            <ScrollFade stagger={2} className="md:col-span-1">
              <div className="bg-white/5 border border-white/10 text-white rounded-xl p-6 flex flex-col justify-between h-full">
                <p className="font-mono text-[10px] tracking-widest text-gray-500 mb-2">
                  ANSWER LATENCY
                </p>
                <p className="text-4xl font-extrabold">&lt;5s</p>
                <p className="mt-1 text-sm text-white/50">
                  question to verified answer
                </p>
              </div>
            </ScrollFade>

            <ScrollFade stagger={2} className="md:col-span-2">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-accent group transition-colors h-full">
                <p className="font-mono text-[10px] tracking-widest text-gray-500 mb-3">
                  ROUTING
                </p>
                <h3 className="text-base font-semibold text-white group-hover:text-accent transition-colors">
                  Smart engineer routing
                </h3>
                <p className="mt-2 text-sm text-white/50 leading-relaxed">
                  When numen can&apos;t answer, it routes to the right engineer
                  with pre-packaged context — no cold pings.
                </p>
              </div>
            </ScrollFade>

            <ScrollFade stagger={2} className="md:col-span-1">
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-6 flex flex-col justify-between h-full">
                <p className="font-mono text-[10px] tracking-widest text-accent/60 mb-2">
                  TIME SAVED
                </p>
                <p className="text-4xl font-extrabold text-accent">4.7 hrs</p>
                <p className="mt-1 text-sm text-gray-500">
                  recovered per day, per team
                </p>
              </div>
            </ScrollFade>
          </div>
        </div>
      </section>

      {/* ── Section 4: CTA + Footer ── */}
      <section className="min-h-screen flex flex-col">
        <ScrollFade className="flex-1 flex items-center justify-center">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight text-white">
              Stop losing deals to
              <br />
              <span className="text-accent">slow answers.</span>
            </h2>
            <p className="mt-6 text-lg text-white/60">
              Set up in minutes. No credit card required.
            </p>
            <div className="mt-10">
              <SignUpButton forceRedirectUrl="/dashboard">
                <button className="px-8 py-3.5 text-sm font-semibold text-white bg-accent rounded-lg hover:opacity-90 transition-opacity cursor-pointer">
                  Start for free
                </button>
              </SignUpButton>
            </div>
          </div>
        </ScrollFade>
        <footer className="border-t border-white/10 py-8">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-4">
              <span className="font-display font-bold text-sm tracking-[0.2em] text-white">
                numen
              </span>
              <p>
                Built for{" "}
                <span className="font-medium text-white/70">
                  GenAI Genesis 2025
                </span>
              </p>
            </div>
            <div className="flex gap-6">
              <a
                href="#problem"
                className="hover:text-white/80 transition-colors"
              >
                About
              </a>
              <a href="#" className="hover:text-white/80 transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-white/80 transition-colors">
                Terms
              </a>
            </div>
          </div>
        </footer>
      </section>
    </>
  );
}
