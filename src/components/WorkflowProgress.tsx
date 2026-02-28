'use client'

import { Check, Loader2, Circle, X, AlertTriangle, Paperclip, Mail } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bot } from 'lucide-react'
import { motion } from 'motion/react'
import { APP_BY_SLUG } from '@/data/apps'
import type { WorkflowProgressState, WorkflowStepState } from '@/types'

function AppLogo({ slug, name }: { slug: string; name: string }) {
  const app = APP_BY_SLUG[slug]
  const logoUrl = app?.logoUrl

  return (
    <div className="flex items-center gap-1.5">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          className="h-4 w-4 rounded-sm object-contain bg-white/5"
        />
      ) : (
        <div className="h-4 w-4 rounded-sm bg-white/[0.06] flex items-center justify-center">
          <span className="text-[7px] font-bold text-white/30">
            {name.charAt(0)}
          </span>
        </div>
      )}
      <span className="text-[10px] text-white/30">{name}</span>
    </div>
  )
}

function StepRow({ step, index }: { step: WorkflowStepState; index: number }) {
  const isRunning = step.status === 'running'
  const isCompleted = step.status === 'completed'
  const isFailed = step.status === 'failed'
  const isPending = step.status === 'pending'

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
        isRunning ? 'bg-white/[0.02]' : ''
      }`}
    >
      {/* Status icon */}
      <div className="relative shrink-0 mt-0.5">
        {isCompleted && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          </motion.div>
        )}
        {isRunning && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <Loader2 className="h-3.5 w-3.5 text-logo-blue animate-spin" />
            <div className="absolute inset-[-3px] rounded-full animate-glow-pulse-sm" />
          </motion.div>
        )}
        {isFailed && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <X className="h-3.5 w-3.5 text-red-400" />
          </motion.div>
        )}
        {isPending && (
          <Circle className="h-3.5 w-3.5 text-white/15" />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1 min-w-0">
        {/* Agent name */}
        <span
          className={`text-xs leading-tight transition-colors duration-200 ${
            isCompleted
              ? 'text-white/40'
              : isRunning
                ? 'font-medium text-white/80'
                : isFailed
                  ? 'text-red-400/70'
                  : 'text-white/20'
          }`}
        >
          {step.agent_name}
        </span>

        {/* App logos row */}
        {step.apps && step.apps.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            {step.apps.map((app) => (
              <AppLogo key={app.slug} slug={app.slug} name={app.name} />
            ))}
          </div>
        )}

        {/* Error message */}
        {isFailed && step.error && (
          <p className="text-[10px] text-red-400/60 leading-relaxed mt-0.5">
            {step.error}
          </p>
        )}
      </div>
    </motion.div>
  )
}

interface WorkflowProgressProps {
  progress: WorkflowProgressState
}

export function WorkflowProgress({ progress }: WorkflowProgressProps) {
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

        <div className="rounded-xl glass-subtle px-3 py-3 min-w-[300px]">
          {/* Workflow title */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06]">
            {!progress.isComplete && (
              <Loader2 className="h-3 w-3 text-logo-blue animate-spin shrink-0" />
            )}
            {progress.isComplete && (
              <Check className="h-3 w-3 text-emerald-400 shrink-0" />
            )}
            <span className="text-[11px] font-medium text-white/60">
              {progress.isComplete ? 'Completed' : 'Running'}:{' '}
              <span className="text-white/80">{progress.workflow_name}</span>
            </span>
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-0.5">
            {progress.steps.map((step, idx) => (
              <StepRow key={step.step_order} step={step} index={idx} />
            ))}
          </div>

          {/* Paused state — file upload required */}
          {progress.isPaused && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2.5 pt-2.5 border-t border-amber-400/10"
            >
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-amber-400/90">
                    {progress.pauseReason ? 'Document Rejected' : 'Document Required'}
                  </span>
                  <span className="text-[10px] text-amber-400/60 leading-relaxed">
                    {progress.pauseReason || 'The next step needs an invoice/document.'}{' '}
                    Use the{' '}
                    <span className="inline-flex items-center gap-0.5 text-amber-400/80 font-medium">
                      <Paperclip className="h-2.5 w-2.5" /> attach
                    </span>{' '}
                    button below to upload your file, then send a message to continue.
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Email notification indicator */}
          {progress.isComplete && progress.notificationSent && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2.5 pt-2.5 border-t border-white/[0.06]"
            >
              <div className="flex items-center gap-2 text-[10px] text-white/30">
                <Mail className="h-3 w-3" />
                <span>Completion email sent</span>
              </div>
            </motion.div>
          )}

          {/* Typing dots while still running */}
          {!progress.isComplete && !progress.isPaused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1 mt-2.5 ml-2"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-white/30 typing-dot" />
              <div className="h-1.5 w-1.5 rounded-full bg-white/30 typing-dot" />
              <div className="h-1.5 w-1.5 rounded-full bg-white/30 typing-dot" />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
