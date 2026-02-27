'use client'

import { Bot, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'motion/react'

export interface AgentStep {
  agentId: number
  name: string
  color: string | null
  taskPrompt: string
}

interface AgentStepListProps {
  steps: AgentStep[]
  onChange: (steps: AgentStep[]) => void
}

export function AgentStepList({ steps, onChange }: AgentStepListProps) {
  function updatePrompt(index: number, prompt: string) {
    const updated = [...steps]
    updated[index] = { ...updated[index], taskPrompt: prompt }
    onChange(updated)
  }

  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index))
  }

  function moveStep(from: number, to: number) {
    if (to < 0 || to >= steps.length) return
    const updated = [...steps]
    const [item] = updated.splice(from, 1)
    updated.splice(to, 0, item)
    onChange(updated)
  }

  if (steps.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-lg border border-dashed border-white/10 py-8 text-center"
      >
        <Bot className="mx-auto h-8 w-8 text-white/10 mb-2" />
        <p className="text-xs text-white/25">No agents added yet</p>
      </motion.div>
    )
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {steps.map((step, index) => (
          <motion.div
            key={`${step.agentId}-${index}`}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveStep(index, index - 1)}
                  disabled={index === 0}
                  className="text-white/20 hover:text-white/50 disabled:opacity-30 text-[10px] cursor-pointer"
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveStep(index, index + 1)}
                  disabled={index === steps.length - 1}
                  className="text-white/20 hover:text-white/50 disabled:opacity-30 text-[10px] cursor-pointer"
                  title="Move down"
                >
                  ▼
                </button>
              </div>

              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-[10px] text-white/40">
                {index + 1}
              </span>

              <div
                className="flex h-6 w-6 items-center justify-center rounded"
                style={{ backgroundColor: `${step.color || '#00D4FF'}20` }}
              >
                <Bot
                  className="h-3.5 w-3.5"
                  style={{ color: step.color || '#00D4FF' }}
                />
              </div>

              <span className="text-sm text-white/70 flex-1">{step.name}</span>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => removeStep(index)}
                className="rounded p-0.5 text-white/25 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </motion.button>
            </div>

            <Input
              value={step.taskPrompt}
              onChange={(e) => updatePrompt(index, e.target.value)}
              placeholder="Task prompt for this agent (optional)..."
              className="bg-white/[0.03] border-white/[0.06] text-white/70 placeholder:text-white/15 text-xs h-8 focus:border-logo-blue/30 transition-colors"
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
