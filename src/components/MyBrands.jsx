// src/components/MyBrands.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function BrandCard({ project, onOpen, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm('이 브랜드를 삭제할까요?')) return;
    setDeleting(true);
    await onDelete(project.id);
  };

  const date = new Date(project.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric'
  });

  return (
    <div style={s.card} onClick={() => onOpen(project)}>
      {/* 썸네일 */}
      <div style={s.thumb}>
        {project.thumbUrl ? (
          <img src={project.thumbUrl} alt={project.brandName}
            style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <div style={s.thumbEmpty}>✦</div>
        )}
        {project.isPublic && (
          <div style={s.sharedBadge}>공유중</div>
        )}
      </div>

      {/* 정보 */}
      <div style={s.info}>
        <div style={s.brandName}>{project.brandName || '(브랜드명 없음)'}</div>
        <p style={s.concept}>{project.storeConcept || ''}</p>
        <div style={s.meta}>
          <span style={s.category}>{project.category || ''}</span>
          <span style={s.dot}>·</span>
          <span style={s.district}>{project.district || ''}</span>
          <span style={s.dot}>·</span>
          <span style={s.date}>{date}</span>
        </div>
      </div>

      {/* 삭제 버튼 */}
      <button
        style={{ ...s.deleteBtn, opacity: deleting ? 0.5 : 1 }}
        onClick={handleDelete}
        disabled={deleting}
        title="삭제"
      >
        {deleting ? '...' : '✕'}
      </button>
    </div>
  );
}

export default function MyBrands({ user, onOpenProject, onBack }) {
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const fetchProjects = async () => {
    setLoading(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setError('로그인이 필요합니다.'); return; }

      const res = await fetch(
        '/.netlify/functions/bb-projects?action=list',
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '목록 조회 실패');
      setProjects(data.projects || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleDelete = async (projectId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch(
        `/.netlify/functions/bb-projects?action=delete&projectId=${projectId}`,
        { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }
      );
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } catch (e) {
      alert('삭제 실패: ' + e.message);
    }
  };

  const handleOpen = async (project) => {
    // 상세 데이터 조회 후 결과 화면으로 복원
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `/.netlify/functions/bb-projects?action=detail&projectId=${project.id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      onOpenProject(data.project);
    } catch (e) {
      alert('불러오기 실패: ' + e.message);
    }
  };

  return (
    <div style={s.wrap}>
      {/* 헤더 */}
      <div style={s.header}>
        <div>
          <h2 style={s.title}>내 브랜드</h2>
          <p style={s.subtitle}>저장된 브랜드 결정안 {projects.length}개</p>
        </div>
        <button style={s.backBtn} onClick={onBack}>← 돌아가기</button>
      </div>

      {/* 내용 */}
      {loading ? (
        <div style={s.center}>
          <div style={s.spinner} />
          <p style={s.loadTxt}>불러오는 중...</p>
        </div>
      ) : error ? (
        <div style={s.errorBox}>
          <p style={s.errorTxt}>{error}</p>
          <button style={s.retryBtn} onClick={fetchProjects}>다시 시도</button>
        </div>
      ) : projects.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon}>✦</div>
          <p style={s.emptyTxt}>저장된 브랜드가 없어요</p>
          <p style={s.emptyDesc}>브랜드 결정안을 생성하고 저장해보세요</p>
          <button style={s.newBtn} onClick={onBack}>새 브랜드 만들기</button>
        </div>
      ) : (
        <div style={s.grid}>
          {projects.map(p => (
            <BrandCard
              key={p.id}
              project={p}
              onOpen={handleOpen}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  wrap:       { width:'100%', maxWidth:1060, margin:'0 auto', paddingTop:32 },
  header:     { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 },
  title:      { margin:'0 0 4px', fontSize:28, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.03em' },
  subtitle:   { margin:0, fontSize:14, color:'var(--text-tertiary)', fontWeight:500 },
  backBtn:    { padding:'10px 20px', borderRadius:'var(--radius-full)', border:'1px solid var(--border)', background:'var(--white)', color:'var(--text-secondary)', fontSize:14, fontWeight:600, cursor:'pointer', flexShrink:0 },

  grid:       { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 },

  card:       { background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden', cursor:'pointer', boxShadow:'var(--shadow-sm)', transition:'transform 0.15s, box-shadow 0.15s', position:'relative', display:'flex', flexDirection:'column' },
  thumb:      { width:'100%', aspectRatio:'16/9', background:'var(--purple-50)', overflow:'hidden', position:'relative', flexShrink:0 },
  thumbEmpty: { width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, color:'var(--purple-600)', opacity:0.3 },
  sharedBadge:{ position:'absolute', top:8, left:8, background:'#6D28D9', color:'#fff', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:'var(--radius-full)' },

  info:       { padding:'14px 16px 12px', flex:1 },
  brandName:  { fontSize:17, fontWeight:800, color:'var(--text-primary)', marginBottom:4, letterSpacing:'-0.02em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  concept:    { margin:'0 0 10px', fontSize:13, color:'var(--text-secondary)', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' },
  meta:       { display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' },
  category:   { fontSize:12, color:'var(--purple-600)', fontWeight:600, background:'var(--purple-50)', padding:'2px 8px', borderRadius:'var(--radius-full)' },
  dot:        { fontSize:12, color:'var(--text-tertiary)' },
  district:   { fontSize:12, color:'var(--text-tertiary)', fontWeight:500 },
  date:       { fontSize:12, color:'var(--text-tertiary)' },

  deleteBtn:  { position:'absolute', top:8, right:8, width:26, height:26, borderRadius:'50%', border:'none', background:'rgba(0,0,0,0.45)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2 },

  center:     { display:'flex', flexDirection:'column', alignItems:'center', padding:'80px 0', gap:16 },
  spinner:    { width:36, height:36, border:'3px solid var(--border)', borderTopColor:'var(--purple-600)', borderRadius:'50%', animation:'spin 0.8s linear infinite' },
  loadTxt:    { fontSize:14, color:'var(--text-secondary)' },

  errorBox:   { textAlign:'center', padding:'60px 0' },
  errorTxt:   { fontSize:14, color:'#9F1239', marginBottom:16 },
  retryBtn:   { padding:'10px 24px', borderRadius:'var(--radius-full)', border:'1px solid var(--border)', background:'var(--white)', color:'var(--text-secondary)', fontSize:14, fontWeight:600, cursor:'pointer' },

  empty:      { textAlign:'center', padding:'80px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:8 },
  emptyIcon:  { fontSize:40, color:'var(--purple-600)', opacity:0.3, marginBottom:8 },
  emptyTxt:   { margin:0, fontSize:18, fontWeight:700, color:'var(--text-primary)' },
  emptyDesc:  { margin:0, fontSize:14, color:'var(--text-tertiary)' },
  newBtn:     { marginTop:16, padding:'12px 28px', borderRadius:'var(--radius-full)', border:'none', background:'#6D28D9', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px rgba(109,40,217,0.25)' },
};
