import LoginClient from '@/components/LoginClient';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>FixTray Login</h1>
      <LoginClient />
    </>
  );
}
