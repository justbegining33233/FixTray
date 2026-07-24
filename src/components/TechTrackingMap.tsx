'use client';

import { useEffect, useState } from 'react';
import { FaMapMarkerAlt, FaClock, FaPhone, FaRoute } from 'react-icons/fa';

interface Tech {
  id: string;
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
  status: 'clocked-in' | 'on-job' | 'break' | 'clocked-out';
  currentJob?: string;
  distance?: number;
  lastUpdate: string;
}

interface TechTrackingMapProps {
  shopId?: string;
}

export default function TechTrackingMap({ shopId = 'current' }: TechTrackingMapProps) {
  const [techs, setTechs] = useState<Tech[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTech, setSelectedTech] = useState<Tech | null>(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    // Fetch tech locations from API
    fetch(`/api/tech/tracking?shopId=${shopId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { techs: [] })
      .then(data => {
        setTechs(data.techs || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        // Demo data for preview
        setTechs([
          { id: '1', name: 'John Smith', phone: '(555) 123-4567', latitude: 34.0522, longitude: -118.2437, status: 'on-job', currentJob: 'Oil Change - Customer 1', lastUpdate: '2 min ago' },
          { id: '2', name: 'Sarah Johnson', phone: '(555) 234-5678', latitude: 34.0622, longitude: -118.2337, status: 'clocked-in', lastUpdate: '5 min ago' },
          { id: '3', name: 'Mike Davis', phone: '(555) 345-6789', latitude: 33.9850, longitude: -118.2435, status: 'break', lastUpdate: '12 min ago' },
        ]);
      });
  }, [shopId]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'on-job': return '#22c55e';
      case 'clocked-in': return '#3b82f6';
      case 'break': return '#f59e0b';
      case 'clocked-out': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="w-full bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border border-slate-700 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-slate-950 p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaMapMarkerAlt className="text-cyan-400 text-xl" />
            <div>
              <h3 className="text-lg font-semibold text-white">Technician Locations</h3>
              <p className="text-xs text-slate-500">Real-time GPS tracking</p>
            </div>
          </div>
          <button
            onClick={() => setShowMap(!showMap)}
            className="px-3 py-1 bg-cyan-600/20 text-cyan-400 rounded text-xs font-medium hover:bg-cyan-600/30 transition"
          >
            {showMap ? 'List View' : 'Map View'}
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500">
            Loading technician data...
          </div>
        ) : techs.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-slate-500">
            No technicians currently clocked in
          </div>
        ) : showMap ? (
          // Map View (simplified - would use actual map library)
          <div className="relative w-full h-96 bg-slate-950/50 rounded border border-slate-700 overflow-hidden flex items-center justify-center">
            <div className="text-center text-slate-500">
              <p className="mb-2">📍 Map View</p>
              <p className="text-xs">Integration with Google Maps / Mapbox</p>
              <p className="text-xs mt-3 text-cyan-500/50">
                {techs.length} technician{techs.length !== 1 ? 's' : ''} visible
              </p>
            </div>

            {/* Simplified grid view of tech markers */}
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-3">
              {techs.map((tech, idx) => (
                <button
                  key={tech.id}
                  onClick={() => setSelectedTech(tech)}
                  className="m-2 p-2 bg-slate-900/80 hover:bg-slate-800 rounded border-2 border-slate-700 hover:border-cyan-500 transition cursor-pointer flex flex-col items-center justify-center gap-1"
                >
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: getStatusColor(tech.status) }}></div>
                  <span className="text-xs text-slate-300 font-medium text-center truncate w-full px-1">{tech.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // List View
          <div className="space-y-3">
            {techs.map(tech => (
              <button
                key={tech.id}
                onClick={() => setSelectedTech(tech)}
                className="w-full p-4 bg-slate-950/50 hover:bg-slate-950 border border-slate-700 hover:border-cyan-500 rounded-lg transition text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getStatusColor(tech.status) }}
                    />
                    <h4 className="font-semibold text-white">{tech.name}</h4>
                  </div>
                  <span className="text-xs px-2 py-1 bg-slate-800 text-slate-300 rounded">
                    {getStatusLabel(tech.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <FaClock size={13} className="text-slate-600" />
                    <span>Updated {tech.lastUpdate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaPhone size={13} className="text-slate-600" />
                    <a href={`tel:${tech.phone}`} className="text-cyan-400 hover:text-cyan-300">{tech.phone}</a>
                  </div>
                </div>

                {tech.currentJob && (
                  <div className="mt-2 pt-2 border-t border-slate-700">
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <FaRoute size={11} /> {tech.currentJob}
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Selected Tech Details */}
        {selectedTech && (
          <div className="mt-4 p-4 bg-cyan-600/10 border border-cyan-500/30 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-cyan-300">{selectedTech.name}</h4>
              <button
                onClick={() => setSelectedTech(null)}
                className="text-cyan-400 hover:text-cyan-300"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <p>📍 Location: {selectedTech.latitude.toFixed(4)}, {selectedTech.longitude.toFixed(4)}</p>
              <p>Status: <span style={{ color: getStatusColor(selectedTech.status) }}>{getStatusLabel(selectedTech.status)}</span></p>
              <p>Last Update: {selectedTech.lastUpdate}</p>
              <a href={`tel:${selectedTech.phone}`} className="text-cyan-400 hover:text-cyan-300">Call: {selectedTech.phone}</a>
            </div>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="grid grid-cols-3 border-t border-slate-700 bg-slate-950/50">
        <div className="p-3 border-r border-slate-700 text-center text-xs">
          <p className="text-2xl font-bold text-cyan-400">{techs.filter(t => t.status === 'on-job').length}</p>
          <p className="text-slate-500">On Jobs</p>
        </div>
        <div className="p-3 border-r border-slate-700 text-center text-xs">
          <p className="text-2xl font-bold text-blue-400">{techs.filter(t => t.status === 'clocked-in').length}</p>
          <p className="text-slate-500">Clocked In</p>
        </div>
        <div className="p-3 text-center text-xs">
          <p className="text-2xl font-bold text-amber-400">{techs.filter(t => t.status === 'break').length}</p>
          <p className="text-slate-500">On Break</p>
        </div>
      </div>
    </div>
  );
}
