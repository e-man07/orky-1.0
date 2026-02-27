'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  MessageSquarePlus,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  LogOut,
  BookOpen,
  Settings,
  Package,
  Bot,
  GitBranch,
} from 'lucide-react'
import { motion, AnimatePresence, LayoutGroup } from 'motion/react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { UserBadge } from './UserBadge'

interface ChatHistoryItem {
  id: number
  title: string
  createdAt: string
}

interface SidebarProps {
  userName?: string | null
  userEmail?: string | null
  userTitle?: string | null
  userDepartment?: string | null
  currentSessionId?: number | null
  onNewChat: () => void
  onSelectSession: (sessionId: number) => void
}

export function Sidebar({
  userName,
  userEmail,
  userTitle,
  userDepartment,
  currentSessionId,
  onNewChat,
  onSelectSession,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    fetchChatHistory()
  }, [currentSessionId])

  async function fetchChatHistory() {
    try {
      const { apiFetch } = await import('@/lib/api')
      const res = await apiFetch('/api/chat/sessions')
      if (res.ok) {
        const data = await res.json()
        setChatHistory(data)
      }
    } catch {
      // Ignore
    }
  }

  const initials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
    : '?'

  const navItems = [
    { label: 'New Chat', icon: MessageSquarePlus, onClick: onNewChat, href: '' },
    { label: 'Chat', icon: BookOpen, onClick: () => router.push('/chat'), href: '/chat' },
    { label: 'Admin', icon: Database, onClick: () => router.push('/admin'), href: '/admin' },
    { label: 'Apps', icon: Package, onClick: () => router.push('/apps'), href: '/apps' },
    { label: 'Agents', icon: Bot, onClick: () => router.push('/agents'), href: '/agents' },
    { label: 'Workflows', icon: GitBranch, onClick: () => router.push('/workflows'), href: '/workflows' },
  ]

  return (
    <motion.div
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ type: 'spring', stiffness: 220, damping: 28 }}
      className="flex h-screen flex-col border-r border-white/[0.06] bg-black overflow-hidden"
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xl font-bold text-logo-blue shrink-0">ORKY</span>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="text-xs text-white/30 overflow-hidden whitespace-nowrap"
              >
                KB
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <motion.button
          onClick={() => setCollapsed(!collapsed)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="rounded-md p-1.5 text-white/30 hover:bg-white/[0.05] hover:text-white/50 shrink-0"
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.div>
        </motion.button>
      </div>

      {/* Separator */}
      <div className="mx-3 h-px bg-white/[0.06] shrink-0" />

      {/* Nav items */}
      <LayoutGroup>
        <motion.div
          className="flex flex-col gap-0.5 p-2 shrink-0"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
          }}
        >
          {navItems.map((item) => {
            const isActive = item.href && pathname === item.href
            return (
              <motion.button
                key={item.label}
                variants={{
                  hidden: { opacity: 0, x: -8 },
                  visible: { opacity: 1, x: 0 },
                }}
                onClick={item.onClick}
                whileHover={{ x: 2 }}
                transition={{ duration: 0.15 }}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer ${
                  isActive
                    ? 'text-logo-blue'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-white/[0.06]"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <item.icon className="relative z-10 h-4 w-4 shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="relative z-10 overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )
          })}
        </motion.div>
      </LayoutGroup>

      {/* Separator */}
      <div className="mx-3 h-px bg-white/[0.06] shrink-0" />

      {/* Chat history */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 min-h-0"
          >
            <ScrollArea className="h-full px-2 py-3">
              <div className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-white/20">
                Recent Chats
              </div>
              <motion.div
                className="flex flex-col gap-0.5"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.03 } },
                }}
              >
                {chatHistory.map((chat) => (
                  <motion.button
                    key={chat.id}
                    variants={{
                      hidden: { opacity: 0, y: 4 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    onClick={() => onSelectSession(chat.id)}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                      currentSessionId === chat.id
                        ? 'bg-white/[0.06] text-white/70'
                        : 'text-white/30 hover:bg-white/[0.03] hover:text-white/50'
                    }`}
                  >
                    <MessageSquare className="h-3 w-3 shrink-0" />
                    <span className="truncate">{chat.title}</span>
                  </motion.button>
                ))}
                {chatHistory.length === 0 && (
                  <div className="px-2 py-4 text-center text-[11px] text-white/15">
                    No conversations yet
                  </div>
                )}
              </motion.div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User profile — glass style */}
      <div className="mt-auto shrink-0">
        <div className="mx-2 mb-2 h-px bg-white/[0.04]" />
        <div className="p-2">
          <div className="flex items-center gap-3 rounded-lg glass-subtle px-3 py-2.5">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-logo-blue/10 text-logo-blue/70 text-[10px] font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden"
                >
                  <span className="truncate text-xs text-white/70">
                    {userName || 'User'}
                  </span>
                  <UserBadge
                    title={userTitle}
                    department={userDepartment}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => signOut({ callbackUrl: '/' })}
              className="rounded-md p-1 text-white/20 hover:bg-white/[0.05] hover:text-white/40 shrink-0"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
