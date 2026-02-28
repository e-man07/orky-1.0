'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { GitBranch, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sidebar } from '@/components/Sidebar'
import { WorkflowCard } from '@/components/workflows/WorkflowCard'
import { WorkflowForm } from '@/components/workflows/WorkflowForm'
import { ExecutionTimeline } from '@/components/workflows/ExecutionTimeline'
import { motion } from 'motion/react'
import { staggerContainer, staggerItem, pageVariants } from '@/lib/animations'
import { apiFetch } from '@/lib/api'

export default function WorkflowsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [workflows, setWorkflows] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [executionId, setExecutionId] = useState<number | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
    if (status === 'authenticated') fetchWorkflows()
  }, [status])

  async function fetchWorkflows() {
    const res = await apiFetch('/api/workflows')
    if (res.ok) {
      const data = await res.json()
      setWorkflows(data)
    }
  }

  async function handleDelete(id: number) {
    await apiFetch(`/api/workflows/${id}`, { method: 'DELETE' })
    if (selectedId === id) {
      setSelectedId(null)
      setCreating(false)
    }
    fetchWorkflows()
  }

  async function handleExecute(workflowId: number) {
    try {
      const res = await apiFetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
        body: JSON.stringify({
          triggerInput: 'Execute this workflow based on the configured agent steps.',
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setExecutionId(data.executionId)
        fetchWorkflows()
      }
    } catch (e) {
      console.error('Failed to execute workflow:', e)
    }
  }

  function handleNew() {
    setSelectedId(null)
    setCreating(true)
    setExecutionId(null)
  }

  function handleSaved() {
    setCreating(false)
    fetchWorkflows()
  }

  const selectedWorkflow = selectedId
    ? workflows.find((w) => w.id === selectedId) || null
    : null

  const user = session?.user as any

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-white/30 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-black">
      <Sidebar
        userName={user?.name}
        userEmail={user?.email}
        userImage={user?.image}
        userTitle={user?.title}
        userDepartment={user?.department}
        currentSessionId={null}
        onNewChat={() => router.push('/chat')}
        onSelectSession={() => router.push('/chat')}
      />
      {/* Left panel */}
      <div className="flex w-80 flex-col border-r border-white/[0.06]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-purple-400/70" />
            <h1 className="text-lg font-semibold text-white/85">Workflows</h1>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handleNew}
              size="sm"
              className="bg-logo-blue/80 hover:bg-logo-blue text-black font-medium h-7 text-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New
            </Button>
          </motion.div>
        </motion.div>

        <Separator className="bg-white/[0.06]" />

        <ScrollArea className="flex-1 p-3">
          <motion.div
            className="space-y-2"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {workflows.map((wf) => (
              <motion.div key={wf.id} variants={staggerItem}>
                <WorkflowCard
                  workflow={wf}
                  isSelected={selectedId === wf.id}
                  onClick={() => {
                    setSelectedId(wf.id)
                    setCreating(false)
                    setExecutionId(null)
                  }}
                  onDelete={() => handleDelete(wf.id)}
                  onExecute={() => handleExecute(wf.id)}
                />
              </motion.div>
            ))}
            {workflows.length === 0 && (
              <div className="py-12 text-center text-xs text-white/20">
                No workflows yet. Create one to get started.
              </div>
            )}
          </motion.div>
        </ScrollArea>
      </div>

      {/* Right panel */}
      <motion.div
        className="flex-1 overflow-auto"
        variants={pageVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="mx-auto max-w-2xl p-8 space-y-8">
          {(creating || selectedWorkflow) && (
            <WorkflowForm
              workflow={selectedWorkflow}
              onSaved={handleSaved}
              onExecute={handleExecute}
            />
          )}

          {executionId && (
            <ExecutionTimeline
              executionId={executionId}
              onClose={() => setExecutionId(null)}
            />
          )}

          {!creating && !selectedWorkflow && !executionId && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <GitBranch className="mx-auto h-12 w-12 text-white/[0.06] mb-3" />
                <p className="text-sm text-white/25">
                  Select a workflow or create a new one
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
