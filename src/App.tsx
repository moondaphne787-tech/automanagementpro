import { HashRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppLayout } from '@/components/Layout/AppLayout'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DashboardPage } from '@/pages/DashboardPage'
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
import { PreferenceManage } from '@/pages/PreferenceManage'
import { ReadingCheckin } from '@/pages/ReadingCheckin'
import { BatchGenerate } from '@/pages/BatchGenerate'
import { BatchImport } from '@/pages/BatchImport'
import { BatchExport } from '@/pages/BatchExport'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/students" element={<Home />} />
          <Route path="/students/new" element={<StudentNew />} />
          <Route path="/students/:id" element={<StudentDetail />} />
          <Route path="/trial" element={<TrialList />} />
          <Route path="/trial/conversions" element={<TrialConversions />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/preferences" element={<PreferenceManage />} />
          <Route path="/teachers" element={<TeacherList />} />
          <Route path="/teachers/:id" element={<TeacherDetail />} />
          <Route path="/phases" element={<PhasesPage />} />
          <Route path="/reading-checkin" element={<ReadingCheckin />} />
          <Route path="/settings" element={<Settings />} />
          {/* 批量操作全页面 */}
          <Route path="/batch/generate" element={<BatchGenerate />} />
          <Route path="/batch/import" element={<BatchImport />} />
          <Route path="/batch/export" element={<BatchExport />} />
        </Route>
      </Routes>

      <Toaster position="top-center" richColors />
      <ConfirmDialog />
    </HashRouter>
  )
}

export default App
