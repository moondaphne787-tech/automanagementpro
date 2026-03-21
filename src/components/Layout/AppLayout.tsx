import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

interface AppLayoutProps {
  onQuickAction?: (action: string) => void
}

export function AppLayout({ onQuickAction }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar onQuickAction={onQuickAction} />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}