'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaCamera, FaTimes } from 'react-icons/fa';

export default function TechPhotos() {
  const { user, isLoading } = useRequireAuth(['tech']);
  const [photos, setPhotos] = useState<Array<{ id: string; url: string; filename?: string; caption?: string; workOrderId?: string }>>([]);
  const [_uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [workOrderInput, setWorkOrderInput] = useState('');

  // modal state for upload window
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [modalPreview, setModalPreview] = useState<string>('');
  // inline edit caption modal
  const [captionModal, setCaptionModal] = useState<{ id: string; current: string } | null>(null);
  const [captionInput, setCaptionInput] = useState('');
  // inline assign WO modal
  const [assignModal, setAssignModal] = useState<{ id: string; url: string; caption: string; current: string } | null>(null);
  const [assignInput, setAssignInput] = useState('');
  const [photoMsg, setPhotoMsg] = useState<{type:'success'|'error';text:string}|null>(null);
  const [removePhotoId, setRemovePhotoId] = useState<string|null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch('/api/photos');
        if (res.ok) {
          const json = await res.json();
          setPhotos(json.photos || []);
        }
      } catch {
      }
    })();
  }, [user]);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);

    const temp = { id: `local-${Date.now()}`, url: URL.createObjectURL(file), filename: file.name, caption: caption || undefined, workOrderId: workOrderInput || undefined };
    setPhotos(p => [temp, ...p]);

    try {
      const form = new FormData();
      form.append('photo', file);
      if (caption) form.append('caption', caption);
      if (workOrderInput) form.append('workOrderId', workOrderInput);

      const res = await fetch('/api/photos', { method: 'POST', body: form });
      if (res.ok) {
        const j = await res.json();
        if (j.photo && j.photo.url) setPhotos(p => p.map(x => x.id === temp.id ? j.photo : x));
        setCaption('');
        setWorkOrderInput('');
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      console.error(err);
      setPhotos(p => p.filter(x => x.id !== temp.id));
    } finally {
      setUploading(false);
    }
  };

  const doRemovePhoto = async () => {
    if (!removePhotoId) return;
    try {
      await fetch(`/api/photos/${removePhotoId}`, { method: 'DELETE' });
      setPhotos(prev => prev.filter(x => x.id !== removePhotoId));
    } catch (err) { console.error(err); }
    setRemovePhotoId(null);
  };

  if (isLoading) {
    return (
      <div style={{minHeight:'100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{color: '#e5e7eb', fontSize: 18}}>Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(245,158,11,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1200, margin:'0 auto'}}>
          <Link href="/tech/all-tools" style={{color:'#e5332a', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}><FaArrowLeft style={{marginRight:4}} /> Back to Tools</Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaCamera style={{marginRight:4}} /> Tech Photos</h1>
          <div style={{fontSize:14, color:'#9aa3b2'}}>Upload and manage photos taken on jobs.</div>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18}}>
          <div>
            <h2 style={{margin:0, color:'#e5e7eb'}}>Photo Gallery</h2>
            <div style={{fontSize:13, color:'#9aa3b2', marginTop:6}}>Upload photos for work order documentation.</div>
          </div>

          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <button onClick={() => setShowUploadModal(true)} style={{background:'#000000', color:'#fff', padding:'8px 12px', borderRadius:8, cursor:'pointer'}}>Upload Photo</button>

            {/* Upload modal (popup window) */}
            {showUploadModal && (
              <div role="dialog" aria-modal="true" style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60}} onClick={() => { setShowUploadModal(false); setModalFile(null); setModalPreview(''); }}>
                <div onClick={(e) => e.stopPropagation()} style={{width:720, maxWidth:'95%', background:'#0b1220', borderRadius:12, padding:20, boxShadow:'0 10px 30px rgba(0,0,0,0.6)'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
                    <div>
                      <div style={{fontSize:16, fontWeight:700, color:'#e5e7eb'}}>Upload Photo</div>
                      <div style={{fontSize:13, color:'#9aa3b2'}}>Select an image, add a caption and optionally assign to a Work Order.</div>
                    </div>
                    <button onClick={() => { setShowUploadModal(false); setModalFile(null); setModalPreview(''); }} style={{background:'transparent', border:'none', color:'#9aa3b2', cursor:'pointer'}}><FaTimes style={{marginRight:4}} /></button>
                  </div>

                  <div style={{display:'flex', gap:12}}>
                    <div style={{flex:'0 0 320px', borderRadius:8, overflow:'hidden', background:'#000', display:'flex', alignItems:'center', justifyContent:'center', minHeight:180}}>
                      {modalPreview ? (
                        <img src={modalPreview} alt="preview" style={{width:'100%', height:180, objectFit:'cover'}} />
                      ) : (
                        <div style={{color:'#6b7280'}}>No image selected</div>
                      )}
                    </div>

                    <div style={{flex:1, display:'flex', flexDirection:'column', gap:8}}>
                      <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                        <input type="file" accept="image/*" onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setModalFile(f);
                          setModalPreview(f ? URL.createObjectURL(f) : '');
                        }} />
                      </label>

                      <input placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} style={{padding:8, borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', background:'transparent', color:'#e5e7eb'}} />

                      <input placeholder="Assign to WO (id)" value={workOrderInput} onChange={(e) => setWorkOrderInput(e.target.value)} style={{padding:8, borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', background:'transparent', color:'#e5e7eb'}} />

                      <div style={{display:'flex', gap:8, marginTop:8}}>
                        <button onClick={async () => {
                          if (!modalFile) { setPhotoMsg({type:'error',text:'Select an image first'}); return; }
                          await onFile(modalFile);
                          setShowUploadModal(false);
                          setModalFile(null);
                          setModalPreview('');
                        }} style={{background:'#e5332a', color:'#fff', padding:'8px 12px', borderRadius:8, border:'none'}}>Upload</button>

                        <button onClick={() => { setShowUploadModal(false); setModalFile(null); setModalPreview(''); }} style={{background:'transparent', color:'#9aa3b2', padding:'8px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.04)'}}>Cancel</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12}}>
          {photos.length === 0 && (
            <div style={{padding:36, borderRadius:8, background:'#0b1220', color:'#9aa3b2'}}>No photos yet  -  click "Upload Photo" to add images from your device.</div>
          )}

          {photos.map(p => (
            <div key={p.id} style={{borderRadius:8, overflow:'hidden', background:'#000', position:'relative', minHeight:140}}>
              <img src={p.url} alt={p.filename || 'photo'} style={{width:'100%', height:160, objectFit:'cover', display:'block'}} />
              <div style={{position:'absolute', left:8, bottom:8, right:8, display:'flex', justifyContent:'space-between', gap:8, alignItems:'center'}}>
                <div style={{background:'rgba(0,0,0,0.6)', color:'#fff', padding:'4px 8px', borderRadius:6, fontSize:12, maxWidth:'55%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{p.caption || p.filename || ''}</div>
                <div style={{display:'flex', gap:6}}>
                  <button onClick={() => { navigator.clipboard?.writeText(p.url); setPhotoMsg({type:'success',text:'Image URL copied'}); }} style={{background:'rgba(255,255,255,0.03)', color:'#fff', border:'none', padding:'6px 8px', borderRadius:6, cursor:'pointer'}}>Copy URL</button>
                  <button onClick={async () => {
                    setCaptionInput(p.caption || '');
                    setCaptionModal({ id: p.id, current: p.caption || '' });
                  }} style={{background:'rgba(255,255,255,0.03)', color:'#fff', border:'none', padding:'6px 8px', borderRadius:6, cursor:'pointer'}}>Edit</button>
                  <button onClick={async () => {
                    setAssignInput(p.workOrderId || '');
                    setAssignModal({ id: p.id, url: p.url, caption: p.caption || '', current: p.workOrderId || '' });
                  }} style={{background:'rgba(255,255,255,0.03)', color:'#fff', border:'none', padding:'6px 8px', borderRadius:6, cursor:'pointer'}}>Assign</button>
                  <button onClick={() => setRemovePhotoId(p.id)} style={{background:'rgba(255,255,255,0.03)', color:'#fff', border:'none', padding:'6px 8px', borderRadius:6, cursor:'pointer'}}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Caption edit modal */}
      {captionModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:99}}>
          <div style={{background:'#1f2937', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24, width:360, maxWidth:'90%'}}>
            <h3 style={{margin:'0 0 14px', fontSize:17, color:'#e5e7eb'}}>Edit Caption</h3>
            <input
              value={captionInput}
              onChange={e => setCaptionInput(e.target.value)}
              style={{width:'100%', padding:'10px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, color:'#e5e7eb', fontSize:14, boxSizing:'border-box', marginBottom:16}}
              autoFocus
            />
            <div style={{display:'flex', gap:10}}>
              <button onClick={async () => {
                try {
                  const res = await fetch(`/api/photos/${captionModal.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ caption: captionInput }) });
                  if (res.ok) { const j = await res.json(); setPhotos(prev => prev.map(x => x.id === captionModal.id ? j.photo : x)); }
                } catch (err) { console.error(err); }
                setCaptionModal(null);
              }} style={{flex:1, background:'#e5332a', color:'#fff', border:'none', borderRadius:8, padding:'10px 0', fontSize:14, fontWeight:600, cursor:'pointer'}}>Save</button>
              <button onClick={() => setCaptionModal(null)} style={{flex:1, background:'transparent', color:'#9ca3af', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, padding:'10px 0', fontSize:14, cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign WO modal */}
      {assignModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:99}}>
          <div style={{background:'#1f2937', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24, width:360, maxWidth:'90%'}}>
            <h3 style={{margin:'0 0 14px', fontSize:17, color:'#e5e7eb'}}>Assign to Work Order</h3>
            <label style={{fontSize:13, color:'#9ca3af', display:'block', marginBottom:6}}>Work Order ID</label>
            <input
              value={assignInput}
              onChange={e => setAssignInput(e.target.value)}
              style={{width:'100%', padding:'10px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, color:'#e5e7eb', fontSize:14, boxSizing:'border-box', marginBottom:16}}
              autoFocus
            />
            <div style={{display:'flex', gap:10}}>
              <button onClick={async () => {
                const wo = assignInput.trim();
                if (!wo) { setAssignModal(null); return; }
                try {
                  await fetch(`/api/workorders/${wo}/photos`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ url: assignModal.url, caption: assignModal.caption }) });
                  const r = await fetch(`/api/photos/${assignModal.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ workOrderId: wo }) });
                  if (r.ok) { const j = await r.json(); setPhotos(prev => prev.map(x => x.id === assignModal.id ? j.photo : x)); }
                } catch (err) { console.error(err); }
                setAssignModal(null);
              }} style={{flex:1, background:'#e5332a', color:'#fff', border:'none', borderRadius:8, padding:'10px 0', fontSize:14, fontWeight:600, cursor:'pointer'}}>Assign</button>
              <button onClick={() => setAssignModal(null)} style={{flex:1, background:'transparent', color:'#9ca3af', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, padding:'10px 0', fontSize:14, cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {photoMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:photoMsg.type==='success'?'#dcfce7':'#fde8e8',color:photoMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {photoMsg.text}
          <button onClick={()=>setPhotoMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}></button>
        </div>
      )}

      {removePhotoId && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}>
          <div style={{background:'#1f2937',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:24,width:360,maxWidth:'90%'}}>
            <h3 style={{margin:'0 0 12px',fontSize:17,color:'#e5e7eb'}}>Remove Photo?</h3>
            <p style={{color:'#9ca3af',fontSize:14,margin:'0 0 20px'}}>This photo will be permanently deleted.</p>
            <div style={{display:'flex',gap:10}}>
              <button onClick={doRemovePhoto} style={{flex:1,background:'#e5332a',color:'#fff',border:'none',borderRadius:8,padding:'10px 0',fontSize:14,fontWeight:600,cursor:'pointer'}}>Remove</button>
              <button onClick={()=>setRemovePhotoId(null)} style={{flex:1,background:'transparent',color:'#9ca3af',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,padding:'10px 0',fontSize:14,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

