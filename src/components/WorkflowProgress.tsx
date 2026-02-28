'use client'

import { useState } from 'react'
import { Check, Loader2, Circle, X, ChevronDown, AlertTriangle, Zap, Paperclip } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Bot } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import type { WorkflowProgressState, WorkflowStepState } from '@/types'

const APP_LABELS: Record<string, string> = {
  servicenow: 'ServiceNow',
  jira: 'Jira',
  slack: 'Slack',
  aws_ec2: 'AWS EC2',
  aws_s3: 'AWS S3',
  sharepoint: 'SharePoint',
  snowflake: 'Snowflake',
}

interface WorkflowProgressProps {
  progress: WorkflowProgressState
}

function StepRow({ step, index }: { step: WorkflowStepState; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const isExpandable =
    (step.status === 'completed' || step.status === 'failed') &&
    ((step.actions && step.actions.length > 0) || step.error)

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
    >
      <button
        type="button"
        onClick={() => isExpandable && setExpanded(!expanded)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
          isExpandable ? 'hover:bg-white/[0.03] cursor-pointer' : 'cursor-default'
        }`}
      >
        {/* Status icon */}
        <div className="relative shrink-0">
          {step.status === 'completed' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            </motion.div>
          )}
          {step.status === 'running' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative"
            >
              <Loader2 className="h-3.5 w-3.5 text-logo-blue animate-spin" />
              <div className="absolute inset-[-3px] rounded-full animate-glow-pulse-sm" />
            </motion.div>
          )}
          {step.status === 'failed' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <X className="h-3.5 w-3.5 text-red-400" />
            </motion.div>
          )}
          {step.status === 'pending' && (
            <Circle className="h-3.5 w-3.5 text-white/20" />
          )}
        </div>

        {/* Agent name */}
        <span
          className={`flex-1 transition-colors duration-200 ${
            step.status === 'completed'
              ? 'text-white/40'
              : step.status === 'running'
                ? 'font-medium text-white/80'
                : step.status === 'failed'
                  ? 'text-red-400/70'
                  : 'text-white/20'
          }`}
        >
          {step.agent_name}
        </span>

        {/* Expand chevron */}
        {isExpandable && (
          <ChevronDown
            className={`h-3 w-3 text-white/20 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-6 pb-2 pt-0.5 flex flex-col gap-1.5">
              {/* Actions badges */}
              {step.actions && step.actions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {step.actions.map((action, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="text-[9px] font-normal flex items-center gap-1 border-white/[0.06] bg-white/[0.02] text-white/40"
                    >
                      <Zap className="h-2 w-2" />
                      <span>{APP_LABELS[action.app] || action.app}</span>
                      <span className="text-white/15">|</span>
                      <span>{action.action}</span>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Error message */}
              {step.error && (
                <p className="text-[10px] text-red-400/70 leading-relaxed">
                  {step.error}
                </p>
              )}

              {/* Result summary */}
              {step.result_summary && (
                <p className="text-[10px] text-white/30 leading-relaxed">
                  {step.result_summary}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
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

        <div className="rounded-xl glass-subtle px-3 py-3 min-w-[280px]">
          {/* Workflow title */}
          <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-white/[0.06]">
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
                    Document Required
                  </span>
                  <span className="text-[10px] text-amber-400/60 leading-relaxed">
                    The next step needs an invoice/document. Use the{' '}
                    <span className="inline-flex items-center gap-0.5 text-amber-400/80 font-medium">
                      <Paperclip className="h-2.5 w-2.5" /> attach
                    </span>{' '}
                    button below to upload your file, then send a message to continue.
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Typing dots while still running */}
          {!progress.isComplete && !progress.isPaused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1 mt-2 ml-2"
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
