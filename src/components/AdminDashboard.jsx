import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_EMAILS = [
  'qoanswls09@gmail.com',
  'qoanswls81@gmail.com',
  'qoanswls@naver.com',
];

const PLAN_COLORS = {
  FREE:    { bg:'#F3F4F6', text:'#6B7280', label:'FREE' },
  STARTER: { bg:'#EEF2FF', text:'#4F46E5', label:'STARTER' },
  PRO:     { bg:'#F0FDF4', text:'#16A34A', label:'PRO' },
  STUDIO:  { bg:'#FFF7ED', text:'#EA580C', label:'STUDIO' },
};

function StatCard({ label, value, sub, subColor, icon, accent }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, padding:'20px 22px', display:'flex', flexDirection:'column', gap:6, borderTop:`3px solid ${accent||'#7F77DD'}` }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:12, color:'#9CA3AF', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' }}>{label}</div>
        <div style={{ fontSize:20 }}>{icon}</div>
      </div>
      <div style={{ fontSize:28, fontWeight:900, color:'#111', letterSpacing:'-0.02em' }}>{value?.toLocaleString() ?? '-'}</div>
      {sub && <div style={{ fontSize:12, color: subColor||'#6B7280', fontWeight:500 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ data, maxVal, color }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:48 }}>
      {data.map((v, i) => {
        const h = maxVal > 0 ? Math.max(4, Math.round((v / maxVal) * 48)) : 4;
        return (
          <div key={i} title={v} style={{ flex:1, height:h, background: color||'#7F77DD', borderRadius:'3px 3px 0 0', opacity: i === data.length-1 ? 1 : 0.4 + (i / data.length) * 0.5 }}/>
        );
      })}
    </div>
  );
}

