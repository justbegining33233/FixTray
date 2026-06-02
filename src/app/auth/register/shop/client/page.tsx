import { FaArrowLeft } from 'react-icons/fa';
import ShopRegistrationClientWrapper from '@/components/ShopRegistrationClientWrapper';
import Link from 'next/link';

export default function ShopRegistrationClientPage() {
  return (
    <div style={{minHeight: '100vh', padding: '20px'}}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Shop Registration</h1>
      <header style={{ marginBottom: 32, textAlign: 'center' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#9aa3b2', textDecoration: 'none', fontSize: 14, marginBottom: 24 }}>
          <FaArrowLeft style={{marginRight:4}} /> Back to Home
        </Link>
        <div style={{ justifyContent: 'center' }}>
          <span style={{fontWeight:700, fontSize:18}}>FixTray</span>
          <span style={{marginLeft:8, color:'#9aa3b2'}}>Shop setup and onboarding</span>
        </div>
      </header>

      <div style={{maxWidth: 800, margin: '0 auto'}}>
        <ShopRegistrationClientWrapper />
      </div>
    </div>
  );
}
