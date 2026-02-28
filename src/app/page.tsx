'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Bot, Zap, Shield, Package, ArrowRight } from 'lucide-react'
import { motion } from 'motion/react'

const features = [
  {
    icon: Bot,
    title: 'AI-Powered Knowledge',
    desc: 'Ask questions in natural language and get instant, contextual answers from your enterprise knowledge base.',
  },
  {
    icon: Package,
    title: '70+ App Integrations',
    desc: 'Connect with ServiceNow, Jira, Slack, Salesforce, and dozens more enterprise tools.',
  },
  {
    icon: Shield,
    title: 'Designation-Based Access',
    desc: 'Information automatically filtered by your role and designation band for secure, relevant responses.',
  },
  {
    icon: Zap,
    title: 'Workflow Automation',
    desc: 'Trigger actions across connected apps directly from chat — create tickets, send updates, and more.',
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.25, 0.4, 0.25, 1] as const },
  }),
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session) {
      router.push('/chat')
    }
  }, [session, router])

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-white/40 text-sm"
        >
          Loading...
        </motion.div>
      </div>
    )
  }

  return (
    <div className="relative flex h-screen bg-black overflow-hidden">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(0,212,255,0.06)_0%,_transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(0,212,255,0.04)_0%,_transparent_50%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* Left Panel — Branding & Features */}
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-between p-12 xl:p-16 relative z-10">
        {/* Top: Logo + tagline */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <span className="text-4xl font-bold tracking-tight text-logo-blue">
                ORKY
              </span>
              <div className="absolute inset-0 blur-3xl bg-logo-blue/15 -z-10 scale-150" />
            </div>
          </div>
          <p className="text-white/30 text-sm max-w-md leading-relaxed">
            Your enterprise AI assistant that connects knowledge, apps, and workflows — all in one place.
          </p>
        </motion.div>

        {/* Middle: Feature cards */}
        <div className="flex-1 flex items-center">
          <div className="grid grid-cols-1 gap-4 w-full max-w-lg">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="group flex items-start gap-4 rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-logo-blue/[0.08] text-logo-blue/70 group-hover:bg-logo-blue/[0.12] group-hover:text-logo-blue transition-colors duration-300">
                  <f.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/80 mb-0.5">
                    {f.title}
                  </h3>
                  <p className="text-xs text-white/30 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom: Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex items-center gap-3 text-[11px] text-white/20"
        >
          <span>Powered by Gemini</span>
          <span className="text-white/10">·</span>
          <span>MarTech Mate</span>
        </motion.div>
      </div>

      {/* Divider line */}
      <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent" />

      {/* Right Panel — Sign In */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
        {/* Mobile logo (hidden on desktop) */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:hidden mb-10 flex flex-col items-center gap-3"
        >
          <div className="relative">
            <span className="text-4xl font-bold tracking-tight text-logo-blue">
              ORKY
            </span>
            <div className="absolute inset-0 blur-3xl bg-logo-blue/15 -z-10 scale-150" />
          </div>
          <p className="text-white/30 text-xs text-center max-w-xs">
            Your enterprise AI assistant that connects knowledge, apps, and workflows.
          </p>
        </motion.div>

        {/* Sign-in card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
          className="w-full max-w-sm"
        >
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 backdrop-blur-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white/90 mb-2">
                Welcome back
              </h2>
              <p className="text-sm text-white/35">
                Sign in to access your knowledge base and connected apps.
              </p>
            </div>

            {/* Google sign-in button */}
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => signIn('google', { callbackUrl: '/chat' })}
              className="group relative w-full flex items-center justify-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-6 py-3.5 text-sm font-medium text-white/80 transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.07] hover:text-white cursor-pointer"
            >
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
              <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all duration-200" />
            </motion.button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.06]" />
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="bg-black px-3 text-white/20">
                  Enterprise SSO
                </span>
              </div>
            </div>

            {/* Info text */}
            <p className="text-center text-[11px] text-white/20 leading-relaxed">
              Use your organization&apos;s Google Workspace account to sign in.
              Access is determined by your designation band.
            </p>
          </div>

          {/* Bottom links */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="mt-6 flex items-center justify-center gap-4 text-[11px] text-white/15"
          >
            <span>Secure by default</span>
            <span className="text-white/8">·</span>
            <span>SOC 2 Compliant</span>
            <span className="text-white/8">·</span>
            <span>Enterprise Ready</span>
          </motion.div>
        </motion.div>

        {/* Mobile features (hidden on desktop) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="lg:hidden mt-10 grid grid-cols-2 gap-3 w-full max-w-sm"
        >
          {features.map((f) => (
            <div
              key={f.title}
              className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3"
            >
              <f.icon className="h-3.5 w-3.5 text-logo-blue/50 shrink-0" />
              <span className="text-[10px] text-white/35">{f.title}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
