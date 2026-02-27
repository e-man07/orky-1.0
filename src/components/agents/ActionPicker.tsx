'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search, Package, Zap } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'motion/react'
import { apiFetch } from '@/lib/api'

interface ActionPickerProps {
  selectedActionIds: number[]
  onChange: (ids: number[]) => void
}

interface ActionItem {
  id: number
  name: string
  displayName: string
  description: string | null
  actionType: string
  isEnabled: boolean
}

interface AppWithActions {
  id: number
  name: string
  slug: string
  icon: string | null
  category: string | null
  actions: ActionItem[]
}

const CATEGORY_COLORS: Record<string, string> = {
  'CRM': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'ERP': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'ITSM': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Cloud Infrastructure': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'HCM': 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  'Data & Analytics': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Productivity': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'Communication': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Collaboration': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  'Project Management': 'bg-red-500/10 text-red-400 border-red-500/20',
  'Customer Support': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  'Document Management': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

export function ActionPicker({ selectedActionIds, onChange }: ActionPickerProps) {
  const [apps, setApps] = useState<AppWithActions[]>([])
  const [expandedApps, setExpandedApps] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiFetch('/api/apps?include_actions=true')
      .then((r) => r.json())
      .then((data) => {
        setApps(data)
        // Auto-expand apps that have selected actions
        const expandIds = new Set<number>()
        for (const app of data) {
          const hasSelected = app.actions?.some((a: ActionItem) =>
            selectedActionIds.includes(a.id)
          )
          if (hasSelected) expandIds.add(app.id)
        }
        if (expandIds.size > 0) setExpandedApps(expandIds)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filteredApps = useMemo(() => {
    if (!search.trim()) return apps
    const q = search.toLowerCase()
    return apps
      .map((app) => ({
        ...app,
        actions: app.actions.filter(
          (a) =>
            a.displayName.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            (a.description && a.description.toLowerCase().includes(q)) ||
            app.name.toLowerCase().includes(q)
        ),
      }))
      .filter((app) => app.actions.length > 0)
  }, [apps, search])

  const totalSelected = selectedActionIds.length
  const totalActions = apps.reduce((sum, app) => sum + (app.actions?.length || 0), 0)

  function toggleApp(appId: number) {
    setExpandedApps((prev) => {
      const next = new Set(prev)
      if (next.has(appId)) next.delete(appId)
      else next.add(appId)
      return next
    })
  }

  function toggleAction(actionId: number) {
    if (selectedActionIds.includes(actionId)) {
      onChange(selectedActionIds.filter((id) => id !== actionId))
    } else {
      onChange([...selectedActionIds, actionId])
    }
  }

  function toggleAllForApp(app: AppWithActions) {
    const appActionIds = app.actions.map((a) => a.id)
    const allSelected = appActionIds.every((id) => selectedActionIds.includes(id))

    if (allSelected) {
      onChange(selectedActionIds.filter((id) => !appActionIds.includes(id)))
    } else {
      const newIds = new Set([...selectedActionIds, ...appActionIds])
      onChange(Array.from(newIds))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-white/30 text-xs">
        Loading actions...
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Search + count header */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actions across all apps..."
            className="pl-8 h-8 text-xs bg-white/[0.03] border-white/[0.08] text-white/70 placeholder:text-white/20 focus:border-logo-blue/30"
          />
        </div>
        <Badge
          variant="outline"
          className="shrink-0 text-[10px] border-white/10 text-white/40 font-normal"
        >
          {totalSelected}/{totalActions}
        </Badge>
      </div>

      {/* App list */}
      <div className="space-y-1">
        {filteredApps.map((app) => {
          const isExpanded = expandedApps.has(app.id)
          const appActionIds = app.actions.map((a) => a.id)
          const selectedCount = appActionIds.filter((id) =>
            selectedActionIds.includes(id)
          ).length
          const allSelected = selectedCount === app.actions.length && app.actions.length > 0
          const catColor = CATEGORY_COLORS[app.category || ''] || 'bg-white/5 text-white/40 border-white/10'

          return (
            <div
              key={app.id}
              className="rounded-lg border border-white/[0.06] overflow-hidden"
            >
              {/* App header */}
              <div className="flex items-center gap-1.5 pr-2">
                <button
                  onClick={() => toggleApp(app.id)}
                  className="flex flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-white/40 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-white/40 shrink-0" />
                  )}
                  <Package className="h-3.5 w-3.5 text-white/30 shrink-0" />
                  <span className="text-xs text-white/70 font-medium flex-1 truncate">
                    {app.name}
                  </span>
                  {app.category && (
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-normal px-1.5 py-0 h-4 shrink-0 ${catColor}`}
                    >
                      {app.category}
                    </Badge>
                  )}
                </button>
                {/* Select all checkbox */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedCount > 0 && (
                    <span className="text-[10px] text-logo-blue bg-logo-blue/10 px-1.5 py-0.5 rounded">
                      {selectedCount}/{app.actions.length}
                    </span>
                  )}
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => toggleAllForApp(app)}
                    className="border-white/20 data-[state=checked]:bg-logo-blue data-[state=checked]:border-logo-blue"
                    title="Select all actions"
                  />
                </div>
              </div>

              {/* Actions list */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-white/[0.04] bg-white/[0.01]">
                      {app.actions.map((action) => (
                        <label
                          key={action.id}
                          className="flex items-start gap-3 px-4 py-2 cursor-pointer hover:bg-white/[0.02] transition-colors"
                        >
                          <Checkbox
                            checked={selectedActionIds.includes(action.id)}
                            onCheckedChange={() => toggleAction(action.id)}
                            className="mt-0.5 border-white/20 data-[state=checked]:bg-logo-blue data-[state=checked]:border-logo-blue"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Zap className="h-3 w-3 text-amber-400/50 shrink-0" />
                              <span className="text-xs text-white/70">
                                {action.displayName}
                              </span>
                            </div>
                            {action.description && (
                              <div className="text-[10px] text-white/35 mt-0.5 ml-[18px] truncate">
                                {action.description}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}

        {filteredApps.length === 0 && (
          <div className="text-center py-6 text-xs text-white/20">
            {search ? 'No actions match your search' : 'No apps available'}
          </div>
        )}
      </div>
    </div>
  )
}
