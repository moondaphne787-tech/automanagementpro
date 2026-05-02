/**
 * 朗读打卡月度报表导出
 *
 * 复用 xlsx 库，与 excelExport.ts 一致的导出模式
 */

import * as XLSX from 'xlsx'
import type { CheckinStudent } from '@/store/types'

/**
 * 导出朗读打卡月度报表
 */
export async function exportReadingCheckinReport(
  year: number,
  month: number,
  students: CheckinStudent[]
): Promise<void> {
  const monthLabel = `${year}年${month}月`
  const filename = `朗读打卡月度报表_${year}${String(month).padStart(2, '0')}.xlsx`

  const data = students.map((s, i) => ({
    '序号': i + 1,
    '学号': s.studentNo || '',
    '姓名': s.name,
    '本月打卡天数': s.monthlyCount,
    '本月总天数': s.daysInMonth,
    '全勤': s.fullAttendance ? '是' : '否',
    '昨日打卡': s.checkedYesterday ? '已打卡' : '未打卡',
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  setColumnWidths(worksheet, data)

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, monthLabel)

  // Electron 环境使用系统对话框
  if (window.electronAPI) {
    const result = await window.electronAPI.showSaveDialog({
      title: `保存${monthLabel}朗读打卡报表`,
      defaultPath: filename,
      filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
    })

    if (!result || result.canceled || !result.filePath) return

    const xlsxData = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' })
    await window.electronAPI.writeFile(result.filePath, xlsxData)
  } else {
    // 浏览器环境使用直接下载
    const xlsxData = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    downloadBlob(blob, filename)
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function setColumnWidths(worksheet: XLSX.WorkSheet, data: Record<string, unknown>[]): void {
  if (data.length === 0) return

  const columns = Object.keys(data[0])
  const colWidths = columns.map(col => {
    let maxWidth = col.length
    for (const row of data) {
      const value = String(row[col] || '')
      maxWidth = Math.max(maxWidth, value.length)
    }
    return { wch: Math.min(maxWidth + 2, 30) }
  })

  worksheet['!cols'] = colWidths
}
