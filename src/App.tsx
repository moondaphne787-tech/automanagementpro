import { useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/Layout/AppLayout'
import { ImportRecordsDrawer } from '@/components/Drawers/ImportRecordsDrawer'
import { Home } from '@/pages/Home'
import { StudentNew } from '@/pages/StudentNew'
import { StudentDetail } from '@/pages/StudentDetail'
import { Settings } from '@/pages/Settings'

// 占位页面组件
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="h-full flex flex-col">
      <header className="h-16 border-b bg-card flex items-center px-6">
        <h1 className="text-lg font-semibold">{title}</h1>
      </header>
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        此功能将在后续版本中实现
      </div>
    </div>
  )
}

function App() {
  const [importDrawerOpen, setImportDrawerOpen] = useState(false)
  // Phase 3: 批量生成课程计划抽屉
  // const [generateDrawerOpen, setGenerateDrawerOpen] = useState(false)
  
  // 处理快捷操作
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'import':
        setImportDrawerOpen(true)
        break
      // Phase 3: 取消注释以启用生成课程计划功能
      // case 'generate':
      //   setGenerateDrawerOpen(true)
      //   break
    }
  }
  
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout onQuickAction={handleQuickAction} />}>
          <Route path="/" element={<Home />} />
          <Route path="/students/new" element={<StudentNew />} />
          <Route path="/students/:id" element={<StudentDetail />} />
          <Route path="/trial" element={<PlaceholderPage title="体验生" />} />
          <Route path="/schedule" element={<PlaceholderPage title="排课" />} />
          <Route path="/teachers" element={<PlaceholderPage title="助教" />} />
          <Route path="/phases" element={<PlaceholderPage title="学习阶段" />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
      
      {/* 抽屉组件 */}
      <ImportRecordsDrawer 
        open={importDrawerOpen} 
        onClose={() => setImportDrawerOpen(false)} 
      />
      
      {/* 批量生成课程计划抽屉 - Phase 3 实现 */}
      {/* <GeneratePlansDrawer 
        open={generateDrawerOpen} 
        onClose={() => setGenerateDrawerOpen(false)} 
      /> */}
    </HashRouter>
  )
}

export default App