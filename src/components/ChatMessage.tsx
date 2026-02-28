'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Bot, User, Check, X, FileText, ChevronDown, Circle, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { APP_BY_SLUG } from '@/data/apps'
import type { SourceCitation, ActionTakenData, FileAttachment, WorkflowProgressState } from '@/types'

const APP_LABELS: Record<string, string> = {
  servicenow: 'ServiceNow',
  jira: 'Jira',
  slack: 'Slack',
  aws: 'AWS',
  aws_ec2: 'AWS EC2',
  aws_s3: 'AWS S3',
  sharepoint: 'SharePoint',
  snowflake: 'Snowflake',
  tinyfish: 'Tinyfish',
}

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  sources?: SourceCitation[]
  actionsTaken?: ActionTakenData[]
  fileAttachment?: FileAttachment
  workflowProgress?: WorkflowProgressState
  userName?: string
  userImage?: string | null
  timestamp?: string
}

function AppLogo({ slug, name }: { slug: string; name: string }) {
  const app = APP_BY_SLUG[slug]
  const logoUrl = app?.logoUrl

  return (
    <div className="flex items-center gap-1">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          className="h-3.5 w-3.5 rounded-sm object-contain bg-white/5"
        />
      ) : (
        <div className="h-3.5 w-3.5 rounded-sm bg-white/[0.06] flex items-center justify-center">
          <span className="text-[6px] font-bold text-white/30">
            {name.charAt(0)}
          </span>
        </div>
      )}
      <span className="text-[9px] text-white/30">{name}</span>
    </div>
  )
}

export function ChatMessage({
  role,
  content,
  sources,
  actionsTaken,
  fileAttachment,
  workflowProgress,
  userName,
  userImage,
  timestamp,
}: ChatMessageProps) {
  const [stepsExpanded, setStepsExpanded] = useState(false)
  const isAssistant = role === 'assistant'
  const hasWorkflowSteps = workflowProgress && workflowProgress.steps.length > 0
  // Only show action badges for non-workflow messages
  const hasActions = actionsTaken && actionsTaken.length > 0 && !hasWorkflowSteps

  return (
    <motion.div
      initial={{ opacity: 0, x: isAssistant ? -16 : 16, y: 4 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
      className={`flex gap-3 ${isAssistant ? '' : 'flex-row-reverse'}`}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
      >
        <Avatar className="h-7 w-7 shrink-0">
          {!isAssistant && userImage && <AvatarImage src={userImage} alt={userName || 'User'} />}
          <AvatarFallback
            className={
              isAssistant
                ? 'bg-logo-blue/15 text-logo-blue'
                : 'bg-white/[0.06] text-white/50'
            }
          >
            {isAssistant ? (
              <Bot className="h-3.5 w-3.5" />
            ) : (
              <User className="h-3.5 w-3.5" />
            )}
          </AvatarFallback>
        </Avatar>
      </motion.div>

      <div
        className={`flex max-w-[75%] flex-col gap-1 ${
          isAssistant ? '' : 'items-end'
        }`}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-2"
        >
          <span className="text-[11px] font-medium text-white/50">
            {isAssistant ? 'ORKY' : userName || 'You'}
          </span>
          {timestamp && (
            <span className="text-[10px] text-white/20">{timestamp}</span>
          )}
        </motion.div>

        {/* Ad-hoc action results (non-workflow only) */}
        {hasActions && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap gap-1.5 mb-1"
          >
            {actionsTaken.map((action, idx) => {
              const appLabel = APP_LABELS[action.app] || action.app
              const appData = APP_BY_SLUG[action.app]
              const logoUrl = appData?.logoUrl
              return (
                <motion.div
                  key={idx}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 + idx * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-normal flex items-center gap-1.5 ${
                      action.success
                        ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400/80'
                        : 'border-red-500/20 bg-red-500/[0.06] text-red-400/80'
                    }`}
                  >
                    {action.success ? (
                      <Check className="h-2.5 w-2.5" />
                    ) : (
                      <X className="h-2.5 w-2.5" />
                    )}
                    {logoUrl ? (
                      <img src={logoUrl} alt={appLabel} className="h-3 w-3 rounded-sm object-contain" />
                    ) : null}
                    <span>{appLabel}</span>
                  </Badge>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {/* Collapsed workflow steps summary */}
        {hasWorkflowSteps && isAssistant && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-1"
          >
            <button
              type="button"
              onClick={() => setStepsExpanded(!stepsExpanded)}
              className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors cursor-pointer"
            >
              <Check className="h-2.5 w-2.5 text-emerald-400" />
              <span>
                {workflowProgress!.steps.filter((s) => s.status === 'completed').length}/
                {workflowProgress!.steps.length} steps completed
              </span>
              <ChevronDown
                className={`h-2.5 w-2.5 transition-transform duration-200 ${
                  stepsExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            <AnimatePresence>
              {stepsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1.5 flex flex-col gap-1 rounded-lg glass-subtle px-2.5 py-2">
                    {workflowProgress!.steps.map((step) => (
                      <div
                        key={step.step_order}
                        className="flex items-start gap-2 text-[10px] py-1"
                      >
                        <div className="shrink-0 mt-0.5">
                          {step.status === 'completed' && (
                            <Check className="h-2.5 w-2.5 text-emerald-400" />
                          )}
                          {step.status === 'failed' && (
                            <X className="h-2.5 w-2.5 text-red-400" />
                          )}
                          {step.status === 'pending' && (
                            <Circle className="h-2.5 w-2.5 text-white/20" />
                          )}
                          {step.status === 'running' && (
                            <Loader2 className="h-2.5 w-2.5 text-logo-blue animate-spin" />
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={
                              step.status === 'completed'
                                ? 'text-white/40'
                                : step.status === 'failed'
                                  ? 'text-red-400/70'
                                  : 'text-white/25'
                            }
                          >
                            {step.agent_name}
                          </span>
                          {/* App logos */}
                          {step.apps && step.apps.length > 0 && (
                            <div className="flex items-center gap-2">
                              {step.apps.map((app) => (
                                <AppLogo key={app.slug} slug={app.slug} name={app.name} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* File attachment badge on user messages */}
        {fileAttachment && !isAssistant && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex"
          >
            <Badge
              variant="outline"
              className="border-logo-blue/15 bg-logo-blue/[0.04] text-logo-blue/60 text-[10px] font-normal flex items-center gap-1"
            >
              <FileText className="h-2.5 w-2.5" />
              {fileAttachment.filename}
            </Badge>
          </motion.div>
        )}

        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isAssistant
              ? 'glass-subtle text-white/85'
              : 'bg-logo-blue/[0.08] border border-logo-blue/[0.06] text-white/85'
          }`}
        >
          <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-headings:text-white/90 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-white/90 prose-code:text-logo-blue/80 prose-code:bg-white/[0.04] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>

        {sources && sources.length > 0 && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } },
            }}
            className="flex flex-wrap gap-1 mt-1"
          >
            {sources.map((source) => (
              <motion.div
                key={source.articleNumber}
                variants={{
                  hidden: { scale: 0.8, opacity: 0 },
                  visible: { scale: 1, opacity: 1 },
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Badge
                  variant="outline"
                  className="border-logo-blue/15 bg-logo-blue/[0.04] text-logo-blue/60 text-[10px] font-normal cursor-default"
                >
                  {source.articleNumber}: {source.shortDescription}
                </Badge>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
