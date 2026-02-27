'use client'

import { Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion } from 'motion/react'

interface AppCardProps {
  app: {
    id: number
    name: string
    slug: string
    description: string | null
    icon: string | null
    logoUrl: string | null
    category: string | null
    isConfigured: boolean
    _count?: { actions: number }
  }
  onConfigure: () => void
  onViewActions: () => void
}

export function AppCard({ app, onConfigure, onViewActions }: AppCardProps) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className="group border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] cursor-pointer relative overflow-hidden"
        onClick={onViewActions}
      >
        <CardContent className="p-5 flex flex-col items-center text-center">
          {/* Logo */}
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/[0.04] group-hover:bg-white/[0.07] transition-colors duration-200 mb-3">
            {app.logoUrl ? (
              <img
                src={app.logoUrl}
                alt={app.name}
                className="h-14 w-14 object-contain opacity-90 group-hover:opacity-100 transition-opacity rounded-lg"
              />
            ) : (
              <Package className="h-8 w-8 text-white/40 group-hover:text-white/60 transition-colors" />
            )}
          </div>

          {/* Name */}
          <h3 className="text-sm font-medium text-logo-blue group-hover:text-logo-blue/90 transition-colors mb-1">
            {app.name}
          </h3>

          {/* Category */}
          {app.category && (
            <span className="text-[10px] text-white/35 mb-2">{app.category}</span>
          )}

          {/* Status badge — hides on hover, replaced by Configure */}
          <div className="mt-auto h-6 flex items-center justify-center">
            <Badge
              variant="secondary"
              className={`text-[9px] px-1.5 py-0 group-hover:hidden ${
                app.isConfigured
                  ? 'bg-emerald-500/10 text-emerald-400/80 border-emerald-500/15'
                  : 'bg-white/[0.03] text-white/25 border-white/[0.06]'
              }`}
            >
              {app.isConfigured ? 'Connected' : 'Not Connected'}
            </Badge>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onConfigure()
              }}
              className="hidden group-hover:inline-flex text-[10px] text-logo-blue/70 hover:text-logo-blue px-2 py-0.5 rounded bg-logo-blue/[0.08] hover:bg-logo-blue/[0.15] transition-colors cursor-pointer"
            >
              Configure
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
