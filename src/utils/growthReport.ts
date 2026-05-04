import type { Student, ClassRecord, StudentWordbankProgress, Wordbank } from '@/types'
import type { GrowthNote } from '@/db/growthNotes'

const CATEGORY_LABELS: Record<string, string> = {
  semester_summary: '学期总结',
  attitude: '学习态度观察',
  parent_comm: '家长沟通记录',
  highlight: '特别亮点',
}

export function generateGrowthReportHTML(params: {
  student: Student
  classRecords: ClassRecord[]
  progress: StudentWordbankProgress[]
  wordbanks: Wordbank[]
  notes: GrowthNote[]
  dateRange?: { start: string; end: string }
}): string {
  const { student, progress, wordbanks, notes } = params

  const filteredRecords = params.dateRange
    ? params.classRecords.filter(r => r.class_date >= params.dateRange!.start && r.class_date <= params.dateRange!.end)
    : params.classRecords

  const totalClasses = filteredRecords.length
  const totalHours = filteredRecords.reduce((sum, r) => sum + r.duration_hours, 0)
  const attendanceRate = totalClasses > 0
    ? Math.round((filteredRecords.filter(r => r.attendance === 'present').length / totalClasses) * 100)
    : 0

  const progressHtml = progress.map(p => {
    const bank = wordbanks.find(w => w.id === p.wordbank_id)
    const total = p.total_levels_override || bank?.total_levels || 60
    return `<div class="progress-item"><span class="label">${p.wordbank_label}</span><span class="value">${p.current_level}/${total}</span></div>`
  }).join('')

  const notesHtml = notes.map(n => `
    <div class="note-item">
      <div class="note-header">
        <span class="note-date">${n.note_date}</span>
        <span class="note-category">${CATEGORY_LABELS[n.category] || n.category}</span>
      </div>
      <p class="note-content">${n.content}</p>
    </div>
  `).join('')

  const monthlyMap = new Map<string, number>()
  filteredRecords.forEach(r => {
    const month = r.class_date.substring(0, 7)
    monthlyMap.set(month, (monthlyMap.get(month) || 0) + 1)
  })
  const monthlyHtml = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => `<div class="month-row"><span>${month}</span><span>${count} 节课</span></div>`)
    .join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${student.name} 成长报告</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;font-size:14px;line-height:1.6;color:#333;max-width:800px;margin:0 auto;padding:40px 20px}
h1{font-size:24px;margin-bottom:4px}
.subtitle{color:#888;margin-bottom:24px}
.section{margin-bottom:24px}
.section-title{font-size:16px;font-weight:600;border-bottom:2px solid #4f46e5;padding-bottom:4px;margin-bottom:12px;color:#4f46e5}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px}
.info-grid .label{color:#888}
.progress-item{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #eee;font-size:13px}
.note-item{background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:8px}
.note-header{display:flex;justify-content:space-between;margin-bottom:6px}
.note-date{color:#888;font-size:12px}
.note-category{font-size:12px;background:#e0e7ff;color:#4f46e5;padding:1px 6px;border-radius:4px}
.note-content{font-size:13px}
.month-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
.stat-row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px}
.stat-card{flex:1;min-width:120px;background:#f0f9ff;border-radius:8px;padding:12px;text-align:center}
.stat-card .num{font-size:24px;font-weight:700;color:#4f46e5}
.stat-card .lbl{font-size:12px;color:#888;margin-top:2px}
@media print{body{padding:0}@page{margin:15mm}}
</style></head><body>
  <h1>${student.name}</h1>
  <div class="subtitle">${student.grade || ''}${student.school ? ' · ' + student.school : ''}</div>

  <div class="section">
    <div class="section-title">学员概况</div>
    <div class="info-grid">
      <span class="label">入学日期</span><span>${student.enroll_date || '-'}</span>
      <span class="label">学习程度</span><span>${student.level === 'weak' ? '基础薄弱' : student.level === 'medium' ? '基础较好' : '非常优秀'}</span>
      ${student.learning_target ? `<span class="label">学习目标</span><span>${student.learning_target}</span>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">课堂表现统计</div>
    <div class="stat-row">
      <div class="stat-card"><div class="num">${totalClasses}</div><div class="lbl">总课次</div></div>
      <div class="stat-card"><div class="num">${totalHours.toFixed(1)}</div><div class="lbl">总课时(h)</div></div>
      <div class="stat-card"><div class="num">${attendanceRate}%</div><div class="lbl">出勤率</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">月度上课统计</div>
    ${monthlyHtml || '<div style="color:#888;font-size:13px">暂无数据</div>'}
  </div>

  ${progress.length > 0 ? `<div class="section"><div class="section-title">词库进展</div>${progressHtml}</div>` : ''}

  ${student.phonics_completed || student.ipa_completed ? `<div class="section"><div class="section-title">语音里程碑</div>${student.phonics_completed ? '<div class="progress-item">🔤 已完成自然拼读学习</div>' : ''}${student.ipa_completed ? '<div class="progress-item">🎵 已完成国际音标学习</div>' : ''}</div>` : ''}

  ${student.reading_progress ? `<div class="section"><div class="section-title">阅读能力</div><div class="progress-item">📖 当前进度：${student.reading_progress}</div></div>` : ''}

  ${notes.length > 0 ? `<div class="section"><div class="section-title">教师评语</div>${notesHtml}</div>` : ''}

</body></html>`
}
