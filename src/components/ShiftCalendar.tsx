'use client';

import { useState, useEffect } from 'react';
import { formatDate, formatDuration } from '@/lib/utils';

interface Shift {
  id: string;
  techId: string;
  techName: string;
  startTime: string;
  endTime: string;
  date: string;
  status: string;
  lateMinutes?: number;
  earlyDepartureMins?: number;
}

interface ShiftCalendarProps {
  shifts: Shift[];
  onDayClick?: (date: string) => void;
  onShiftClick?: (shiftId: string) => void;
  view?: 'month' | 'week';
}

export function ShiftCalendar({ shifts = [], onDayClick, onShiftClick, view = 'month' }: ShiftCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [displayShifts, setDisplayShifts] = useState<Shift[]>([]);

  useEffect(() => {
    updateDisplayShifts();
  }, [currentDate, shifts]);

  const updateDisplayShifts = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const filtered = shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return shiftDate.getFullYear() === year && shiftDate.getMonth() === month;
    });

    setDisplayShifts(filtered);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const getShiftsForDay = (day: number) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      .toISOString()
      .split('T')[0];
    return displayShifts.filter(s => s.date === dateStr);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = [];

  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Days of month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold">{monthName}</h3>
        <div className="flex gap-2">
          <button
            onClick={handlePrevMonth}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            ← Prev
          </button>
          <button
            onClick={handleNextMonth}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 mb-6">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map((day, index) => (
          <div
            key={index}
            onClick={() => day && onDayClick?.(new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0])}
            className={`min-h-24 p-2 border rounded ${
              day ? 'bg-gray-50 cursor-pointer hover:bg-blue-50' : 'bg-gray-100'
            }`}
          >
            {day && (
              <>
                <div className="font-semibold text-sm mb-1">{day}</div>
                <div className="space-y-1">
                  {getShiftsForDay(day).map(shift => (
                    <div
                      key={shift.id}
                      onClick={e => {
                        e.stopPropagation();
                        onShiftClick?.(shift.id);
                      }}
                      className="text-xs bg-blue-100 text-blue-900 p-1 rounded cursor-pointer hover:bg-blue-200 truncate"
                      title={`${shift.techName}: ${shift.startTime} - ${shift.endTime}`}
                    >
                      <span className="font-semibold">{shift.startTime}</span>
                      <br />
                      <span className="text-xs">{shift.techName}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="border-t pt-4">
        <div className="text-sm text-gray-600">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 bg-blue-100 rounded border border-blue-300" />
            <span>Scheduled shifts</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 rounded border border-gray-300" />
            <span>No shifts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
