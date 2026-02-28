'use client'

import { useState, useRef, useCallback } from 'react'
import { Send, Paperclip, X, FileText, Loader2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { motion, AnimatePresence } from 'motion/react'
import { getSession } from 'next-auth/react'
import type { FileAttachment } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface ChatInputProps {
  onSend: (message: string, fileAttachment?: FileAttachment) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [fileAttachment, setFileAttachment] = useState<FileAttachment | null>(null)
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = message.trim()
    if ((!trimmed && !fileAttachment) || disabled || uploading) return
    onSend(trimmed || 'Here is the attached document.', fileAttachment || undefined)
    setMessage('')
    setFileAttachment(null)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [message, disabled, uploading, onSend, fileAttachment])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const session = await getSession()
      const token = (session as any)?.jwtToken || (session as any)?.accessToken

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API_URL}/api/chat/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      if (!res.ok) throw new Error('Upload failed')

      const data = await res.json()
      setFileAttachment({
        s3_bucket: data.s3_bucket,
        s3_key: data.s3_key,
        filename: data.filename,
      })
    } catch (err) {
      console.error('File upload error:', err)
    } finally {
      setUploading(false)
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [])

  const removeFile = useCallback(() => {
    setFileAttachment(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  return (
    <div className="flex flex-col gap-2">
      {/* File attachment badge */}
      <AnimatePresence>
        {(fileAttachment || uploading) && (
          <motion.div
            initial={{ opacity: 0, y: 4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 4, height: 0 }}
            className="flex items-center gap-2"
          >
            <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/60">
              {uploading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-logo-blue/60" />
                  <span>Uploading...</span>
                </>
              ) : fileAttachment ? (
                <>
                  <FileText className="h-3 w-3 text-logo-blue/60" />
                  <span className="max-w-[200px] truncate">{fileAttachment.filename}</span>
                  <button
                    onClick={removeFile}
                    className="ml-1 rounded p-0.5 hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <X className="h-3 w-3 text-white/40 hover:text-white/70" />
                  </button>
                </>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <div className="flex items-end gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-all duration-200 focus-glow">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Paperclip button */}
        <motion.button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors disabled:opacity-20 cursor-pointer"
        >
          <Paperclip className="h-3.5 w-3.5" />
        </motion.button>

        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Ask about policies, procedures, holidays..."
          className="min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent px-1 py-1 text-sm text-white/85 placeholder:text-white/25 focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{ transition: 'height 0.15s ease' }}
          disabled={disabled}
          rows={1}
        />
        <motion.button
          onClick={handleSend}
          disabled={(!message.trim() && !fileAttachment) || disabled || uploading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-logo-blue text-black transition-opacity disabled:opacity-20 cursor-pointer"
        >
          <Send className="h-3.5 w-3.5" />
        </motion.button>
      </div>
    </div>
  )
}
