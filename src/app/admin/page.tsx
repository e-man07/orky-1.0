'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import {
  Database,
  Cloud,
  FileSpreadsheet,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { staggerContainer, staggerItem } from '@/lib/animations'

interface SyncResult {
  status: 'idle' | 'running' | 'success' | 'error'
  message?: string
  details?: Record<string, any>
}

export default function AdminPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [excelSync, setExcelSync] = useState<SyncResult>({ status: 'idle' })
  const [snSync, setSnSync] = useState<SyncResult>({ status: 'idle' })
  const [spSync, setSpSync] = useState<SyncResult>({ status: 'idle' })

  const user = session?.user as any

  async function runSync(
    endpoint: string,
    setter: (r: SyncResult) => void
  ) {
    setter({ status: 'running' })
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setter({
          status: 'success',
          message: 'Sync completed successfully',
          details: data,
        })
      } else {
        setter({
          status: 'error',
          message: data.error || 'Sync failed',
          details: data,
        })
      }
    } catch (error) {
      setter({
        status: 'error',
        message: error instanceof Error ? error.message : 'Network error',
      })
    }
  }

  function StatusIcon({ status }: { status: SyncResult['status'] }) {
    return (
      <AnimatePresence mode="wait">
        {status === 'running' && (
          <motion.div
            key="running"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Loader2 className="h-4 w-4 animate-spin text-logo-blue" />
          </motion.div>
        )}
        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Check className="h-4 w-4 text-green-500" />
          </motion.div>
        )}
        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <AlertCircle className="h-4 w-4 text-red-400" />
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  const syncCards = [
    {
      title: 'Excel Import',
      description:
        'Import knowledge articles from kb_knowledge.xlsx. Generates chunks and embeddings.',
      icon: FileSpreadsheet,
      state: excelSync,
      onClick: () => runSync('/api/sync/excel', setExcelSync),
    },
    {
      title: 'ServiceNow Sync',
      description:
        'Sync users, roles, criteria, and KB articles from ServiceNow instance.',
      icon: Database,
      state: snSync,
      onClick: () => runSync('/api/sync/servicenow', setSnSync),
    },
    {
      title: 'SharePoint Sync',
      description:
        'Sync documents from SharePoint Knowledge Base site via Graph API.',
      icon: Cloud,
      state: spSync,
      onClick: () => runSync('/api/sync/sharepoint', setSpSync),
    },
  ]

  return (
    <div className="flex h-screen bg-black">
      <Sidebar
        userName={user?.name}
        userEmail={user?.email}
        userTitle={user?.title}
        userDepartment={user?.department}
        currentSessionId={null}
        onNewChat={() => router.push('/chat')}
        onSelectSession={() => {}}
      />

      <div className="flex flex-1 flex-col">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex h-14 items-center border-b border-white/[0.06] px-6"
        >
          <span className="text-sm font-medium text-white/80">
            Admin - Data Sync
          </span>
        </motion.div>

        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-6"
            >
              <h1 className="text-xl font-semibold text-white/90">
                Data Synchronization
              </h1>
              <p className="mt-1 text-sm text-white/40">
                Import and sync knowledge articles from different sources.
                Articles are automatically chunked and embedded for RAG search.
              </p>
            </motion.div>

            <motion.div
              className="grid gap-4"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {syncCards.map((card) => (
                <motion.div key={card.title} variants={staggerItem}>
                  <Card className="border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03] transition-colors duration-200">
                    <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                        <card.icon className="h-5 w-5 text-white/40" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-sm text-white/80">
                          {card.title}
                        </CardTitle>
                        <CardDescription className="text-xs text-white/40">
                          {card.description}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button
                            onClick={card.onClick}
                            disabled={card.state.status === 'running'}
                            size="sm"
                            className="bg-white/10 text-white/80 hover:bg-white/15 cursor-pointer"
                          >
                            {card.state.status === 'running'
                              ? 'Syncing...'
                              : 'Run Sync'}
                          </Button>
                        </motion.div>
                        <StatusIcon status={card.state.status} />
                        <AnimatePresence>
                          {card.state.message && (
                            <motion.span
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0 }}
                              className={`text-xs ${
                                card.state.status === 'error'
                                  ? 'text-red-400'
                                  : 'text-white/50'
                              }`}
                            >
                              {card.state.message}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                      <AnimatePresence>
                        {card.state.details && card.state.status === 'success' && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 rounded-md bg-white/[0.03] p-3 text-xs text-white/40">
                              <pre>
                                {JSON.stringify(card.state.details, null, 2)}
                              </pre>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
