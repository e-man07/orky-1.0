'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { motion, AnimatePresence } from 'motion/react'
import { staggerContainer, staggerItem } from '@/lib/animations'

interface AppActionsDrawerProps {
  appId: number | null
  appName: string
  open: boolean
  onClose: () => void
}

export function AppActionsDrawer({ appId, appName, open, onClose }: AppActionsDrawerProps) {
  const [actions, setActions] = useState<any[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    if (appId && open) {
      import('@/lib/api').then(({ apiFetch }) => {
        apiFetch(`/api/apps/${appId}`)
          .then((r) => r.json())
          .then((data) => setActions(data.actions || []))
          .catch(() => setActions([]))
      })
    }
  }, [appId, open])

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="bg-neutral-950 border-white/10 text-white w-[400px] sm:w-[450px]">
        <SheetHeader>
          <SheetTitle className="text-white/90">{appName} Actions</SheetTitle>
        </SheetHeader>

        <ScrollArea className="mt-4 h-[calc(100vh-120px)]">
          <motion.div
            className="space-y-3 pr-2"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {actions.map((action) => (
              <motion.div
                key={action.id}
                variants={staggerItem}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-white/80">
                    {action.displayName}
                  </h4>
                  <Badge
                    variant="secondary"
                    className="bg-white/5 text-white/40 border-white/10 text-[10px]"
                  >
                    {action.actionType}
                  </Badge>
                </div>

                {action.description && (
                  <p className="text-xs text-white/40 mb-2">
                    {action.description}
                  </p>
                )}

                <button
                  onClick={() =>
                    setExpandedId(expandedId === action.id ? null : action.id)
                  }
                  className="text-[11px] text-logo-blue hover:text-logo-blue/80 cursor-pointer"
                >
                  {expandedId === action.id ? 'Hide Schema' : 'View Schema'}
                </button>

                <AnimatePresence>
                  {expandedId === action.id && action.inputSchema && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
                      className="overflow-hidden"
                    >
                      <pre className="mt-2 rounded bg-black/40 p-2 text-[10px] text-white/50 overflow-auto max-h-48">
                        {JSON.stringify(action.inputSchema, null, 2)}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}

            {actions.length === 0 && (
              <p className="text-center text-xs text-white/30 py-8">
                No actions available
              </p>
            )}
          </motion.div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
