import { type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DrawerShellProps {
  open: boolean
  fullPage?: boolean
  title: string
  icon?: ReactNode
  width?: string
  onClose: () => void
  children: ReactNode
}

export function DrawerShell({ fullPage, open, title, icon, width = 'w-[700px]', onClose, children }: DrawerShellProps) {
  if (fullPage) {
    if (!open) return null
    return <div className="flex flex-col h-full">{children}</div>
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed right-0 top-0 h-full ${width} bg-background border-l shadow-xl z-50 flex flex-col`}
          >
            <div className="h-16 border-b flex items-center justify-between px-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                {icon}{title}
              </h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
