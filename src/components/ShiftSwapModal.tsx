'use client';

import { useState } from 'react';
import { FaCheck, FaTimes, FaClock, FaUser, FaCalendarAlt, FaSync } from 'react-icons/fa';

interface ShiftSwapModalProps {
  technician?: { id: string; name: string; phone: string };
  currentShift?: { id: string; date: string; startTime: string; endTime: string; location: string };
  availableShifts?: Array<{ id: string; techName: string; date: string; startTime: string; endTime: string; location: string }>;
  onRequestSwap?: (currentShiftId: string, desiredShiftId: string) => void;
  onClose?: () => void;
}

export default function ShiftSwapModal({
  technician = { id: 'tech-1', name: 'John Doe', phone: '(555) 123-4567' },
  currentShift = { id: 'shift-1', date: '2024-01-15', startTime: '08:00', endTime: '16:00', location: 'Main Shop' },
  availableShifts = [
    { id: 'shift-2', techName: 'Sarah Johnson', date: '2024-01-15', startTime: '10:00', endTime: '18:00', location: 'Downtown' },
    { id: 'shift-3', techName: 'Mike Davis', date: '2024-01-16', startTime: '08:00', endTime: '16:00', location: 'Main Shop' },
    { id: 'shift-4', techName: 'Emma Wilson', date: '2024-01-17', startTime: '14:00', endTime: '22:00', location: 'Airport' },
  ],
  onRequestSwap,
  onClose,
}: ShiftSwapModalProps) {
  const [selectedSwapShift, setSelectedSwapShift] = useState<string | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleRequestSwap = async () => {
    if (!selectedSwapShift) {
      setError('Please select a shift to swap with');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (onRequestSwap) {
        onRequestSwap(currentShift.id, selectedSwapShift);
      } else {
        // Call API to request shift swap
        const response = await fetch('/api/shift-swaps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestingTechId: technician.id,
            currentShiftId: currentShift.id,
            desiredShiftId: selectedSwapShift,
            note: requestNote,
          }),
          credentials: 'include',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to request shift swap');
        }
      }

      setSubmitted(true);
      setTimeout(() => {
        onClose?.();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900 rounded-lg border border-slate-700 max-w-md w-full shadow-2xl p-8 text-center">
          <FaCheck className="text-4xl text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Swap Request Sent</h3>
          <p className="text-slate-400 mb-4">
            Your shift swap request has been submitted to the other technician and your manager for approval.
          </p>
          <p className="text-sm text-slate-500">
            You'll be notified when they respond.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg border border-slate-700 max-w-2xl w-full shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-slate-950 p-6 border-b border-slate-700 sticky top-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaSync className="text-cyan-400 text-2xl" />
              <div>
                <h3 className="text-xl font-bold text-white">Request Shift Swap</h3>
                <p className="text-sm text-slate-400">Find someone to trade shifts with</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition text-2xl font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Shift */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">Your Current Shift</h4>
            <div className="bg-slate-950/50 border border-slate-700 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Date</p>
                  <p className="text-lg font-semibold text-white">{new Date(currentShift.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Time</p>
                  <p className="text-lg font-semibold text-white">{currentShift.startTime} - {currentShift.endTime}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 mb-1">Location</p>
                  <p className="text-base font-semibold text-cyan-400">{currentShift.location}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Available Shifts to Swap */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">Available Shifts to Swap</h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {availableShifts.map(shift => (
                <button
                  key={shift.id}
                  onClick={() => setSelectedSwapShift(shift.id)}
                  className={`w-full p-4 rounded-lg border-2 transition text-left ${
                    selectedSwapShift === shift.id
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-700 bg-slate-950/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <FaUser className="text-slate-500 flex-shrink-0" />
                      <span className="font-semibold text-white">{shift.techName}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">{new Date(shift.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      <p className="text-sm font-semibold text-cyan-400">{shift.startTime} - {shift.endTime}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <FaCalendarAlt size={12} />
                    {shift.location}
                  </div>
                </button>
              ))}
            </div>
            {availableShifts.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <FaClock size={32} className="mx-auto mb-3 opacity-50" />
                <p>No available shifts to swap with right now</p>
              </div>
            )}
          </div>

          {/* Request Note */}
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-2 block">Add a Message (Optional)</label>
            <textarea
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              placeholder="Explain why you need this swap... (e.g., 'Doctor's appointment', 'Family event')"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none h-24"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-600/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-600/10 border border-blue-500/30 rounded-lg text-sm text-blue-300">
            <p className="font-semibold mb-2">How it works:</p>
            <ul className="space-y-1 text-xs text-blue-200">
              <li>• Your request goes to the other technician and your manager</li>
              <li>• Both must approve for the swap to be confirmed</li>
              <li>• You'll get notified when they respond</li>
              <li>• Once approved, shifts will be updated automatically</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition"
            >
              <FaTimes className="inline mr-2" /> Cancel
            </button>
            <button
              onClick={handleRequestSwap}
              disabled={!selectedSwapShift || submitting}
              className="flex-1 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition"
            >
              {submitting ? (
                <>
                  <FaClock className="inline mr-2 animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <FaSync className="inline mr-2" /> Request Swap
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
