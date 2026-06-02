export const dynamic = 'force-dynamic';

export default function GlobalError() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000000',
        color: '#f1f5f9',
        fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
        padding: 'calc(20px + env(safe-area-inset-top, 0px)) 20px calc(20px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="card-raised" style={{ width: '100%', maxWidth: 520, padding: 24 }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ color: '#94a3b8', marginBottom: 18 }}>
          We hit an unexpected error. Refresh to retry, or go back to your dashboard.
        </p>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          Refresh page
        </button>
      </div>
    </div>
  );
}
