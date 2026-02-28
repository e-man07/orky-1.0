'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { motion } from 'motion/react'

const stats = [
  { value: '70+', label: 'Connected Apps', sub: 'HR, IT, CRM & more' },
  { value: '500+', label: 'Available Actions', sub: 'Across all platforms' },
  { value: '3', label: 'Access Bands', sub: 'Role-aware filtering' },
  { value: '<2s', label: 'AI Response', sub: 'Powered by Gemini' },
]

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session) router.push('/chat')
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
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(0,212,255,0.05)_0%,_transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(0,212,255,0.03)_0%,_transparent_50%)]" />

      {/* Nav bar */}
      <motion.nav
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 flex items-center justify-between px-8 lg:px-16 py-6"
      >
        <div className="relative">
          <span className="text-2xl font-bold tracking-tight text-logo-blue">
            ORKY
          </span>
          <div className="absolute inset-0 blur-2xl bg-logo-blue/10 -z-10 scale-150" />
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => signIn('google', { callbackUrl: '/chat' })}
          className="group flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/80 hover:bg-white/[0.08] hover:border-white/[0.16] hover:text-white transition-all duration-200 cursor-pointer"
        >
          Get Started
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </motion.button>
      </motion.nav>

      {/* Hero section */}
      <div className="relative z-10 px-8 lg:px-16 pt-12 lg:pt-20">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-12 lg:gap-16 max-w-[1280px]">

          {/* Left — Headline + CTA */}
          <div className="flex-1 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <span className="inline-block text-[11px] font-medium tracking-[0.2em] uppercase text-logo-blue/60 mb-6">
                Agentic AI Platform
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-[clamp(2.5rem,5vw,4.5rem)] font-bold leading-[1.08] tracking-tight text-white mb-6"
            >
              One Intelligent{' '}
              <br className="hidden sm:block" />
              Layer Across Your{' '}
              <br className="hidden sm:block" />
              <span className="text-logo-blue">Enterprise</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="text-base lg:text-lg text-white/40 leading-relaxed max-w-lg mb-10"
            >
              Instead of knowledge living in disconnected systems — HR, IT,
              CRM, compliance — Orky connects them into one unified brain.
              It understands who you are, your role, your department, and your
              access level — and filters information in real time.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex items-center gap-4"
            >
              <button
                onClick={() => signIn('google', { callbackUrl: '/chat' })}
                className="group flex items-center gap-3 rounded-xl bg-logo-blue px-7 py-3.5 text-sm font-semibold text-black hover:bg-logo-blue/90 transition-colors duration-200 cursor-pointer"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#1a1a1a"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#1a1a1a"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#1a1a1a"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#1a1a1a"
                  />
                </svg>
                Sign in with Google
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </motion.div>
          </div>

          {/* Right — Stat cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid grid-cols-2 gap-3 lg:gap-4 w-full lg:max-w-md"
          >
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 + i * 0.08 }}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 lg:p-6 hover:border-white/[0.1] hover:bg-white/[0.03] transition-all duration-300"
              >
                <div className="text-3xl lg:text-4xl font-bold text-white mb-1.5 tracking-tight">
                  {s.value}
                </div>
                <div className="text-sm font-medium text-white/70 mb-0.5">
                  {s.label}
                </div>
                <div className="text-[11px] text-white/30">
                  {s.sub}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Capabilities bar */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.55 }}
        className="relative z-10 px-8 lg:px-16 mt-16 lg:mt-24 max-w-[1280px]"
      >
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-sm font-medium text-white/70">Platform Capabilities</span>
            <span className="text-[10px] font-mono text-white/25 tracking-wider uppercase">What ORKY Does</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
            <div className="p-6">
              <div className="text-sm font-medium text-white/80 mb-1.5">Context-Aware Answers</div>
              <p className="text-xs text-white/35 leading-relaxed">
                Every employee gets the exact answer they&apos;re authorized to see, specific to their role, department, and designation band.
              </p>
            </div>
            <div className="p-6">
              <div className="text-sm font-medium text-white/80 mb-1.5">Unified Knowledge</div>
              <p className="text-xs text-white/35 leading-relaxed">
                HR, IT, CRM, compliance — all connected into one brain. Ask questions across systems from a single chat interface.
              </p>
            </div>
            <div className="p-6">
              <div className="text-sm font-medium text-white/80 mb-1.5">Zero Information Leakage</div>
              <p className="text-xs text-white/35 leading-relaxed">
                No hallucinations. No irrelevant content. No information leakage. Every response is grounded in verified, access-controlled data.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        className="relative z-10 px-8 lg:px-16 py-8 mt-8 flex items-center justify-between text-[11px] text-white/20"
      >
        <div className="flex items-center gap-3">
          <span>Powered by Gemini</span>
          <span className="text-white/10">·</span>
          <span>MarTech Mate</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Enterprise SSO</span>
          <span className="text-white/10">·</span>
          <span>Role-Based Access</span>
        </div>
      </motion.div>
    </div>
  )
}
