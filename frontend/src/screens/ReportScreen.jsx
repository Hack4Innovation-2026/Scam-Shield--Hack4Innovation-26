import React, { useState } from 'react';
import { ShieldAlert, ArrowLeft, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';

const ReportScreen = ({ result, onNavigate }) => {
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(result.report.reportSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="screen">
      <div className="app-header">
        <button className="back-btn" onClick={() => onNavigate('result', result)}>
             <ArrowLeft size={24} />
        </button>
        <h2 className="header-title">Report Incident</h2>
        <div style={{ width: 24 }}></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '2rem', marginTop: '1rem' }}>
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
          <ShieldAlert size={48} className="text-scam" />
        </div>
        <h2 className="text-h2" style={{ marginBottom: '0.5rem' }}>Official Cybercrime Portal</h2>
        <p className="text-sub">Help protect others by reporting this incident to the authorities.</p>
      </div>

      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h3 className="text-h3" style={{ fontSize: '1rem', marginBottom: '1rem' }}>Generated Summary</h3>
        <div style={{ 
          background: 'rgba(0,0,0,0.3)', 
          padding: '1rem', 
          borderRadius: 'var(--radius-md)', 
          fontSize: '0.875rem', 
          lineHeight: '1.5',
          fontFamily: 'monospace',
          color: 'var(--text-primary)',
          marginBottom: '1rem'
        }}>
          {result.report.reportSummary}
        </div>
        
        <button className="btn btn-secondary" onClick={handleCopy} style={{ padding: '0.5rem' }}>
          {copied ? <CheckCircle2 size={16} className="text-safe" /> : <Copy size={16} />}
          {copied ? 'Copied' : 'Copy Summary'}
        </button>
      </div>

      <div className="glass-card" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
        <h3 className="text-h3" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>National Cyber Crime Reporting</h3>
        <p className="text-sub" style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          You will be redirected to the official government portal. Your pre-generated summary will help speed up the process.
        </p>
        
        {/* Placeholder for actual Gateway integration */}
        {/* // TODO: connect to backend API for automated reporting / analytics log */}
        <a 
          href={result.report.reportLink} 
          target="_blank" 
          rel="noreferrer"
          className="btn btn-primary" 
          style={{ textDecoration: 'none', background: '#8b5cf6' }}
        >
          Open Cybercrime Portal <ExternalLink size={18} />
        </a>
      </div>

      <button className="btn btn-secondary" style={{ marginTop: 'auto' }} onClick={() => onNavigate('home')}>
        Return to Home
      </button>

    </div>
  );
};

export default ReportScreen;
