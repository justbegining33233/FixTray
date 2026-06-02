'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Route } from 'next';
import { FaKeyboard } from 'react-icons/fa';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

interface KeyboardShortcutsProps {
  shortcuts?: KeyboardShortcut[];
}

export default function KeyboardShortcuts({ shortcuts = [] }: KeyboardShortcutsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showHelp, setShowHelp] = useState(false);

  // Default shortcuts based on user role and current page
  const getDefaultShortcuts = (): KeyboardShortcut[] => {
    const defaults: KeyboardShortcut[] = [
      {
        key: 'k',
        ctrl: true,
        description: 'Global search',
        action: () => {
          // Trigger global search - this will be handled by GlobalSearch component
          const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
          window.dispatchEvent(event);
        },
      },
      {
        key: '?',
        shift: true,
        description: 'Show keyboard shortcuts',
        action: () => setShowHelp(true),
      },
    ];

    // Add role-specific shortcuts
    const userRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : '';

    if (userRole === 'shop' || userRole === 'manager') {
      defaults.push({
        key: 'n',
        ctrl: true,
        description: 'New work order',
        action: () => router.push('/shop/new-inshop-job' as Route),
      });
    }

    if (userRole === 'tech') {
      defaults.push({
        key: 'c',
        ctrl: true,
        description: 'Clock in/out',
        action: () => {
          // This would trigger the time clock - implementation depends on the time clock component
          const event = new CustomEvent('toggleTimeClock');
          window.dispatchEvent(event);
        },
      });
    }

    // Add navigation shortcuts
    if (pathname?.includes('/workorders')) {
      defaults.push(
        {
          key: '1',
          alt: true,
          description: 'All orders',
          action: () => router.push('/shop/home' as Route),
        },
        {
          key: '2',
          alt: true,
          description: 'Pending orders',
          action: () => router.push('/shop/home' as Route),
        },
        {
          key: '3',
          alt: true,
          description: 'In progress',
          action: () => router.push('/shop/home' as Route),
        },
        {
          key: '4',
          alt: true,
          description: 'Completed orders',
          action: () => router.push('/shop/home' as Route),
        }
      );
    }

    return defaults;
  };

  const allShortcuts = [...getDefaultShortcuts(), ...shortcuts];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement ||
          (e.target as HTMLElement)?.contentEditable === 'true') {
        return;
      }

      for (const shortcut of allShortcuts) {
        if (e.key.toLowerCase() === shortcut.key.toLowerCase() &&
            !!e.ctrlKey === !!shortcut.ctrl &&
            !!e.shiftKey === !!shortcut.shift &&
            !!e.altKey === !!shortcut.alt) {
          e.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allShortcuts]);

  const formatShortcut = (shortcut: KeyboardShortcut) => {
    const parts = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.alt) parts.push('Alt');
    if (shortcut.shift) parts.push('Shift');
    parts.push(shortcut.key.toUpperCase());
    return parts.join('+');
  };

  if (!showHelp) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={() => setShowHelp(false)}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 24,
          maxWidth: 600,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}>
          <FaKeyboard style={{ color: '#64748b', fontSize: 20 }} />
          <h2 style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#e2e8f0',
            margin: 0,
          }}>
            Keyboard Shortcuts
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 16,
        }}>
          {allShortcuts.map((shortcut, index) => (
            <div
              key={index}
              style={{
                padding: 12,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 8,
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
              }}>
                <span style={{
                  fontSize: 13,
                  color: '#e2e8f0',
                  fontWeight: 500,
                }}>
                  {shortcut.description}
                </span>
                <kbd style={{
                  padding: '2px 8px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 4,
                  fontSize: 11,
                  color: '#cbd5e1',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                }}>
                  {formatShortcut(shortcut)}
                </kbd>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 20,
          padding: 12,
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: 8,
        }}>
          <p style={{
            fontSize: 12,
            color: '#93c5fd',
            margin: 0,
            textAlign: 'center',
          }}>
            Press <kbd style={{
              padding: '1px 4px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 3,
              fontSize: 10,
              margin: '0 2px',
            }}>Esc</kbd> or click outside to close
          </p>
        </div>
      </div>
    </div>
  );
}

// Export hook for using keyboard shortcuts in other components
export function useKeyboardShortcut(shortcut: Omit<KeyboardShortcut, 'action'>, action: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement ||
          (e.target as HTMLElement)?.contentEditable === 'true') {
        return;
      }

      if (e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          !!e.ctrlKey === !!shortcut.ctrl &&
          !!e.shiftKey === !!shortcut.shift &&
          !!e.altKey === !!shortcut.alt) {
        e.preventDefault();
        action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcut, action]);
}