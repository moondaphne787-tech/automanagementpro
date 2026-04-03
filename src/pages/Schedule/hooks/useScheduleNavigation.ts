import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { ScheduleDateConfig } from '@/ai/schedulePrompts'
import {
  getWeekendWithFridayConfigs,
  getWeekDateConfigs
} from '@/ai/schedulePrompts'
import type { SchedulePreset } from '../types'
import { useAddDateDialog } from './useAddDateDialog'

export function useScheduleNavigation() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentDateIndex, setCurrentDateIndex] = useState(0)
  const [scheduleDates, setScheduleDates] = useState<ScheduleDateConfig[]>(() =>
    getWeekendWithFridayConfigs(new Date())
  )
  const [schedulePreset, setSchedulePreset] = useState<SchedulePreset>('weekend_with_friday')

  const addDateDialog = useAddDateDialog()

  const updateDates = useCallback((date: Date, preset: SchedulePreset) => {
    if (preset === 'weekend_with_friday') {
      setScheduleDates(getWeekendWithFridayConfigs(date))
    } else if (preset === 'week') {
      setScheduleDates(getWeekDateConfigs(date))
    }
  }, [])

  const handlePresetChange = useCallback((preset: SchedulePreset) => {
    setSchedulePreset(preset)
    setCurrentDateIndex(0)
    updateDates(currentDate, preset)
  }, [currentDate, updateDates])

  const goToPrevWeek = useCallback(() => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentDate(newDate)
    setCurrentDateIndex(0)
    updateDates(newDate, schedulePreset)
  }, [currentDate, schedulePreset, updateDates])

  const goToNextWeek = useCallback(() => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentDate(newDate)
    setCurrentDateIndex(0)
    updateDates(newDate, schedulePreset)
  }, [currentDate, schedulePreset, updateDates])

  const goToToday = useCallback(() => {
    const now = new Date()
    setCurrentDate(now)
    setCurrentDateIndex(0)
    updateDates(now, schedulePreset)
  }, [schedulePreset, updateDates])

  const handleAddDate = useCallback(() => {
    const newConfig = addDateDialog.buildDateConfig()
    if (!newConfig) return

    if (scheduleDates.some(d => d.date === newConfig.date)) {
      toast.error('该日期已添加')
      return
    }

    setScheduleDates(prev => [...prev, newConfig].sort((a, b) => a.date.localeCompare(b.date)))
    addDateDialog.setOpen(false)
    addDateDialog.reset()
  }, [addDateDialog, scheduleDates])

  const handleRemoveDate = useCallback((date: string) => {
    setScheduleDates(prev => prev.filter(d => d.date !== date))
  }, [])

  return {
    currentDate,
    currentDateIndex,
    setCurrentDateIndex,
    scheduleDates,
    schedulePreset,
    addDateDialog,
    handlePresetChange,
    goToPrevWeek,
    goToNextWeek,
    goToToday,
    handleAddDate,
    handleRemoveDate
  }
}
