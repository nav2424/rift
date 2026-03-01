'use client'

import { useState, useEffect, useRef } from 'react'

interface DatePickerProps {
  value: string // Format: YYYY-MM-DD
  onChange: (date: string) => void
  maxDate?: string // Format: YYYY-MM-DD
  minDate?: string // Format: YYYY-MM-DD
  className?: string
}

export default function DatePicker({ value, onChange, maxDate, minDate, className = '' }: DatePickerProps) {
  // Initialize state with today's date (will be overridden if value is provided)
  const today = new Date()
  const [year, setYear] = useState<number>(today.getFullYear())
  const [month, setMonth] = useState<number>(today.getMonth() + 1)
  const [day, setDay] = useState<number>(today.getDate())

  // Parse initial value
  useEffect(() => {
    if (value) {
      // Parse YYYY-MM-DD string directly to avoid timezone conversion issues
      const parts = value.split('-')
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10)
        const m = parseInt(parts[1], 10)
        const d = parseInt(parts[2], 10)
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          setYear(y)
          setMonth(m)
          setDay(d)
        }
      }
    }
    // If no value, the initial state is already set to today, but we'll let the parent component handle defaults
  }, [value])

  // Get max values
  // For events, extend max year to 20 years in the future
  const currentYear = new Date().getFullYear()
  const maxDateObj = maxDate ? new Date(maxDate) : new Date(currentYear + 20, 11, 31) // Default to 20 years from now
  const maxYear = maxDateObj.getFullYear()
  const minDateObj = minDate ? new Date(minDate) : new Date(1900, 0, 1)
  const minYear = minDateObj.getFullYear()

  // Generate arrays for options
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i)
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ]

  // Get days in month
  const getDaysInMonth = (y: number, m: number) => {
    return new Date(y, m, 0).getDate()
  }

  const daysInMonth = getDaysInMonth(year, month)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // Update day if it exceeds days in month
  useEffect(() => {
    if (day > daysInMonth) {
      setDay(daysInMonth)
    }
  }, [month, year, daysInMonth, day])

  // Handle changes
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value)
    setYear(newYear)
    updateDate(newYear, month, day)
  }

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value)
    setMonth(newMonth)
    updateDate(year, newMonth, day)
  }

  const handleDayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDay = parseInt(e.target.value)
    setDay(newDay)
    updateDate(year, month, newDay)
  }

  const updateDate = (y: number, m: number, d: number) => {
    // Format as YYYY-MM-DD directly to avoid timezone conversion issues
    const dateString = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    onChange(dateString)
  }

  // Check if className includes "text-sm" for smaller size
  const isSmall = className.includes('text-sm')
  const paddingClass = isSmall ? 'px-3 py-2' : 'px-4 py-3.5'
  const textSizeClass = isSmall ? 'text-sm' : 'text-base'
  const arrowPadding = isSmall ? '2rem' : '2.5rem'
  const arrowPosition = isSmall ? '0.5rem' : '0.75rem'

  return (
    <div className={`flex gap-3 ${className}`}>
      {/* Month Selector - Wider to fit full month names */}
      <div className="flex-[1.5] min-w-0">
        <select
          value={month}
          onChange={handleMonthChange}
          size={1}
          className={`w-full ${paddingClass} bg-gray-100 border border-gray-200 rounded-lg text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300 transition-all backdrop-blur-sm font-light appearance-none cursor-pointer ${textSizeClass}`}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'%3E%3Cpath fill='white' fill-opacity='0.6' d='M7 10L2 5h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: `right ${arrowPosition} center`,
            paddingRight: arrowPadding,
          }}
        >
          {months.map((m) => (
            <option key={m.value} value={m.value} className="bg-white text-[#1d1d1f] py-2">
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Day Selector */}
      <div className="flex-1 min-w-0">
        <select
          value={day}
          onChange={handleDayChange}
          size={1}
          className={`w-full ${paddingClass} bg-gray-100 border border-gray-200 rounded-lg text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300 transition-all backdrop-blur-sm font-light appearance-none cursor-pointer ${textSizeClass}`}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'%3E%3Cpath fill='white' fill-opacity='0.6' d='M7 10L2 5h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: `right ${arrowPosition} center`,
            paddingRight: arrowPadding,
          }}
        >
          {days.map((d) => (
            <option key={d} value={d} className="bg-white text-[#1d1d1f] py-2">
              {d.toString().padStart(2, '0')}
            </option>
          ))}
        </select>
      </div>

      {/* Year Selector */}
      <div className="flex-1 min-w-0">
        <select
          value={year}
          onChange={handleYearChange}
          size={1}
          className={`w-full ${paddingClass} bg-gray-100 border border-gray-200 rounded-lg text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300 transition-all backdrop-blur-sm font-light appearance-none cursor-pointer ${textSizeClass}`}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'%3E%3Cpath fill='white' fill-opacity='0.6' d='M7 10L2 5h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: `right ${arrowPosition} center`,
            paddingRight: arrowPadding,
          }}
        >
          {years.map((y) => (
            <option key={y} value={y} className="bg-white text-[#1d1d1f] py-2">
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
