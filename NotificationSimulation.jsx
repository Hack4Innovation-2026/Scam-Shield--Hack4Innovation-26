import React from 'react';
import { AlertCircle, X } from 'lucide-react';

const NotificationSimulation = ({ data, onClick, onDismiss }) => {
  if (!data) return null;

  return (
    <div 
      style={{ 
        position: 'absolute', 
        top: '2rem', 
        left: '1rem', 
        right: '1rem', 
        zIndex: 50, 
        padding: '1rem', 
        background: 'rgba(30, 41, 59, 0.95)', 
        backdropFilter: 'blur(12px)',
        borderRadius: 'var(--radius-lg)', 
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem',
        animation: 'fadeIn 0.4s ease-out'
      }}
    >
      <div style={{ background: '#25D366', padding: '0.5rem', borderRadius: '50%', color: 'white', flexShrink: 0 }}>
        {/* Simple mock icon for WhatsApp */}
        <span style={{ fontWeight: 800, fontSize: '0.875rem' }}>WA</span>
      </div>
      
      <div style={{ flex: 1, cursor: 'pointer' }} onClick={onClick}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{data.app} • {data.sender}</span>
          <span className="text-sub" style={{ fontSize: '0.75rem' }}>Now</span>
        </div>
        <p style={{ fontSize: '0.875rem', lineHeight: '1.4', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {data.text}
        </p>
        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600 }}>
          <AlertCircle size={14} /> Scam Shield: Suspicious Link Detected. Tap to Scan.
        </div>
      </div>

      <button 
        onClick={(e) => { e.stopPropagation(); onDismiss(); }} 
        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem', marginTop: '-0.25rem', marginRight: '-0.25rem' }}
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default NotificationSimulation;
