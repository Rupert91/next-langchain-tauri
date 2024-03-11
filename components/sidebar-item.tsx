'use client'

import * as React from 'react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { motion } from 'framer-motion'

import { buttonVariants } from '@/components/ui/button'

import { cn } from '@/lib/utils'
import { Chat } from '@/lib/types'

interface SidebarItemProps {
  index: number
  chat: Chat
  children: React.ReactNode
}

export function SidebarItem({ index, chat, children }: SidebarItemProps) {
  const pathname = usePathname()

  const isActive = pathname === chat.id

  const shouldAnimate = index === 0 && isActive 

  if (!chat) return null

  return (
    <motion.div
      className="relative h-8"
      variants={{
        initial: {
          height: 0,
          opacity: 0
        },
        animate: {
          height: 'auto',
          opacity: 1
        }
      }}
      initial={shouldAnimate ? 'initial' : undefined}
      animate={shouldAnimate ? 'animate' : undefined}
      transition={{
        duration: 0.25,
        ease: 'easeIn'
      }}
    >

      <Link
        href={`/?cid=${chat.id}`}
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          'group w-full px-8 transition-colors hover:bg-zinc-200/40 dark:hover:bg-zinc-300/10',
          isActive && 'bg-zinc-200 pr-16 font-semibold dark:bg-zinc-800'
        )}
      >
        <div
          className="relative max-h-5 flex-1 select-none overflow-hidden text-ellipsis break-all"
        >
          {chat.messages[0].content.slice(0, 30)}
        </div>
      </Link>
      <div className="absolute right-2 top-1">{children}</div>
    </motion.div>
  )
}
