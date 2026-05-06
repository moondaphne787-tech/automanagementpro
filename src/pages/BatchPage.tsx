import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Upload, Sparkles, FileDown, LayoutList } from 'lucide-react'
import { GeneratePlansDrawer } from '@/components/Drawers/GeneratePlansDrawer'
import { ImportRecordsDrawer } from '@/components/Drawers/ImportRecordsDrawer'
import { PrintPlansDrawer } from '@/components/Drawers/PrintPlansDrawer'
import { TabNav } from '@/components/ui/tab-nav'

type BatchTab = 'generate' | 'import' | 'export'

const TABS = [
  { key: 'generate' as const, label: '生成计划', icon: <Sparkles className="w-4 h-4" /> },
  { key: 'import' as const, label: '导入记录', icon: <Upload className="w-4 h-4" /> },
  { key: 'export' as const, label: '导出数据', icon: <FileDown className="w-4 h-4" /> },
]

const TAB_BY_PATH: Record<string, BatchTab> = {
  '/batch/generate': 'generate',
  '/batch/import': 'import',
  '/batch/export': 'export',
}

export function BatchPage() {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<BatchTab>(
    TAB_BY_PATH[location.pathname] || 'generate'
  )

  useEffect(() => {
    const tab = TAB_BY_PATH[location.pathname]
    if (tab) setActiveTab(tab)
  }, [location.pathname])

  return (
    <div className="h-full flex flex-col">
      <header className="h-16 border-b bg-card flex items-center gap-4 px-6">
        <LayoutList className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">批量操作</h1>
      </header>

      <div className="border-b bg-card px-6">
        <TabNav tabs={TABS} activeTab={activeTab} onChange={(key) => setActiveTab(key as BatchTab)} />
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'generate' && (
          <GeneratePlansDrawer fullPage />
        )}
        {activeTab === 'import' && (
          <ImportRecordsDrawer fullPage />
        )}
        {activeTab === 'export' && (
          <PrintPlansDrawer fullPage />
        )}
      </div>
    </div>
  )
}
