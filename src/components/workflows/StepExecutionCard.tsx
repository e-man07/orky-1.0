'use client'

import { useState } from 'react'
import { Bot, Check, X, Loader2, Clock, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'motion/react'
import { staggerContainer, staggerItem } from '@/lib/animations'

interface StepExecutionCardProps {
  step: {
    id: number
    stepOrder: number
    status: string
    agentThinking: string | null
    actionsInvoked: { action: string; app: string; input: any; output: any }[] | null
    result: any
    errorMessage: string | null
    startedAt: string | null
    completedAt: string | null
    workflowAgent: {
      agent: { name: string; icon: string | null; color: string | null }
    }
  }
}

const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  pending: { icon: Clock, color: 'text-white/40', bg: 'bg-white/5' },
  running: { icon: Loader2, color: 'text-logo-blue', bg: 'bg-logo-blue/10' },
  completed: { icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  failed: { icon: X, color: 'text-red-400', bg: 'bg-red-500/10' },
}

export function StepExecutionCard({ step }: StepExecutionCardProps) {
  const [expanded, setExpanded] = useState(step.status === 'completed' || step.status === 'failed')
  const config = statusConfig[step.status] || statusConfig.pending
  const StatusIcon = config.icon
  const agent = step.workflowAgent.agent

  return (
    <div
      className={`rounded-lg border overflow-hidden transition-colors duration-300 ${
        step.status === 'running'
          ? 'border-logo-blue/20 bg-logo-blue/[0.02]'
          : 'border-white/[0.06] bg-white/[0.02]'
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        {/* Step number + status */}
        <div className={`flex h-7 w-7 items-center justify-center rounded-full ${config.bg} transition-colors duration-300`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step.status}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <StatusIcon
                className={`h-3.5 w-3.5 ${config.color} ${step.status === 'running' ? 'animate-spin' : ''}`}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Agent info */}
        <div
          className="flex h-6 w-6 items-center justify-center rounded"
          style={{ backgroundColor: `${agent.color || '#00D4FF'}20` }}
        >
          <Bot className="h-3.5 w-3.5" style={{ color: agent.color || '#00D4FF' }} />
        </div>

        <div className="flex-1 text-left">
          <span className="text-sm text-white/80">
            Step {step.stepOrder}: {agent.name}
          </span>
        </div>

        <Badge
          variant="secondary"
          className={`text-[10px] ${config.bg} ${config.color} border-transparent transition-colors duration-300`}
        >
          {step.status}
        </Badge>

        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-white/30" />
        </motion.div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.04] px-4 py-3 space-y-3">
              {/* Error */}
              {step.errorMessage && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                  className="rounded bg-red-500/10 border border-red-500/20 px-3 py-2"
                >
                  <div className="text-[10px] font-medium text-red-400 mb-0.5">Error</div>
                  <div className="text-xs text-red-300/80">{step.errorMessage}</div>
                </motion.div>
              )}

              {/* Agent Thinking */}
              {step.agentThinking && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  <div className="text-[10px] font-medium text-white/40 mb-1">Agent Response</div>
                  <div className="rounded bg-black/30 px-3 py-2 text-xs text-white/60 whitespace-pre-wrap max-h-48 overflow-auto">
                    {step.agentThinking}
                  </div>
                </motion.div>
              )}

              {/* Actions Invoked */}
              {step.actionsInvoked && step.actionsInvoked.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium text-white/40 mb-1">
                    Actions Invoked ({step.actionsInvoked.length})
                  </div>
                  <motion.div
                    className="space-y-2"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                  >
                    {step.actionsInvoked.map((action, i) => (
                      <motion.div
                        key={i}
                        variants={staggerItem}
                        className="rounded border border-white/[0.04] bg-black/20 p-2"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="secondary"
                            className="bg-logo-blue/10 text-logo-blue border-logo-blue/20 text-[9px]"
                          >
                            {action.app}
                          </Badge>
                          <span className="text-[11px] text-white/60 font-mono">
                            {action.action}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[9px] text-white/30 mb-0.5">Input</div>
                            <pre className="text-[10px] text-white/40 overflow-auto max-h-24">
                              {JSON.stringify(action.input, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <div className="text-[9px] text-white/30 mb-0.5">Output</div>
                            <pre className="text-[10px] text-white/40 overflow-auto max-h-24">
                              {JSON.stringify(action.output, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              )}

              {/* Duration */}
              {step.startedAt && step.completedAt && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="text-[10px] text-white/25"
                >
                  Duration:{' '}
                  {(
                    (new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) /
                    1000
                  ).toFixed(1)}
                  s
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
