'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState } from 'react';
import { useSocket } from '@/lib/socket';

interface RealTimeWorkOrdersProps {
  shopId?: string;
  userId: string;
  onWorkOrderUpdate?: (data: any) => void;
}

export default function RealTimeWorkOrders({
  shopId: _shopId,
  userId: _userId,
  onWorkOrderUpdate
}: RealTimeWorkOrdersProps) {
  const say = usePhrase();
  const { isConnected, on, off } = useSocket();
  const [recentUpdates, setRecentUpdates] = useState<any[]>([]);

  useEffect(() => {
    if (!isConnected) return;

    // Listen for work order updates
    const handleWorkOrderUpdate = (data: any) => {
      // Add to recent updates
      setRecentUpdates(prev => [data, ...prev.slice(0, 4)]); // Keep last 5 updates

      // Call parent callback if provided
      if (onWorkOrderUpdate) {
        onWorkOrderUpdate(data);
      }
    };

    on('work-order-updated', handleWorkOrderUpdate);

    return () => {
      off('work-order-updated', handleWorkOrderUpdate);
    };
  }, [isConnected, on, off, onWorkOrderUpdate]);

  if (!isConnected) {
    // Don't show a disconnected banner in the UI  -  keep it silent for UX.
    return null;
  }

  return (
    <div style={{
      padding: '12px',
      background: 'rgba(34,197,94,0.1)',
      border: '1px solid rgba(34,197,94,0.3)',
      borderRadius: 6,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 12, color: '#22c55e' }}> {say("Live Updates")}</span>
        <span style={{ fontSize: 10, color: '#9aa3b2' }}>
          {say("Connected to real-time work order updates")}{' '}</span>
      </div>

      {recentUpdates.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{
            fontSize: 11,
            color: '#9aa3b2',
            marginBottom: 4,
            fontWeight: 600,
          }}>
            {say("Recent Updates:")}{' '}</div>
          {recentUpdates.map((update, index) => (
            <div
              key={index}
              style={{
                fontSize: 10,
                color: '#e5e7eb',
                padding: '4px 0',
                borderBottom: index < recentUpdates.length - 1
                  ? '1px solid rgba(255,255,255,0.1)'
                  : 'none',
              }}
            >
              {say("Work Order #")}{say(update.workOrderId)} {say(update.action)} by {say(update.updatedBy)}
              <span style={{ color: '#9aa3b2', marginLeft: 8 }}>
                {new Date(update.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}