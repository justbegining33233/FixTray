'use client';

import { useState, useRef } from 'react';
import { FaFileSignature, FaCheck, FaTimes, FaPencilAlt } from 'react-icons/fa';

interface WorkAuthorizationFormProps {
  workOrderId: string;
  customerName?: string;
  vehicleInfo?: string;
  workDescription?: string;
  estimatedCost?: string;
  onSubmit?: (data: WorkAuthorizationData) => void;
  onCancel?: () => void;
  readOnly?: boolean;
  signedBy?: string;
  signedDate?: string;
}

export interface WorkAuthorizationData {
  workOrderId: string;
  authorizedBy: string;
  signature: string;
  timestamp: string;
  notes?: string;
}

export default function WorkAuthorizationForm({
  workOrderId,
  customerName = 'Customer',
  vehicleInfo = 'Vehicle Information',
  workDescription = 'Work to be performed',
  estimatedCost = '$0.00',
  onSubmit,
  onCancel,
  readOnly = false,
  signedBy = '',
  signedDate = '',
}: WorkAuthorizationFormProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [notes, setNotes] = useState('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(!!signedBy);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || readOnly) return;
    setIsDrawing(true);
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      const rect = canvasRef.current.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      const rect = canvasRef.current.getBoundingClientRect();
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    setSignatureData(null);
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      alert('Please enter your full name');
      return;
    }

    if (!signatureData) {
      alert('Please sign the authorization form');
      return;
    }

    const data: WorkAuthorizationData = {
      workOrderId,
      authorizedBy: fullName,
      signature: signatureData,
      timestamp: new Date().toISOString(),
      notes: notes || undefined,
    };

    if (onSubmit) {
      onSubmit(data);
    } else {
      // Submit to API
      try {
        const response = await fetch('/api/work-authorizations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          credentials: 'include',
        });

        if (response.ok) {
          setSubmitted(true);
          setShowSignaturePad(false);
          alert('Work authorization submitted successfully!');
        } else {
          alert('Failed to submit authorization');
        }
      } catch (err) {
        alert('Error submitting authorization');
        console.error(err);
      }
    }
  };

  if (submitted && readOnly) {
    return (
      <div className="w-full bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-green-500 p-6">
        <div className="text-center">
          <FaCheck className="text-4xl text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-green-800 mb-2">Authorization Approved</h3>
          <p className="text-green-700 mb-4">Authorized by: <span className="font-semibold">{signedBy}</span></p>
          <p className="text-sm text-green-600">Signed: {signedDate}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border border-slate-700 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-slate-950 p-6 border-b border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <FaFileSignature className="text-cyan-400 text-2xl" />
          <div>
            <h3 className="text-2xl font-bold text-white">Work Authorization</h3>
            <p className="text-sm text-slate-400">WO-{workOrderId.slice(0, 8)}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Work Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Customer</p>
            <p className="text-white font-semibold">{customerName}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Vehicle</p>
            <p className="text-white font-semibold">{vehicleInfo}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Work Description</p>
            <p className="text-white font-semibold">{workDescription}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Estimated Cost</p>
            <p className="text-cyan-400 font-bold text-lg">{estimatedCost}</p>
          </div>
        </div>

        {/* Authorization Agreement */}
        <div className="bg-slate-950/50 border border-slate-700 rounded p-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            I authorize {customerName} to proceed with the above work as described. I acknowledge that I have reviewed the scope of work and estimated cost, and approve them to be performed on my vehicle.
          </p>
        </div>

        {/* Full Name Input */}
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Full Name *</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={readOnly}
            placeholder="Enter your full name"
            className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Additional Notes (Optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={readOnly}
            placeholder="Any special instructions or notes..."
            className="w-full px-4 py-2 bg-slate-950 border border-slate-600 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 disabled:opacity-50 h-20 resize-none"
          />
        </div>

        {/* Signature Pad */}
        {!readOnly && (
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Signature *</label>
            {!showSignaturePad ? (
              <button
                onClick={() => setShowSignaturePad(true)}
                className="w-full px-4 py-3 bg-cyan-600/20 border-2 border-dashed border-cyan-500/50 rounded-lg text-cyan-400 font-medium hover:border-cyan-400 transition"
              >
                <FaPencilAlt className="inline mr-2" /> Click to Sign
              </button>
            ) : (
              <div className="space-y-3">
                <div className="border-2 border-slate-600 rounded-lg bg-white overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={200}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    className="w-full cursor-crosshair bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={clearSignature}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => {
                      setShowSignaturePad(false);
                    }}
                    className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-medium transition"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
            {signatureData && (
              <p className="text-xs text-green-400 mt-2">✓ Signature captured</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {!readOnly && (
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                if (onCancel) onCancel();
                else {
                  clearSignature();
                  setFullName('');
                  setNotes('');
                  setShowSignaturePad(false);
                }
              }}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              <FaTimes /> Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!fullName.trim() || !signatureData}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              <FaCheck /> Authorize Work
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
