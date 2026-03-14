"use client";

import {
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import { Check } from "lucide-react";


const TEAM_CHECKOUT_URL = "https://buy.stripe.com/test_bJe7sE13Y1I3grL8Qo4ZG04";

const tiers = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "/mo",
    description: "For individuals and small teams getting started.",
    features: [
      "1 workspace",
      "1 bot",
      "100 messages per month",
      "Community support",
      "Basic knowledge graph",
    ],
    cta: "Get Started",
    highlight: false,
  },
  {
    key: "team",
    name: "Team",
    price: "$29",
    period: "/mo",
    description: "For growing teams that need full power.",
    features: [
      "Unlimited workspaces",
      "Unlimited bots",
      "Unlimited messages",
      "Priority support",
      "Team analytics dashboard",
      "Custom integrations",
      "Advanced knowledge graph",
      "Smart engineer routing",
    ],
    cta: "Upgrade to Team",
    highlight: true,
  },
];

export default function PricingPage() {
  const handleTeamCheckout = () => {
    window.location.href = TEAM_CHECKOUT_URL;
  };

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
              href="/#how-it-works"
              className="hidden sm:inline px-3 py-1.5 text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              How it works
            </a>
            <Link
              href="/pricing"
              className="hidden sm:inline px-3 py-1.5 text-sm font-medium text-white hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <Show when="signed-out">
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

      {/* Hero */}
      <section className="py-28 md:py-40">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="font-mono text-xs tracking-widest uppercase text-gray-500 mb-6">
            Pricing
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight text-white">
            Simple, transparent{" "}
            <span className="text-accent">pricing.</span>
          </h1>
          <p className="mt-6 max-w-lg mx-auto text-lg text-white/60 leading-relaxed">
            Start free. Upgrade when your team is ready. No surprises, no
            lock-in contracts.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 md:pb-28">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {tiers.map((tier) => (
              <div
                key={tier.key}
                className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-200 hover:scale-[1.02] ${tier.highlight
                  ? "border-accent bg-accent/5"
                  : "border-white/10 bg-white/5"
                  }`}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                    Most Popular
                  </span>
                )}
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  {tier.name}
                </h3>
                <p className="mt-2 text-sm text-white/50">
                  {tier.description}
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-mono text-5xl font-extrabold tracking-tighter text-white">
                    {tier.price}
                  </span>
                  <span className="text-sm text-white/50">
                    {tier.period}
                  </span>
                </div>
                <div className="mt-8 h-px bg-white/10" />
                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-white/60"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {tier.key === "free" ? (
                  <SignUpButton forceRedirectUrl="/dashboard">
                    <button className="mt-8 w-full inline-flex cursor-pointer items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-opacity border border-white/20 bg-transparent text-white hover:border-white/40">
                      {tier.cta}
                    </button>
                  </SignUpButton>
                ) : (
                  <button
                    onClick={handleTeamCheckout}
                    className="mt-8 w-full inline-flex cursor-pointer items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-opacity bg-accent text-white hover:opacity-90"
                  >
                    {tier.cta}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-6">
          <p className="font-mono text-xs tracking-widest uppercase text-gray-500 mb-4 text-center">
            FAQ
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center text-white mb-14">
            Common questions.
          </h2>
          <div className="grid gap-x-12 gap-y-0 md:grid-cols-2">
            {[
              {
                q: "What's included in the Free plan?",
                a: "The Free plan includes 1 workspace, 1 bot, and 100 messages per month. Perfect for trying out numen.",
              },
              {
                q: "Can I upgrade or downgrade anytime?",
                a: "Yes. Change your plan at any time — upgrades take effect immediately and downgrades apply at the next billing cycle.",
              },
              {
                q: "Is there a free trial for Team?",
                a: "The Free plan lets you try the core features. Upgrade to Team when you need more power — no trial needed.",
              },
              {
                q: "What payment methods do you accept?",
                a: "We accept all major credit cards through Stripe. Enterprise customers can pay via invoice.",
              },
            ].map((faq) => (
              <div key={faq.q} className="border-b border-white/10 py-6">
                <p className="text-sm font-semibold text-white">{faq.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-20">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row justify-between gap-12">
            {/* Left: Logo + tagline */}
            <div className="max-w-xs">
              <Link
                href="/"
                className="font-display font-bold text-lg tracking-[0.3em] text-white"
              >
                numen
              </Link>
              <p className="mt-3 text-sm text-white/50 leading-relaxed">
                Intelligent team knowledge automation
              </p>
            </div>

            {/* Right: Link columns */}
            <div className="flex gap-16">
              <div>
                <p className="text-sm font-semibold text-white mb-4">Product</p>
                <ul className="space-y-3 text-sm text-white/50">
                  <li>
                    <a href="/#how-it-works" className="hover:text-white transition-colors">Features</a>
                  </li>
                  <li>
                    <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                  </li>
                  <li>
                    <a href="#" className="hover:text-white transition-colors">Contact</a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-4">Legal</p>
                <ul className="space-y-3 text-sm text-white/50">
                  <li>
                    <a href="#" className="hover:text-white transition-colors">Privacy</a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-white transition-colors">Terms</a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <p className="text-xs text-white/40">
              © 2026 numen
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
