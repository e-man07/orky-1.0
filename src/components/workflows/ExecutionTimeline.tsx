'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Check, X, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StepExecutionCard } from './StepExecutionCard'
import { motion, AnimatePresence } from 'motion/react'
import { staggerContainer, staggerItem } from '@/lib/animations'
import { apiFetch } from '@/lib/api'

interface ExecutionTimelineProps {
  executionId: number | null
  onClose: () => void
}

export function ExecutionTimeline({ executionId, onClose }: ExecutionTimelineProps) {
  const [execution, setExecution] = useState<any>(null)
  const [polling, setPolling] = useState(true)

  const fetchExecution = useCallback(async () => {
    if (!executionId) return
    try {
      const res = await apiFetch(`/api/workflow-executions/${executionId}`)
      if (res.ok) {
        const data = await res.json()
        setExecution(data)
        if (data.status === 'completed' || data.status === 'failed') {
          setPolling(false)
        }
      }
    } catch {
      // ignore
    }
  }, [executionId])

  useEffect(() => {
    if (!executionId) return
    setPolling(true)
    fetchExecution()
  }, [executionId, fetchExecution])

  useEffect(() => {
    if (!polling || !executionId) return
    const interval = setInterval(fetchExecution, 2000)
    return () => clearInterval(interval)
  }, [polling, executionId, fetchExecution])

  if (!executionId || !execution) return null

  const statusConfig: Record<string, { icon: any; color: string; label: string; badgeClass: string }> = {
    pending: {
      icon: Clock,
      color: 'text-white/40',
      label: 'Pending',
      badgeClass: 'bg-white/5 text-white/40 border-white/10',
    },
    running: {
      icon: Loader2,
      color: 'text-logo-blue',
      label: 'Running',
      badgeClass: 'bg-logo-blue/10 text-logo-blue border-logo-blue/20',
    },
    completed: {
      icon: Check,
      color: 'text-emerald-400',
      label: 'Completed',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    failed: {
      icon: X,
      color: 'text-red-400',
      label: 'Failed',
      badgeClass: 'bg-red-500/10 text-red-400 border-red-500/20',
    },
  }

  const config = statusConfig[execution.status] || statusConfig.pending
  const StatusIcon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
      className={`rounded-xl border overflow-hidden transition-colors duration-500 ${
        execution.status === 'running'
          ? 'border-logo-blue/15 bg-white/[0.02]'
          : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]"
      >
        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={execution.status}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <StatusIcon
                className={`h-5 w-5 ${config.color} ${execution.status === 'running' ? 'animate-spin' : ''}`}
              />
            </motion.div>
          </AnimatePresence>
          <div>
            <h3 className="text-sm font-medium text-white/80">
              Execution #{execution.id}
            </h3>
            <div className="text-[10px] text-white/35">
              {execution.workflow?.name}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={execution.status}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <Badge variant="secondary" className={config.badgeClass}>
                {config.label}
              </Badge>
            </motion.div>
          </AnimatePresence>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-white/40 hover:text-white/60 h-7 cursor-pointer"
          >
            Close
          </Button>
        </div>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {execution.errorMessage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-red-500/10 bg-red-500/[0.03]">
              <div className="text-xs text-red-400">{execution.errorMessage}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Steps */}
      <div className="p-5">
        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {execution.steps?.map((step: any) => (
            <motion.div key={step.id} variants={staggerItem}>
              <StepExecutionCard step={step} />
            </motion.div>
          ))}
        </motion.div>

        {(!execution.steps || execution.steps.length === 0) && (
          <div className="text-center py-8">
            {execution.status === 'pending' || execution.status === 'running' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center gap-2 text-white/40 text-sm"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for execution to start...
              </motion.div>
            ) : (
              <div className="text-white/30 text-sm">No step data available</div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
