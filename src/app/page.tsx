'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { LogIn, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'

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
      <div className="flex h-screen items-center justify-center">
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
    <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden">
      {/* Background radial gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,212,255,0.04)_0%,_transparent_70%)]" />

      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
        }}
        className="relative z-10 flex flex-col items-center gap-8"
      >
        {/* Logo + badge */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] } },
          }}
          className="flex flex-col items-center gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="text-5xl font-bold tracking-tight text-logo-blue">
                ORKY
              </span>
              {/* Glow behind logo */}
              <div className="absolute inset-0 blur-2xl bg-logo-blue/20 -z-10" />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1">
            <Sparkles className="h-3 w-3 text-logo-blue/60" />
            <span className="text-xs text-white/40">
              AI-Powered Knowledge Assistant
            </span>
          </div>
        </motion.div>

        {/* Description */}
        <motion.p
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] } },
          }}
          className="max-w-sm text-center text-sm leading-relaxed text-white/30"
        >
          Intelligent knowledge base with role-based access control.
          Ask questions about policies, procedures, and more.
        </motion.p>

        {/* Sign in button */}
        <motion.button
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] } },
          }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => signIn('google', { callbackUrl: '/chat' })}
          className="group relative flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-8 py-3.5 text-sm font-medium text-white/80 transition-colors hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white"
        >
          {/* Button glow ring */}
          <div className="absolute inset-0 rounded-xl animate-glow-pulse-sm" />
          <LogIn className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-[-1px]" />
          Sign in with Google
        </motion.button>

        {/* Footer */}
        <motion.div
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { duration: 0.4, delay: 0.2 } },
          }}
          className="flex items-center gap-2 text-[10px] text-white/15"
        >
          <span>Powered by Gemini</span>
          <span>·</span>
          <span>MarTech Mate</span>
        </motion.div>
      </motion.div>
    </div>
  )
}
