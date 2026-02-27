'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { APP_BY_SLUG } from '@/data/apps'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { motion } from 'motion/react'

interface AppConfigModalProps {
  app: { id: number; name: string; slug: string } | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function AppConfigModal({ app, open, onClose, onSaved }: AppConfigModalProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fields = app ? APP_BY_SLUG[app.slug]?.credentialFields || [] : []

  async function handleSave() {
    if (!app) return
    setSaving(true)
    setError('')

    try {
      const res = await apiFetch(`/api/apps/slug/${app.slug}/credentials`, {
        method: 'POST',
        body: JSON.stringify(values),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save credentials')
      }

      setValues({})
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-neutral-950 border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white/90">
            Configure {app?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {fields.map((field, i) => (
            <motion.div
              key={field.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              className="space-y-1.5"
            >
              <Label className="text-xs text-white/60">{field.label}</Label>
              <Input
                type={field.type || 'text'}
                placeholder={field.placeholder}
                value={values[field.key] || ''}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.key]: e.target.value }))
                }
                className="bg-white/[0.04] border-white/10 text-white/80 placeholder:text-white/20 focus:border-logo-blue/30 transition-colors"
              />
            </motion.div>
          ))}

          {error && (
            <motion.p
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs text-red-400"
            >
              {error}
            </motion.p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-white/50 hover:text-white/80 hover:bg-white/[0.06] cursor-pointer"
          >
            Cancel
          </Button>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-logo-blue hover:bg-logo-blue/80 text-black font-medium cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Credentials'}
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
