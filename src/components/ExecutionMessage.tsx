'use client'

import { Check, Loader2, AlertCircle, Search, Sparkles, Brain, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import type { ExecutionStatus, AgentLogData } from '@/types'

interface ExecutionMessageProps {
  status: ExecutionStatus
  logs: AgentLogData[]
  isAction?: boolean
}

const KB_STEPS: {
  status: ExecutionStatus
  label: string
  icon: React.ReactNode
}[] = [
  { status: 'parsing', label: 'Understanding your question', icon: <Brain className="h-3.5 w-3.5" /> },
  { status: 'searching_kb', label: 'Searching knowledge base', icon: <Search className="h-3.5 w-3.5" /> },
  { status: 'generating', label: 'Generating response', icon: <Sparkles className="h-3.5 w-3.5" /> },
]

const ACTION_STEPS: {
  status: ExecutionStatus
  label: string
  icon: React.ReactNode
}[] = [
  { status: 'parsing', label: 'Understanding your request', icon: <Brain className="h-3.5 w-3.5" /> },
  { status: 'executing_actions', label: 'Executing actions', icon: <Zap className="h-3.5 w-3.5" /> },
  { status: 'generating', label: 'Preparing response', icon: <Sparkles className="h-3.5 w-3.5" /> },
]

function getStepState(
  stepStatus: ExecutionStatus,
  currentStatus: ExecutionStatus,
  isAction: boolean,
): 'done' | 'active' | 'pending' {
  const order: ExecutionStatus[] = isAction
    ? ['pending', 'parsing', 'executing_actions', 'generating', 'action_completed']
    : ['pending', 'parsing', 'searching_kb', 'generating', 'success']

  const stepIdx = order.indexOf(stepStatus)
  const currentIdx = order.indexOf(currentStatus)

  if (currentStatus === 'failed' || currentStatus === 'conversational') {
    if (stepIdx <= currentIdx) return 'done'
    return 'pending'
  }

  if (stepIdx < currentIdx) return 'done'
  if (stepIdx === currentIdx) return 'active'
  return 'pending'
}

export function ExecutionMessage({ status, logs, isAction = false }: ExecutionMessageProps) {
  if (status === 'conversational' || status === 'success' || status === 'action_completed') return null

  const steps = isAction ? ACTION_STEPS : KB_STEPS

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
      className="flex gap-3"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-logo-blue/15"
      >
        <Loader2 className="h-3.5 w-3.5 text-logo-blue" />
      </motion.div>

      <div className="flex flex-col gap-2 rounded-xl glass-subtle px-4 py-3">
        <div className="flex flex-col gap-2">
          {steps.map((step, index) => {
            const state = getStepState(step.status, status, isAction)
            return (
              <motion.div
                key={step.status}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                className="flex items-center gap-2.5 text-xs"
              >
                <div className="relative">
                  <AnimatePresence mode="wait">
                    {state === 'done' ? (
                      <motion.div
                        key="done"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      </motion.div>
                    ) : state === 'active' ? (
                      <motion.div
                        key="active"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative"
                      >
                        <Loader2 className="h-3.5 w-3.5 text-logo-blue animate-spin" />
                        <div className="absolute inset-[-3px] rounded-full animate-glow-pulse-sm" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="pending"
                        className="h-3.5 w-3.5 rounded-full border border-white/15"
                      />
                    )}
                  </AnimatePresence>
                </div>

                {/* Connector line */}
                {index < steps.length - 1 && (
                  <motion.div
                    className="absolute left-[8.5px] top-[22px] w-px bg-white/[0.06]"
                    initial={{ height: 0 }}
                    animate={{ height: 14 }}
                    transition={{ delay: index * 0.1 + 0.15, duration: 0.2 }}
                    style={{ position: 'absolute' }}
                  />
                )}

                <span
                  className={`transition-colors duration-200 ${
                    state === 'done'
                      ? 'text-white/40'
                      : state === 'active'
                        ? 'text-white/75'
                        : 'text-white/20'
                  }`}
                >
                  {step.label}
                </span>
              </motion.div>
            )
          })}

          <AnimatePresence>
            {status === 'failed' && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-xs text-red-400"
              >
                <motion.div animate={{ x: [0, -3, 3, -3, 3, 0] }} transition={{ duration: 0.4 }}>
                  <AlertCircle className="h-3.5 w-3.5" />
                </motion.div>
                <span>An error occurred</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Typing indicator when generating */}
        {(status === 'generating' || status === 'executing_actions') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1 pt-1"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-white/30 typing-dot" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/30 typing-dot" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/30 typing-dot" />
          </motion.div>
        )}

        {logs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-1 border-t border-white/[0.04] pt-2"
          >
            {logs.slice(-3).map((log) => (
              <div
                key={log.id}
                className="text-[10px] text-white/25 leading-relaxed"
              >
                <span className="text-white/35">[{log.agentType}]</span>{' '}
                {log.action}
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
