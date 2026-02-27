'use client'

import { Bot, MoreVertical, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { motion } from 'motion/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface AgentCardProps {
  agent: {
    id: number
    name: string
    description: string | null
    model: string
    color: string | null
    status: string
    _count?: { actions: number; workflowAgents: number }
  }
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
}

export function AgentCard({ agent, isSelected, onClick, onDelete }: AgentCardProps) {
  const agentColor = agent.color || '#00D4FF'

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
      className={`flex items-center gap-3 rounded-lg border px-3 py-3 cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'bg-white/[0.04]'
          : 'border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.03]'
      }`}
      style={{
        borderColor: isSelected ? `${agentColor}30` : undefined,
        boxShadow: isSelected ? `0 0 16px ${agentColor}10` : undefined,
      }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-shadow duration-200"
        style={{
          backgroundColor: `${agentColor}15`,
        }}
      >
        <Bot className="h-4 w-4" style={{ color: agentColor }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80 truncate">
            {agent.name}
          </span>
          <Badge
            variant="secondary"
            className={`text-[9px] px-1.5 py-0 ${
              agent.status === 'active'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                : 'bg-white/[0.03] text-white/25 border-white/[0.06]'
            }`}
          >
            {agent.status}
          </Badge>
        </div>
        <div className="text-[10px] text-white/30 mt-0.5 truncate">
          {agent._count?.actions || 0} actions
          {agent._count?.workflowAgents ? ` · ${agent._count.workflowAgents} workflows` : ''}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={(e) => e.stopPropagation()}
          className="rounded p-1 text-white/25 hover:text-white/50 hover:bg-white/[0.04]"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-neutral-950 border-white/[0.08]">
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  )
}
