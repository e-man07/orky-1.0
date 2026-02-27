'use client'

import { useState, useEffect } from 'react'
import { Save, Bot } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ActionPicker } from './ActionPicker'
import { motion } from 'motion/react'
import { apiFetch } from '@/lib/api'
import { actionKey } from '@/data/apps'

interface AgentFormProps {
  agent: any | null
  onSaved: () => void
}

export function AgentForm({ agent, onSaved }: AgentFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [role, setRole] = useState('')
  const [steps, setSteps] = useState('')
  const [model, setModel] = useState('gemini-2.0-flash')
  const [status, setStatus] = useState('active')
  const [actionKeys, setActionKeys] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (agent) {
      setName(agent.name || '')
      setDescription(agent.description || '')
      setRole(agent.role || '')
      setSteps(agent.steps || '')
      setModel(agent.model || 'gemini-2.0-flash')
      setStatus(agent.status || 'active')
      // Convert backend action objects to string keys
      const keys = (agent.actions || [])
        .map((a: any) => {
          const act = a.action
          if (act?.app?.slug && act?.name) {
            return actionKey(act.app.slug, act.name)
          }
          return null
        })
        .filter(Boolean) as string[]
      setActionKeys(keys)
    } else {
      setName('')
      setDescription('')
      setRole('')
      setSteps('')
      setModel('gemini-2.0-flash')
      setStatus('active')
      setActionKeys([])
    }
  }, [agent])

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError('')

    try {
      const body = { name, description, role, steps, model, status, actionKeys }
      const url = agent ? `/api/agents/${agent.id}` : '/api/agents'
      const method = agent ? 'PATCH' : 'POST'

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(body),
      })

      if (res.ok) {
        onSaved()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.detail || data.error || `Failed to save (${res.status})`)
      }
    } catch (e: any) {
      setError(e.message || 'Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-logo-blue" />
          <h2 className="text-lg font-semibold text-white/90">
            {agent ? 'Edit Agent' : 'New Agent'}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-xs text-red-400">{error}</span>
          )}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="bg-logo-blue hover:bg-logo-blue/80 text-black font-medium h-8 text-xs cursor-pointer"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Name */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="space-y-1.5"
      >
        <Label className="text-xs text-white/60">Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Ticket Handler"
          className="bg-white/[0.04] border-white/10 text-white/80 placeholder:text-white/20 focus:border-logo-blue/30 transition-colors"
        />
      </motion.div>

      {/* Description */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.11 }}
        className="space-y-1.5"
      >
        <Label className="text-xs text-white/60">Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this agent do?"
          rows={2}
          className="bg-white/[0.04] border-white/10 text-white/80 placeholder:text-white/20 resize-none focus:border-logo-blue/30 transition-colors"
        />
      </motion.div>

      {/* Agent Role */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="space-y-1.5"
      >
        <Label className="text-xs text-white/60">Agent Role (System Prompt)</Label>
        <Textarea
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="You are an IT support agent that creates and manages ServiceNow incidents..."
          rows={3}
          className="bg-white/[0.04] border-white/10 text-white/80 placeholder:text-white/20 resize-none text-xs focus:border-logo-blue/30 transition-colors"
        />
      </motion.div>

      {/* Steps */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.17 }}
        className="space-y-1.5"
      >
        <Label className="text-xs text-white/60">Steps (Instructions)</Label>
        <Textarea
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          placeholder={"1. Analyze the user request\n2. Create an incident ticket\n3. Notify the team via Slack"}
          rows={3}
          className="bg-white/[0.04] border-white/10 text-white/80 placeholder:text-white/20 resize-none text-xs focus:border-logo-blue/30 transition-colors"
        />
      </motion.div>

      {/* Model + Status row */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-4"
      >
        <div className="space-y-1.5">
          <Label className="text-xs text-white/60">Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="bg-white/[0.04] border-white/10 text-white/80 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-950 border-white/10">
              <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
              <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
              <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-white/60">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-white/[0.04] border-white/10 text-white/80 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-950 border-white/10">
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.23 }}
        className="space-y-1.5"
      >
        <Label className="text-xs text-white/60">
          App Actions ({actionKeys.length} selected)
        </Label>
        <div className="max-h-96 overflow-auto rounded-lg border border-white/[0.06] p-2">
          <ActionPicker selectedKeys={actionKeys} onChange={setActionKeys} />
        </div>
      </motion.div>
    </motion.div>
  )
}
