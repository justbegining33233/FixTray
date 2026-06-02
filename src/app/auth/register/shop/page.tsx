import Link from 'next/link';

export default function ShopRegistrationPage() {
  return (
    <div style={{minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40}}>
      <div style={{textAlign: 'center'}}>
        <h2 style={{marginBottom:12}}>Shop Registration</h2>
        <p style={{color:'#94a3b8', marginBottom:20}}>Open the full registration flow to set up your shop profile and review the complete FixTray workflow.</p>
        <Link href="/auth/register/shop" style={{padding:12, background:'#e5332a', color:'white', borderRadius:8, textDecoration:'none', fontWeight:600}}>Open Client Registration</Link>
      </div>
    </div>
  );
}