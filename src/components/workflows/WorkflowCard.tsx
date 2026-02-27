'use client'

import { GitBranch, MoreVertical, Trash2, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { motion } from 'motion/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface WorkflowCardProps {
  workflow: {
    id: number
    name: string
    description: string | null
    status: string
    _count?: { agents: number; executions: number }
    agents?: { agent: { name: string; color: string | null } }[]
  }
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
  onExecute: () => void
}

export function WorkflowCard({
  workflow,
  isSelected,
  onClick,
  onDelete,
  onExecute,
}: WorkflowCardProps) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
      className={`flex items-center gap-3 rounded-lg border px-3 py-3 cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'border-logo-blue/25 bg-logo-blue/[0.05] shadow-[0_0_12px_rgba(0,212,255,0.06)]'
          : 'border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/[0.08]'
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
        <GitBranch className="h-4 w-4 text-purple-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80 truncate">
            {workflow.name}
          </span>
          <Badge
            variant="secondary"
            className={`text-[9px] px-1.5 py-0 ${
              workflow.status === 'active'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                : 'bg-white/[0.03] text-white/25 border-white/[0.06]'
            }`}
          >
            {workflow.status}
          </Badge>
        </div>
        <div className="text-[10px] text-white/30 mt-0.5">
          {workflow._count?.agents || 0} agents · {workflow._count?.executions || 0} runs
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
            onClick={(e) => { e.stopPropagation(); onExecute() }}
            className="text-logo-blue focus:text-logo-blue focus:bg-logo-blue/10"
          >
            <Play className="mr-2 h-3.5 w-3.5" />
            Run
          </DropdownMenuItem>
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
