import React from 'react';
import { ShieldQuestion, Mail, Bell, Image as ImageIcon, Search, Lock, ShieldCheck, Zap } from 'lucide-react';

const HomeScreen = ({ onNavigate, history, privacyMode }) => {
  const scansCount = history.length;
  const scamsCount = history.filter(h => h.level === 'scam').length;

  return (
    <div className="screen hide-scrollbar" style={{ paddingBottom: '5rem', position: 'relative' }}>
      
      <div className="app-header" style={{ borderBottom: 'none', paddingTop: '1.5rem', paddingLeft: '3.5rem' }}>
        <div>
          <h2 className="text-h2" style={{ marginBottom: '0.25rem' }}>Welcome back</h2>
          <p className="text-sub">Stay safe online today</p>
        </div>
        <div style={{ background: 'var(--card-bg)', padding: '0.5rem', borderRadius: '50%' }}>
          <UserAvatar />
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        {(privacyMode) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-full)', color: 'var(--accent-safe)', fontSize: '0.75rem', marginBottom: '1.5rem', width: 'fit-content' }}>
            <Lock size={14} />
            <span>Privacy Mode Active: Data is not stored</span>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid-2" style={{ marginBottom: '2rem' }}>
        <div className="glass-card text-center" style={{ padding: '1rem', boxShadow: 'var(--shadow-md)' }}>
          <p className="text-h1" style={{ fontSize: '2.5rem', marginBottom: '0' }}>{scansCount}</p>
          <p className="text-sub">Total Scans</p>
        </div>
        <div className="glass-card text-center" style={{ padding: '1rem', boxShadow: 'var(--shadow-md)' }}>
          <p className="text-h1 text-scam" style={{ fontSize: '2.5rem', marginBottom: '0', background: 'none' }}>{scamsCount}</p>
          <p className="text-sub">Threats Found</p>
        </div>
      </div>

      {/* Main Actions */}
      <div>
        <h3 className="text-h3" style={{ marginBottom: '1rem' }}>Protection Tools</h3>
        <div className="grid-2" style={{ gap: '1rem', marginBottom: '2rem' }}>
          <ActionCard 
            icon={<Search size={24} className="text-primary" />} 
            title="Scan Text/Link" 
            desc="Check SMS & URLs" 
            onClick={() => onNavigate('scan', { tab: 'text' })}
          />
          <ActionCard 
            icon={<Mail size={24} style={{ color: '#8b5cf6' }} />} 
            title="Scan Email" 
            desc="Analyze senders" 
            onClick={() => onNavigate('scan', { tab: 'email' })}
          />
          <ActionCard 
            icon={<Bell size={24} className="text-warning" />} 
            title="Notifications" 
            desc="Auto-scanner" 
            onClick={() => onNavigate('scan', { tab: 'text' })}
          />
          <ActionCard 
            icon={<ImageIcon size={24} className="text-safe" />} 
            title="Scan Image" 
            desc="Extract & Check Text" 
            onClick={() => onNavigate('scan', { tab: 'image' })}
          />
        </div>
      </div>

      {/* Recent History Snippet */}
      {history.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="text-h3" style={{ margin: 0 }}>Recent Scans</h3>
            <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: 'none' }} onClick={() => onNavigate('history')}>See All</button>
          </div>
          <div className="glass-card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <ShieldQuestion className={history[0].level === 'scam' ? 'text-scam' : history[0].level === 'suspicious' ? 'text-warning' : 'text-safe'} />
             <div style={{ flex: 1, overflow: 'hidden' }}>
               <p style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{history[0].source}</p>
               <p className="text-sub" style={{ fontSize: '0.75rem' }}>{history[0].intent}</p>
             </div>
             <p style={{ fontWeight: 600, fontSize: '1.25rem' }} className={history[0].level === 'scam' ? 'text-scam' : history[0].level === 'suspicious' ? 'text-warning' : 'text-safe'}>{history[0].riskScore}</p>
          </div>
        </>
      )}

    </div>
  );
};

const ActionCard = ({ icon, title, desc, onClick }) => (
  <button onClick={onClick} className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--card-border)' }}>
    <div style={{ padding: '0.5rem', background: 'rgba(128, 128, 128, 0.1)', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem' }}>
      {icon}
    </div>
    <span style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{title}</span>
    <span className="text-sub" style={{ fontSize: '0.75rem' }}>{desc}</span>
  </button>
);

const UserAvatar = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

export default HomeScreen;
