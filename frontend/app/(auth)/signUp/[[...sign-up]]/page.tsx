import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#0D0B1A] flex flex-col items-center justify-center px-6">
      <Link
        href="/"
        className="font-display font-bold text-2xl tracking-[0.3em] text-white mb-8"
      >
        numen
      </Link>
      <SignUp
        fallbackRedirectUrl="/dashboard"
        appearance={{
          variables: {
            colorBackground: "#131127",
            colorText: "#ffffff",
            colorTextSecondary: "#9CA3AF",
            colorPrimary: "#2563EB",
            colorInputBackground: "rgba(255,255,255,0.05)",
            colorInputText: "#ffffff",
            borderRadius: "0.75rem",
          },
        }}
      />
      <Link
        href="/"
        className="mt-6 text-sm text-white/40 hover:text-white/60 transition-colors"
      >
        Back to home
      </Link>
    </div>
  );
}
