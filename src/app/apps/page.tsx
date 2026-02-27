'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Package, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Sidebar } from '@/components/Sidebar'
import { AppCard } from '@/components/apps/AppCard'
import { AppConfigModal } from '@/components/apps/AppConfigModal'
import { AppActionsDrawer } from '@/components/apps/AppActionsDrawer'
import { motion } from 'motion/react'
import { staggerContainer, staggerItem, pageVariants } from '@/lib/animations'
import { apiFetch } from '@/lib/api'
import { APP_CATALOG, TOTAL_ACTIONS, CONFIGURABLE_SLUGS } from '@/data/apps'

export default function AppsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [backendApps, setBackendApps] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [configApp, setConfigApp] = useState<any>(null)
  const [drawerApp, setDrawerApp] = useState<{ id: number; name: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
    if (status === 'authenticated') fetchApps()
  }, [status])

  async function fetchApps() {
    try {
      const res = await apiFetch('/api/apps')
      if (res.ok) setBackendApps(await res.json())
    } catch {
      // Backend down — still show all apps as unconfigured
    }
  }

  // Merge static catalog with dynamic config status from backend
  const apps = useMemo(() => {
    const backendBySlug = Object.fromEntries(
      backendApps.map((a: any) => [a.slug, a]),
    )
    return APP_CATALOG.map((def) => {
      const backend = backendBySlug[def.slug]
      return {
        id: backend?.id ?? 0,
        name: def.name,
        slug: def.slug,
        description: def.description,
        icon: def.icon,
        logoUrl: def.logoUrl,
        category: def.category,
        isConfigured: backend?.isConfigured ?? false,
        comingSoon: !CONFIGURABLE_SLUGS.has(def.slug),
        _count: { actions: def.actions.length },
      }
    })
  }, [backendApps])

  const filtered = apps.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description?.toLowerCase().includes(search.toLowerCase()) ||
      a.category?.toLowerCase().includes(search.toLowerCase()),
  )

  // Compute stats
  const totalApps = APP_CATALOG.length
  const configuredApps = apps.filter((a) => a.isConfigured).length
  const totalActions = TOTAL_ACTIONS
  const inUseActions = apps.filter((a) => a.isConfigured).reduce((sum, a) => sum + (a._count?.actions || 0), 0)

  const user = session?.user as any

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-white/30 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-black">
      <Sidebar
        userName={user?.name}
        userEmail={user?.email}
        userTitle={user?.title}
        userDepartment={user?.department}
        currentSessionId={null}
        onNewChat={() => router.push('/chat')}
        onSelectSession={(id) => router.push('/chat')}
      />
      <motion.div
        className="flex-1 overflow-auto"
        variants={pageVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="mx-auto max-w-7xl p-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <Package className="h-6 w-6 text-logo-blue" />
              <h1 className="text-2xl font-bold text-white/85">Applications</h1>
            </div>
            <p className="text-sm text-white/40">
              Configure app connections to enable actions for your AI agents
            </p>
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.3 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-6"
          >
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              <StatItem label="Available Applications" value={totalApps} />
              <StatItem label="Configured Applications" value={configuredApps} accent />
              <StatItem label="Available Actions" value={totalActions} />
              <StatItem label="In Use Actions" value={inUseActions} accent />
              <StatItem label="Custom Actions" value={0} />
              <StatItem label="In Use Custom Actions" value={0} />
            </div>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.3 }}
            className="relative mb-6"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-logo-blue/40" />
            <Input
              placeholder="Search apps..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/[0.02] border-white/[0.06] text-white/80 placeholder:text-white/20 focus:border-logo-blue/30 transition-colors"
            />
          </motion.div>

          {/* Grid — 5 columns */}
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {filtered.map((app) => (
              <motion.div key={app.slug} variants={staggerItem}>
                <AppCard
                  app={app}
                  onConfigure={() => setConfigApp(app)}
                  onViewActions={() => setDrawerApp({ id: app.id, name: app.name })}
                />
              </motion.div>
            ))}
          </motion.div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-white/25 text-sm">
              No apps found
            </div>
          )}
        </div>
      </motion.div>

      <AppConfigModal
        app={configApp}
        open={!!configApp}
        onClose={() => setConfigApp(null)}
        onSaved={fetchApps}
      />

      <AppActionsDrawer
        appId={drawerApp?.id || null}
        appName={drawerApp?.name || ''}
        open={!!drawerApp}
        onClose={() => setDrawerApp(null)}
      />
    </div>
  )
}

function StatItem({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-semibold ${accent ? 'text-logo-blue' : 'text-white/70'}`}>
        {value}
      </div>
      <div className="text-[10px] text-white/30 leading-tight">{label}</div>
    </div>
  )
}
