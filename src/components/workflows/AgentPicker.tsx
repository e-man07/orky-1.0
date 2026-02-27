'use client'

import { useState, useEffect } from 'react'
import { Bot } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { motion } from 'motion/react'
import { staggerContainer, staggerItem } from '@/lib/animations'

interface AgentPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (agent: { id: number; name: string; icon: string | null; color: string | null }) => void
  excludeIds?: number[]
}

export function AgentPicker({ open, onClose, onSelect, excludeIds = [] }: AgentPickerProps) {
  const [agents, setAgents] = useState<any[]>([])

  useEffect(() => {
    if (open) {
      import('@/lib/api').then(({ apiFetch }) => {
        apiFetch('/api/agents')
          .then((r) => r.json())
          .then(setAgents)
          .catch(() => setAgents([]))
      })
    }
  }, [open])

  const available = agents.filter(
    (a) => a.status === 'active' && !excludeIds.includes(a.id),
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-neutral-950 border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white/90">Add Agent to Workflow</DialogTitle>
        </DialogHeader>

        <motion.div
          className="space-y-2 max-h-80 overflow-auto py-2"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {available.map((agent) => (
            <motion.button
              key={agent.id}
              variants={staggerItem}
              whileHover={{ y: -1, backgroundColor: 'rgba(255,255,255,0.05)' }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                onSelect({
                  id: agent.id,
                  name: agent.name,
                  icon: agent.icon,
                  color: agent.color,
                })
                onClose()
              }}
              className="flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3 transition-colors text-left cursor-pointer"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${agent.color || '#00D4FF'}20` }}
              >
                <Bot
                  className="h-4 w-4"
                  style={{ color: agent.color || '#00D4FF' }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white/80">{agent.name}</div>
                {agent.description && (
                  <div className="text-[10px] text-white/35 truncate">
                    {agent.description}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-white/25">
                {agent._count?.actions || 0} actions
              </div>
            </motion.button>
          ))}

          {available.length === 0 && (
            <p className="text-center text-xs text-white/30 py-4">
              {agents.length === 0
                ? 'No agents available. Create agents first.'
                : 'All active agents are already added.'}
            </p>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
