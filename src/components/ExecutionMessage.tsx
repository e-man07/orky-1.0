'use client'

import { Loader2, AlertCircle } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bot } from 'lucide-react'
import { motion } from 'motion/react'
import type { ExecutionStatus, AgentLogData } from '@/types'

interface ExecutionMessageProps {
  status: ExecutionStatus
  logs: AgentLogData[]
  isAction?: boolean
}

export function ExecutionMessage({ status }: ExecutionMessageProps) {
  if (status === 'conversational' || status === 'success' || status === 'action_completed') return null

  const isFailed = status === 'failed'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
      className="flex gap-3"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
      >
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-logo-blue/15 text-logo-blue">
            <Bot className="h-3.5 w-3.5" />
          </AvatarFallback>
        </Avatar>
      </motion.div>

      <div className="flex flex-col gap-1 max-w-[75%]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-2"
        >
          <span className="text-[11px] font-medium text-white/50">ORKY</span>
        </motion.div>

        <div className="rounded-xl glass-subtle px-4 py-3 min-w-[200px]">
          {isFailed ? (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2.5 text-xs"
            >
              <motion.div animate={{ x: [0, -3, 3, -3, 3, 0] }} transition={{ duration: 0.4 }}>
                <AlertCircle className="h-3.5 w-3.5 text-red-400" />
              </motion.div>
              <span className="text-red-400/80">Something went wrong. Please try again.</span>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Loader2 className="h-3.5 w-3.5 text-logo-blue animate-spin" />
                  <div className="absolute inset-[-3px] rounded-full animate-glow-pulse-sm" />
                </div>
                <span className="text-xs text-white/60">Processing your request</span>
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-1 ml-0.5"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-white/30 typing-dot" />
                <div className="h-1.5 w-1.5 rounded-full bg-white/30 typing-dot" />
                <div className="h-1.5 w-1.5 rounded-full bg-white/30 typing-dot" />
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
