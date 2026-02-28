'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { ChatMessage } from '@/components/ChatMessage'
import { ChatInput } from '@/components/ChatInput'
import { ExecutionMessage } from '@/components/ExecutionMessage'
import { WorkflowProgress } from '@/components/WorkflowProgress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sparkles, BookOpen, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import type {
  ChatMessageData,
  ExecutionStatus,
  AgentLogData,
  FileAttachment,
  WorkflowProgressState,
  WorkflowStepState,
} from '@/types'
import { apiFetch, parseSSEStream } from '@/lib/api'

interface PendingExecution {
  status: ExecutionStatus
  logs: AgentLogData[]
  isAction?: boolean
}

const SUGGESTION_PROMPTS = [
  { label: 'What is the holiday calendar?', icon: BookOpen, category: 'kb' },
  { label: 'How do I request leave?', icon: BookOpen, category: 'kb' },
  { label: 'Create a ServiceNow incident for server outage', icon: Zap, category: 'action' },
  { label: 'Send a Slack message to the team about deployment', icon: Zap, category: 'action' },
]

export default function ChatPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [pendingExecution, setPendingExecution] =
    useState<PendingExecution | null>(null)
  const [workflowProgress, setWorkflowProgress] =
    useState<WorkflowProgressState | null>(null)
  const workflowProgressRef = useRef<WorkflowProgressState | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/')
    }
  }, [authStatus, router])

  useEffect(() => {
    scrollToBottom()
  }, [messages, pendingExecution, workflowProgress])

  function scrollToBottom() {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  const handleNewChat = useCallback(() => {
    setMessages([])
    setSessionId(null)
    setPendingExecution(null)
    setWorkflowProgress(null)
    workflowProgressRef.current = null
  }, [])

  const handleSelectSession = useCallback(async (id: number) => {
    setSessionId(id)
    setPendingExecution(null)
    setWorkflowProgress(null)
    workflowProgressRef.current = null
    try {
      const res = await apiFetch(`/api/chat/sessions/${id}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }, [])

  const handleSend = useCallback(
    async (message: string, fileAttachment?: FileAttachment) => {
      if (loading) return

      const userMsg: ChatMessageData = {
        id: Date.now(),
        role: 'user',
        content: message,
        fileAttachment,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMsg])
      setLoading(true)
      setPendingExecution({ status: 'parsing', logs: [], isAction: false })
      setWorkflowProgress(null)
      workflowProgressRef.current = null

      try {
        const conversationHistory = messages.slice(-10).map((m) => ({
          role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
          content: m.content,
        }))

        const res = await apiFetch('/api/chat/stream', {
          method: 'POST',
          body: JSON.stringify({
            message,
            sessionId,
            conversationHistory,
            ...(fileAttachment ? { fileAttachment } : {}),
          }),
        })

        if (!res.ok) throw new Error('Chat request failed')

        for await (const event of parseSSEStream(res)) {
          const { type, data } = event

          if (type === 'workflow_started') {
            // Hide the generic execution message, show workflow progress
            setPendingExecution(null)
            const steps: WorkflowStepState[] = data.steps.map(
              (s: any) => ({
                step_order: s.step_order,
                agent_name: s.agent_name,
                agent_icon: s.agent_icon || null,
                agent_color: s.agent_color || null,
                status: 'pending' as const,
              })
            )
            const newProgress: WorkflowProgressState = {
              workflow_name: data.workflow_name,
              steps,
              isComplete: false,
              isPaused: false,
            }
            workflowProgressRef.current = newProgress
            setWorkflowProgress({ ...newProgress })
          } else if (type === 'step_started') {
            const prev: WorkflowProgressState | null = workflowProgressRef.current
            if (prev) {
              const updated: WorkflowProgressState = {
                ...prev,
                steps: prev.steps.map((s: WorkflowStepState) =>
                  s.step_order === data.step_order
                    ? { ...s, status: 'running' as const }
                    : s
                ),
              }
              workflowProgressRef.current = updated
              setWorkflowProgress({ ...updated })
            }
          } else if (type === 'step_completed') {
            const prev: WorkflowProgressState | null = workflowProgressRef.current
            if (prev) {
              const updated: WorkflowProgressState = {
                ...prev,
                steps: prev.steps.map((s: WorkflowStepState) =>
                  s.step_order === data.step_order
                    ? {
                        ...s,
                        status: 'completed' as const,
                        actions: data.actions || [],
                        result_summary: data.result_summary || null,
                      }
                    : s
                ),
              }
              workflowProgressRef.current = updated
              setWorkflowProgress({ ...updated })
            }
          } else if (type === 'step_failed') {
            const prev: WorkflowProgressState | null = workflowProgressRef.current
            if (prev) {
              const updated: WorkflowProgressState = {
                ...prev,
                steps: prev.steps.map((s: WorkflowStepState) =>
                  s.step_order === data.step_order
                    ? { ...s, status: 'failed' as const, error: data.error }
                    : s
                ),
              }
              workflowProgressRef.current = updated
              setWorkflowProgress({ ...updated })
            }
          } else if (type === 'workflow_paused') {
            const prev: WorkflowProgressState | null = workflowProgressRef.current
            if (prev) {
              const updated: WorkflowProgressState = { ...prev, isPaused: true }
              workflowProgressRef.current = updated
              setWorkflowProgress({ ...updated })
            }
            // Enable input so user can attach a file
            setLoading(false)
          } else if (type === 'response') {
            // Final response — create assistant message with embedded workflow progress
            if (data.sessionId && !sessionId) {
              setSessionId(data.sessionId)
            }

            const finalProgress = workflowProgressRef.current
            const isPaused = finalProgress?.isPaused ?? false

            if (isPaused) {
              // Workflow paused for file upload — keep the live WorkflowProgress
              // visible and add the response as a message WITHOUT clearing progress
              const assistantMsg: ChatMessageData = {
                id: Date.now() + 1,
                role: 'assistant',
                content: data.response,
                sources: data.sources,
                actionsTaken: data.actionsTaken,
                createdAt: new Date().toISOString(),
              }
              setMessages((prev) => [...prev, assistantMsg])
              // Don't clear workflowProgress — keep paused UI visible
              setPendingExecution(null)
            } else {
              // Workflow completed — embed progress in message and clear live view
              if (finalProgress) {
                finalProgress.isComplete = true
              }

              const assistantMsg: ChatMessageData = {
                id: Date.now() + 1,
                role: 'assistant',
                content: data.response,
                sources: data.sources,
                actionsTaken: data.actionsTaken,
                workflowProgress: finalProgress || undefined,
                createdAt: new Date().toISOString(),
              }
              setMessages((prev) => [...prev, assistantMsg])
              setWorkflowProgress(null)
              workflowProgressRef.current = null
              setPendingExecution(null)
            }
          }
        }
      } catch (error) {
        console.error('Chat error:', error)
        setPendingExecution({ status: 'failed', logs: [] })
        setWorkflowProgress(null)
        workflowProgressRef.current = null
        setTimeout(() => setPendingExecution(null), 3000)
      } finally {
        setLoading(false)
      }
    },
    [loading, messages, sessionId]
  )

  if (authStatus === 'loading') {
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

  const user = session?.user as any

  return (
    <div className="flex h-screen">
      <Sidebar
        userName={user?.name}
        userEmail={user?.email}
        userTitle={user?.title}
        userDepartment={user?.department}
        currentSessionId={sessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
      />

      <div className="flex flex-1 flex-col">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex h-13 items-center border-b border-white/[0.06] px-6 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-logo-blue/60" />
            <span className="text-sm font-medium text-white/60">
              ORKY Assistant
            </span>
          </div>
        </motion.div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div ref={scrollRef} className="flex flex-col gap-5 p-6">
            <AnimatePresence>
              {messages.length === 0 && !pendingExecution && !workflowProgress && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
                  className="flex flex-1 flex-col items-center justify-center py-24"
                >
                  <div className="flex flex-col items-center gap-5 text-center">
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
                      className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-logo-blue/[0.08]"
                    >
                      <Sparkles className="h-7 w-7 text-logo-blue/50" />
                      <div className="absolute inset-0 rounded-2xl animate-glow-pulse-sm" />
                    </motion.div>
                    <div>
                      <h2 className="text-base font-medium text-white/70">
                        How can I help you?
                      </h2>
                      <p className="mt-1.5 max-w-md text-sm text-white/30">
                        Ask questions from the knowledge base, or tell me to
                        perform actions like creating incidents, sending messages,
                        or managing tickets.
                      </p>
                    </div>
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      variants={{
                        hidden: {},
                        visible: { transition: { staggerChildren: 0.06, delayChildren: 0.3 } },
                      }}
                      className="flex flex-wrap justify-center gap-2 mt-2 max-w-lg"
                    >
                      {SUGGESTION_PROMPTS.map((q) => {
                        const Icon = q.icon
                        return (
                          <motion.button
                            key={q.label}
                            variants={{
                              hidden: { opacity: 0, y: 8, scale: 0.96 },
                              visible: { opacity: 1, y: 0, scale: 1 },
                            }}
                            whileHover={{ scale: 1.02, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleSend(q.label)}
                            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                              q.category === 'action'
                                ? 'border-amber-500/10 bg-amber-500/[0.03] text-amber-400/50 hover:bg-amber-500/[0.06] hover:text-amber-400/70 hover:border-amber-500/15'
                                : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:bg-white/[0.04] hover:text-white/60 hover:border-white/[0.1]'
                            }`}
                          >
                            <Icon className="h-3 w-3 shrink-0" />
                            {q.label}
                          </motion.button>
                        )
                      })}
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                sources={msg.sources}
                actionsTaken={msg.actionsTaken}
                fileAttachment={msg.fileAttachment}
                workflowProgress={msg.workflowProgress}
                userName={user?.name}
                timestamp={new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              />
            ))}

            {/* Live workflow progress (before final response arrives) */}
            <AnimatePresence>
              {workflowProgress && (
                <WorkflowProgress progress={workflowProgress} />
              )}
            </AnimatePresence>

            {/* Fallback generic execution spinner for non-workflow intents */}
            <AnimatePresence>
              {pendingExecution && !workflowProgress && (
                <ExecutionMessage
                  status={pendingExecution.status}
                  logs={pendingExecution.logs}
                  isAction={pendingExecution.isAction}
                />
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Input */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="border-t border-white/[0.06] p-4"
        >
          <div className="mx-auto max-w-3xl">
            <ChatInput onSend={handleSend} disabled={loading} />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
