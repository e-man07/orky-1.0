'use client'

import { useState, useRef, useCallback } from 'react'
import { Send } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { motion } from 'motion/react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = message.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setMessage('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [message, disabled, onSend])

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

  return (
    <div className="flex items-end gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-all duration-200 focus-glow">
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
        disabled={!message.trim() || disabled}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-logo-blue text-black transition-opacity disabled:opacity-20 cursor-pointer"
      >
        <Send className="h-3.5 w-3.5" />
      </motion.button>
    </div>
  )
}
