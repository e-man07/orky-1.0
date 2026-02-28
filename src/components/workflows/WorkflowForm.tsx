'use client'

import { useState, useEffect } from 'react'
import { Save, GitBranch, Plus, Play, Wand2, Loader2 } from 'lucide-react'
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
import { AgentPicker } from './AgentPicker'
import { AgentStepList, type AgentStep } from './AgentStepList'
import { motion } from 'motion/react'
import { apiFetch } from '@/lib/api'

interface WorkflowFormProps {
  workflow: any | null
  onSaved: () => void
  onExecute: (workflowId: number) => void
}

export function WorkflowForm({ workflow, onSaved, onExecute }: WorkflowFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [status, setStatus] = useState('draft')
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  useEffect(() => {
    if (workflow) {
      setName(workflow.name || '')
      setDescription(workflow.description || '')
      setSteps(workflow.steps || '')
      setStatus(workflow.status || 'draft')
      setAgentSteps(
        (workflow.agents || []).map((wa: any) => ({
          agentId: wa.agent?.id || wa.agentId,
          name: wa.agent?.name || 'Unknown',
          color: wa.agent?.color || null,
          taskPrompt: wa.taskPrompt || '',
        })),
      )
    } else {
      setName('')
      setDescription('')
      setSteps('')
      setStatus('draft')
      setAgentSteps([])
    }
  }, [workflow])

  async function handleGenerate() {
    if (!description.trim()) return
    setGenerating(true)
    setGenerateError('')

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 120000) // 2 min timeout for AI generation
      const res = await apiFetch('/api/workflows/generate', {
        method: 'POST',
        body: JSON.stringify({ description }),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Generation failed' }))
        setGenerateError(err.error || 'Failed to generate workflow')
        return
      }

      const plan = await res.json()

      // Auto-fill form fields
      if (plan.name) setName(plan.name)
      if (plan.steps) setSteps(plan.steps)
      if (plan.agents?.length) {
        setAgentSteps(
          plan.agents.map((a: any) => ({
            agentId: a.id,
            name: a.name,
            color: null,
            taskPrompt: a.taskPrompt || '',
          })),
        )
      }
    } catch (err: any) {
      setGenerateError(err.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)

    try {
      const body = {
        name,
        description,
        steps,
        status,
        triggerRoles: [],
        agents: agentSteps.map((s, i) => ({
          agentId: s.agentId,
          stepOrder: i + 1,
          taskPrompt: s.taskPrompt || null,
        })),
      }

      const url = workflow
        ? `/api/workflows/${workflow.id}`
        : '/api/workflows'
      const method = workflow ? 'PATCH' : 'POST'

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(body),
      })

      if (res.ok) onSaved()
    } finally {
      setSaving(false)
    }
  }

  function handleAddAgent(agent: {
    id: number
    name: string
    icon: string | null
    color: string | null
  }) {
    setAgentSteps([
      ...agentSteps,
      { agentId: agent.id, name: agent.name, color: agent.color, taskPrompt: '' },
    ])
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
          <GitBranch className="h-5 w-5 text-purple-400/70" />
          <h2 className="text-lg font-semibold text-white/90">
            {workflow ? 'Edit Workflow' : 'New Workflow'}
          </h2>
        </div>
        <div className="flex gap-2">
          {workflow && (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => onExecute(workflow.id)}
                variant="ghost"
                className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-8 text-xs cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Run
              </Button>
            </motion.div>
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
          placeholder="e.g., Incident Response Workflow"
          className="bg-white/[0.04] border-white/10 text-white/80 placeholder:text-white/20 focus:border-logo-blue/30 transition-colors"
        />
      </motion.div>

      {/* Description + Generate with AI */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.11 }}
        className="space-y-1.5"
      >
        <div className="flex items-center justify-between">
          <Label className="text-xs text-white/60">Description</Label>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handleGenerate}
              disabled={generating || !description.trim()}
              variant="ghost"
              size="sm"
              className="text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-7 cursor-pointer"
            >
              {generating ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3 mr-1" />
              )}
              {generating ? 'Generating...' : 'Generate with AI'}
            </Button>
          </motion.div>
        </div>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this workflow does, e.g. 'When a server goes down, create a ServiceNow incident, notify the team on Slack, and create a Jira ticket for the post-mortem'"
          rows={3}
          className="bg-white/[0.04] border-white/10 text-white/80 placeholder:text-white/20 resize-none focus:border-logo-blue/30 transition-colors"
        />
        {generating && (
          <div className="flex items-center gap-2 text-xs text-purple-400/70">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating workflow plan with AI...
          </div>
        )}
        {generateError && (
          <p className="text-xs text-red-400">{generateError}</p>
        )}
      </motion.div>

      {/* Steps */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="space-y-1.5"
      >
        <Label className="text-xs text-white/60">Steps (Workflow Instructions)</Label>
        <Textarea
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          placeholder={"1. Create incident ticket\n2. Notify team via Slack\n3. Assign to on-call engineer"}
          rows={3}
          className="bg-white/[0.04] border-white/10 text-white/80 placeholder:text-white/20 resize-none text-xs focus:border-logo-blue/30 transition-colors"
        />
      </motion.div>

      {/* Status */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.17 }}
        className="space-y-1.5"
      >
        <Label className="text-xs text-white/60">Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="bg-white/[0.04] border-white/10 text-white/80 h-9 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-neutral-950 border-white/10">
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* AI Agents */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-2"
      >
        <div className="flex items-center justify-between">
          <Label className="text-xs text-white/60">
            AI Agents ({agentSteps.length})
          </Label>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={() => setPickerOpen(true)}
              variant="ghost"
              size="sm"
              className="text-xs text-logo-blue hover:text-logo-blue/80 hover:bg-logo-blue/10 h-7 cursor-pointer"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Agent
            </Button>
          </motion.div>
        </div>

        <AgentStepList steps={agentSteps} onChange={setAgentSteps} />
      </motion.div>

      {/* Agent Picker Dialog */}
      <AgentPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAddAgent}
        excludeIds={agentSteps.map((s) => s.agentId)}
      />
    </motion.div>
  )
}