export default function AdminDashboard({ user, onBack }) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [tab,     setTab]     = useState('overview'); // overview | users | brands
  const pollRef = useRef(null);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  const fetchStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/.netlify/functions/admin-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '통계 로딩 실패');
      setStats(data);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchStats();
    pollRef.current = setInterval(fetchStats, 60000); // 1분마다 자동 갱신
    return () => clearInterval(pollRef.current);
  }, [isAdmin]);

  if (!isAdmin) return (
    <div style={{ textAlign:'center', padding:'80px 20px' }}>
      <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
      <div style={{ fontSize:20, fontWeight:700, color:'#111', marginBottom:8 }}>접근 권한이 없어요</div>
      <div style={{ fontSize:14, color:'#6B7280', marginBottom:24 }}>관리자 계정으로 로그인해주세요</div>
      <button onClick={onBack} style={btn.secondary}>← 돌아가기</button>
    </div>
  );

  if (loading) return (
    <div style={{ textAlign:'center', padding:'80px 20px' }}>
      <div style={{ width:40, height:40, border:'3px solid #E5E7EB', borderTopColor:'#7F77DD', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }}/>
      <div style={{ fontSize:14, color:'#6B7280' }}>통계 불러오는 중...</div>
    </div>
  );

  if (error) return (
    <div style={{ textAlign:'center', padding:'80px 20px' }}>
      <div style={{ fontSize:14, color:'#DC2626', marginBottom:16 }}>⚠ {error}</div>
      <button onClick={fetchStats} style={btn.primary}>다시 시도</button>
    </div>
  );

  const { users, brands, dailyStats, generatedAt } = stats || {};
  const signupTrend  = (dailyStats||[]).map(d => d.signups);
  const brandTrend   = (dailyStats||[]).map(d => d.brands);
  const maxSignup    = Math.max(...signupTrend, 1);
  const maxBrand     = Math.max(...brandTrend, 1);
  const signupDelta  = (users?.today||0) - (users?.yesterday||0);
  const brandDelta   = (brands?.today||0) - (brands?.yesterday||0);

  const planOrder = ['FREE','STARTER','PRO','STUDIO'];
  const totalPlanUsers = Object.values(users?.byPlan||{}).reduce((a,b)=>a+b,0)||1;

  return (
    <div style={{ maxWidth:1000, margin:'0 auto', padding:'32px 20px 80px' }}>
      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#7F77DD', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>BRANDBOSS ADMIN</div>
          <h1 style={{ fontSize:24, fontWeight:900, color:'#111', margin:0, letterSpacing:'-0.02em' }}>관리자 대시보드</h1>
          {generatedAt && <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>마지막 갱신: {new Date(generatedAt).toLocaleTimeString('ko-KR')} · 1분마다 자동 갱신</div>}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={fetchStats} style={btn.icon} title="새로고침">🔄</button>
          <button onClick={onBack} style={btn.secondary}>← 나가기</button>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display:'flex', gap:6, marginBottom:24, background:'#F9FAFB', borderRadius:10, padding:4, width:'fit-content' }}>
        {[['overview','📊 개요'],['users','👥 사용자'],['brands','🏷 브랜드']].map(([k,label])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ padding:'7px 16px', borderRadius:8, border:'none', background: tab===k?'#fff':'transparent', color: tab===k?'#111':'#6B7280', fontSize:13, fontWeight: tab===k?700:500, cursor:'pointer', boxShadow: tab===k?'0 1px 4px rgba(0,0,0,0.08)':'' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 개요 탭 ── */}
      {tab === 'overview' && (
        <>
          {/* 핵심 지표 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12, marginBottom:24 }}>
            <StatCard label="전체 가입자" value={users?.total} icon="👥" accent="#7F77DD"
              sub={`오늘 +${users?.today||0} · 어제 대비 ${signupDelta>=0?'+':''}${signupDelta}`}
              subColor={signupDelta>0?'#16A34A':signupDelta<0?'#DC2626':'#6B7280'}/>
            <StatCard label="이번 달 신규" value={users?.thisMonth} icon="📅" accent="#6366F1"
              sub="이번 달 가입한 신규 유저"/>
            <StatCard label="전체 브랜드 생성" value={brands?.total} icon="🏷" accent="#9333EA"
              sub={`오늘 +${brands?.today||0} · 어제 대비 ${brandDelta>=0?'+':''}${brandDelta}`}
              subColor={brandDelta>0?'#16A34A':brandDelta<0?'#DC2626':'#6B7280'}/>
            <StatCard label="이번 달 브랜드" value={brands?.thisMonth} icon="✨" accent="#EC4899"
              sub={`공유중 ${brands?.shared||0}개`}/>
          </div>

          {/* 7일 추이 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
            <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, padding:'18px 20px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#9CA3AF', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:14 }}>최근 7일 신규 가입</div>
              <MiniBar data={signupTrend} maxVal={maxSignup} color="#7F77DD"/>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
                {(dailyStats||[]).map((d,i)=>(
                  <div key={i} style={{ fontSize:10, color:'#9CA3AF', textAlign:'center' }}>
                    {d.date.slice(5)}<br/><strong style={{color:'#111'}}>{d.signups}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, padding:'18px 20px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#9CA3AF', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:14 }}>최근 7일 브랜드 생성</div>
              <MiniBar data={brandTrend} maxVal={maxBrand} color="#9333EA"/>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
                {(dailyStats||[]).map((d,i)=>(
                  <div key={i} style={{ fontSize:10, color:'#9CA3AF', textAlign:'center' }}>
                    {d.date.slice(5)}<br/><strong style={{color:'#111'}}>{d.brands}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 플랜별 분포 */}
          <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, padding:'18px 20px', marginBottom:24 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#9CA3AF', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:16 }}>플랜별 사용자 분포</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {planOrder.map(plan => {
                const count = (users?.byPlan||{})[plan] || 0;
                const pct   = Math.round(count / totalPlanUsers * 100);
                const c     = PLAN_COLORS[plan] || PLAN_COLORS.FREE;
                return (
                  <div key={plan} style={{ background:c.bg, borderRadius:10, padding:'14px 16px', textAlign:'center' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:c.text, marginBottom:6 }}>{c.label}</div>
                    <div style={{ fontSize:24, fontWeight:900, color:c.text }}>{count}</div>
                    <div style={{ fontSize:11, color:c.text, marginTop:4 }}>{pct}%</div>
                    {/* 미니 바 */}
                    <div style={{ height:4, background:'rgba(0,0,0,0.08)', borderRadius:999, marginTop:8, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:c.text, borderRadius:999, transition:'width 0.5s ease' }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* API 사용량 안내 */}
          <div style={{ background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:12, padding:'18px 20px' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#9CA3AF', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:12 }}>API 사용량 확인</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <a href="https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas" target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'#fff', borderRadius:8, border:'1px solid #E5E7EB', textDecoration:'none', color:'#111' }}>
                <span style={{ fontSize:20 }}>🤖</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700 }}>Gemini (Google Cloud)</div>
                  <div style={{ fontSize:11, color:'#6B7280' }}>API 쿼터 및 사용량 확인 →</div>
                </div>
              </a>
              <a href="https://api.bfl.ai" target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'#fff', borderRadius:8, border:'1px solid #E5E7EB', textDecoration:'none', color:'#111' }}>
                <span style={{ fontSize:20 }}>🖼</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700 }}>Flux (BFL.ai)</div>
                  <div style={{ fontSize:11, color:'#6B7280' }}>크레딧 잔량 및 사용량 확인 →</div>
                </div>
              </a>
            </div>
          </div>
        </>
      )}

      {/* ── 사용자 탭 ── */}
      {tab === 'users' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:20 }}>
            <StatCard label="전체 가입자" value={users?.total}    icon="👥" accent="#7F77DD"/>
            <StatCard label="오늘 신규"   value={users?.today}    icon="🆕" accent="#10B981"/>
            <StatCard label="이번 달"     value={users?.thisMonth} icon="📅" accent="#6366F1"/>
          </div>

          <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #F3F4F6', fontSize:13, fontWeight:700, color:'#111' }}>
              최근 가입자 10명
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#F9FAFB' }}>
                  {['이메일','플랜','가입일'].map(h=>(
                    <th key={h} style={{ padding:'10px 16px', fontSize:11, fontWeight:700, color:'#9CA3AF', textAlign:'left', letterSpacing:'0.06em', textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(users?.latest||[]).map((u, i) => {
                  const plan = u.plan || 'FREE';
                  const c    = PLAN_COLORS[plan] || PLAN_COLORS.FREE;
                  return (
                    <tr key={i} style={{ borderTop:'1px solid #F3F4F6' }}>
                      <td style={{ padding:'12px 16px', fontSize:13, color:'#111' }}>{u.email || '-'}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ padding:'3px 10px', borderRadius:999, background:c.bg, color:c.text, fontSize:11, fontWeight:700 }}>{c.label}</span>
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:12, color:'#6B7280' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── 브랜드 탭 ── */}
      {tab === 'brands' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:20 }}>
            <StatCard label="전체 생성"   value={brands?.total}    icon="🏷" accent="#9333EA"/>
            <StatCard label="오늘 생성"   value={brands?.today}    icon="✨" accent="#10B981"/>
            <StatCard label="이번 달"     value={brands?.thisMonth} icon="📅" accent="#6366F1"/>
            <StatCard label="공유중"      value={brands?.shared}    icon="🔗" accent="#F59E0B"/>
          </div>

          <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, padding:'18px 20px' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:16 }}>일별 브랜드 생성 추이 (최근 7일)</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(dailyStats||[]).map((d, i) => {
                const pct = brands?.total > 0 ? Math.min(100, Math.round(d.brands / Math.max(...brandTrend, 1) * 100)) : 0;
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ fontSize:12, color:'#6B7280', width:50, flexShrink:0 }}>{d.date.slice(5)}</div>
                    <div style={{ flex:1, height:20, background:'#F3F4F6', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:'#9333EA', borderRadius:4, transition:'width 0.5s ease' }}/>
                    </div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#111', width:30, textAlign:'right' }}>{d.brands}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const btn = {
  primary:   { padding:'9px 20px', borderRadius:8, border:'none', background:'#7F77DD', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' },
  secondary: { padding:'9px 16px', borderRadius:8, border:'1px solid #E5E7EB', background:'#fff', color:'#374151', fontSize:13, fontWeight:600, cursor:'pointer' },
  icon:      { padding:'9px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'#fff', fontSize:16, cursor:'pointer' },
};
