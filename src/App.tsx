import { useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/Layout/AppLayout'
import { ImportRecordsDrawer } from '@/components/Drawers/ImportRecordsDrawer'
import { GeneratePlansDrawer } from '@/components/Drawers/GeneratePlansDrawer'
import { PrintPlansDrawer } from '@/components/Drawers/PrintPlansDrawer'
import { Home } from '@/pages/Home'
import { StudentNew } from '@/pages/StudentNew'
import { StudentDetail } from '@/pages/StudentDetail'
import { Settings } from '@/pages/Settings'
import { TrialList } from '@/pages/TrialList'
import { TrialConversions } from '@/pages/TrialConversions'
import { TeacherList } from '@/pages/TeacherList'
import { TeacherDetail } from '@/pages/TeacherDetail'
import { Schedule } from '@/pages/Schedule'
import { PhasesPage } from '@/pages/PhasesPage'

function App() {
  const [importDrawerOpen, setImportDrawerOpen] = useState(false)
  const [generateDrawerOpen, setGenerateDrawerOpen] = useState(false)
  const [printDrawerOpen, setPrintDrawerOpen] = useState(false)
  
  // 处理快捷操作
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'import':
        setImportDrawerOpen(true)
        break
      case 'generate':
        setGenerateDrawerOpen(true)
        break
      case 'print':
        setPrintDrawerOpen(true)
        break
    }
  }
  
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout onQuickAction={handleQuickAction} />}>
          <Route path="/" element={<Home />} />
          <Route path="/students/new" element={<StudentNew />} />
          <Route path="/students/:id" element={<StudentDetail />} />
          <Route path="/trial" element={<TrialList />} />
          <Route path="/trial/conversions" element={<TrialConversions />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/teachers" element={<TeacherList />} />
          <Route path="/teachers/:id" element={<TeacherDetail />} />
          <Route path="/phases" element={<PhasesPage />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
      
      {/* 抽屉组件 */}
      <ImportRecordsDrawer 
        open={importDrawerOpen} 
        onClose={() => setImportDrawerOpen(false)} 
      />
      
      {/* 批量生成课程计划抽屉 */}
      <GeneratePlansDrawer 
        open={generateDrawerOpen} 
        onClose={() => setGenerateDrawerOpen(false)} 
      />
      
      {/* 批量打印课程计划抽屉 */}
      <PrintPlansDrawer 
        open={printDrawerOpen} 
        onClose={() => setPrintDrawerOpen(false)} 
      />
    </HashRouter>
  )
}

export default App