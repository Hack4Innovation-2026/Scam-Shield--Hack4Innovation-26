import React, { useState } from 'react';
import { Filter, ShieldCheck, ShieldAlert, AlertTriangle, MessageSquare, Bell } from 'lucide-react';

// Badge for scans the Android app ran automatically on an incoming SMS or notification.
const AutoScanBadge = ({ item }) => {
  const isSms = item.source === 'SMS';
  const Icon = isSms ? MessageSquare : Bell;
  return (
    <span title={item.app || undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem', fontWeight: 600,
      padding: '0.1rem 0.45rem', borderRadius: '999px', background: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
      <Icon size={11} /> {isSms ? 'SMS' : 'Notification'} · auto-scanned
    </span>
  );
};

const HistoryScreen = ({ history, onNavigate }) => {
  const [filter, setFilter] = useState('All'); // All, Scam, Safe, Auto-scanned

  const filteredHistory = history.filter(item => {
    if (filter === 'All') return true;
    if (filter === 'Scam' && item.level === 'scam') return true;
    if (filter === 'Safe' && item.level === 'safe') return true;
    if (filter === 'Auto-scanned' && item.background) return true;
    return false;
  });

  const getIcon = (level) => {
    if (level === 'scam') return <ShieldAlert size={20} className="text-scam" />;
    if (level === 'suspicious') return <AlertTriangle size={20} className="text-warning" />;
    return <ShieldCheck size={20} className="text-safe" />;
  };

  const getColor = (level) => {
    if (level === 'scam') return 'var(--accent-scam)';
    if (level === 'suspicious') return 'var(--accent-warning)';
    return 'var(--accent-safe)';
  };

  return (
    <div className="screen" style={{ paddingBottom: '6rem' }}>
      <div className="app-header">
        <h2 className="header-title" style={{ margin: 0 }}>Scan History</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={20} className="text-secondary" />
          <select 
            className="input-field" 
            style={{ padding: '0.25rem 0.5rem', background: 'transparent', border: '1px solid var(--card-border)', appearance: 'auto', width: 'auto' }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option>All</option>
            <option>Scam</option>
            <option>Safe</option>
            <option>Auto-scanned</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }} className="hide-scrollbar">
        {filteredHistory.length === 0 ? (
          <div className="text-center" style={{ marginTop: '4rem' }}>
            <p className="text-sub">No scans found.</p>
          </div>
        ) : (
          filteredHistory.map((item) => (
            <div 
              key={item.id} 
              className="glass-card" 
              style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', cursor: 'pointer', borderLeft: `3px solid ${getColor(item.level)}` }}
              onClick={() => onNavigate('result', item)}
            >
              <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}>
                {getIcon(item.level)}
              </div>
              
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.background && item.app ? item.app : `${item.source} Scan`}
                  </span>
                  <span className="text-sub" style={{ fontSize: '0.75rem' }}>
                    {new Date(item.date).toLocaleDateString()}
                  </span>
                </div>
                {item.background && <div style={{ marginBottom: '0.25rem' }}><AutoScanBadge item={item} /></div>}
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.intent} - {item.scamType}
                </p>
                {item.urls && item.urls.length > 0 && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    🔗 {item.urls[0]}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '1.25rem', color: getColor(item.level) }}>{item.riskScore}</span>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};

export default HistoryScreen;
