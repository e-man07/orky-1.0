'use client'

import { Badge } from '@/components/ui/badge'
import { Briefcase } from 'lucide-react'
import { motion } from 'motion/react'

interface UserBadgeProps {
  title?: string | null
  department?: string | null
}

export function UserBadge({ title, department }: UserBadgeProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.05 } },
      }}
      className="flex flex-wrap gap-1"
    >
      {title && (
        <motion.div
          variants={{
            hidden: { scale: 0.8, opacity: 0 },
            visible: { scale: 1, opacity: 1 },
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Badge
            variant="outline"
            className="border-logo-blue/20 bg-logo-blue/[0.06] text-logo-blue/80 text-[10px] gap-1"
          >
            <Briefcase className="h-2.5 w-2.5" />
            {title}
          </Badge>
        </motion.div>
      )}
      {department && (
        <motion.div
          variants={{
            hidden: { scale: 0.8, opacity: 0 },
            visible: { scale: 1, opacity: 1 },
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Badge
            variant="outline"
            className="border-white/[0.08] bg-white/[0.02] text-white/35 text-[10px]"
          >
            {department}
          </Badge>
        </motion.div>
      )}
    </motion.div>
  )
}
