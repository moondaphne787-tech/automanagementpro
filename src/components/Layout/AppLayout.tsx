import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { GlobalSearch } from '@/components/GlobalSearch/GlobalSearch'
import { Breadcrumb } from '@/components/ui/breadcrumb'

export function AppLayout() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Breadcrumb />
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
      <GlobalSearch />
    </div>
  )
}