import React, { useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, ShieldCheck, Link as LinkIcon, AlertCircle, ArrowLeft, BarChart3, ScanText, MessageSquare, Bell } from 'lucide-react';

const CircularProgress = ({ score, color }) => {
  const dashArray = 283;
  const dashOffset = dashArray - (dashArray * score) / 100;

  return (
    <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <svg className="progress-ring" width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
        <circle stroke="var(--card-border)" strokeWidth="8" fill="transparent" r="45" cx="60" cy="60" />
        <circle 
          stroke={color} 
          strokeWidth="8" 
          strokeDasharray={dashArray} 
          strokeDashoffset={dashOffset} 
          strokeLinecap="round" 
          fill="transparent" 
          r="45" 
          cx="60" 
          cy="60" 
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: '2rem', fontWeight: 'bold' }}>{score}</span>
        <span className="text-sub" style={{ fontSize: '0.75rem' }}>/100</span>
      </div>
    </div>
  );
};

const ResultScreen = ({ result, onNavigate }) => {
  const [showScore, setShowScore] = useState(0);

  useEffect(() => {
    // Animate score from 0 to actual
    if (result) {
      const timer = setTimeout(() => {
        setShowScore(result.riskScore);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [result]);

  if (!result) return null;

  const isScam = result.level === 'scam';
  const isSuspicious = result.level === 'suspicious';
  const signals = result.signals || {};
  const signalRows = [
    { key: 'url', label: 'Link analysis' },
    { key: 'behavioral', label: 'Behavioural patterns' },
    { key: 'ml', label: 'ML text model' },
  ].filter(row => signals[row.key] !== null && signals[row.key] !== undefined);

  const color = isScam ? 'var(--accent-scam)' : (isSuspicious ? 'var(--accent-warning)' : 'var(--accent-safe)');
  const bgGlow = isScam ? 'var(--shadow-glow-scam)' : (isSuspicious ? 'var(--shadow-glow-warning)' : 'var(--shadow-glow-safe)');
  
  const Icon = isScam ? ShieldAlert : (isSuspicious ? AlertTriangle : ShieldCheck);

  return (
    <div className="screen">
      <div className="app-header">
        <button className="back-btn" onClick={() => onNavigate('home')}>
             <ArrowLeft size={24} />
        </button>
        <h2 className="header-title">Scan Result</h2>
        <button className="back-btn" style={{ visibility: 'hidden' }}><ArrowLeft /></button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.5rem', marginBottom: '1rem', width: '100%' }}>
          <div style={{ boxShadow: bgGlow, borderRadius: '50%', background: 'var(--card-bg)' }}>
            <CircularProgress score={showScore} color={color} />
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Icon color={color} size={24} />
          <h1 className="text-h1" style={{ color: color, background: 'none', margin: 0, textTransform: 'capitalize' }}>
            {result.level}
          </h1>
        </div>
        
        <p className="text-sub">Confidence: <span style={{ color: 'var(--text-primary)' }}>{result.confidence}</span> • Type: <span style={{ color: 'var(--text-primary)' }}>{result.scamType}</span></p>
      </div>

      {signalRows.length > 0 && (
        <div className="glass-card" style={{ marginBottom: '1rem' }}>
          <h3 className="text-h3" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={16} className="text-primary" /> Risk signals
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
            {signalRows.map(row => (
              <div key={row.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  <span className="text-sub">{row.label}{row.key === 'ml' && result.mlCategory ? ` (${result.mlCategory})` : ''}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{Math.round(signals[row.key])}</span>
                </div>
                <div style={{ height: '6px', background: 'var(--input-bg)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, signals[row.key])}%`, height: '100%', background: color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.background && (
        <div className="glass-card" style={{ marginBottom: '1rem' }}>
          <h3 className="text-h3" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {result.source === 'SMS' ? <MessageSquare size={16} className="text-primary" /> : <Bell size={16} className="text-primary" />}
            Auto-scanned {result.source === 'SMS' ? 'SMS' : 'notification'}
          </h3>
          <p className="text-sub" style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>
            {result.app ? `From ${result.app}` : 'Incoming message'}{result.date ? ` · ${new Date(result.date).toLocaleString()}` : ''}
          </p>
          {result.scannedText && (
            <p style={{ fontSize: '0.85rem', lineHeight: '1.5', marginTop: '0.5rem', padding: '0.6rem', background: 'var(--input-bg)', borderRadius: 'var(--radius-sm)', wordBreak: 'break-word', color: 'var(--text-primary)' }}>
              {result.scannedText}
            </p>
          )}
        </div>
      )}

      {result.extractedText && (
        <div className="glass-card" style={{ marginBottom: '1rem' }}>
          <h3 className="text-h3" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ScanText size={16} className="text-primary" /> Text read from screenshot
          </h3>
          <p className="text-sub" style={{ fontSize: '0.8rem', lineHeight: '1.5', marginTop: '0.5rem', wordBreak: 'break-word' }}>{result.extractedText}</p>
        </div>
      )}

      <div className="glass-card" style={{ marginBottom: '1rem' }}>
        <h3 className="text-h3" style={{ fontSize: '1rem' }}>Analysis Details</h3>
        <p className="text-sub" style={{ marginBottom: '0.5rem', lineHeight: '1.5' }}>
          {result.reason}
        </p>
        
        {result.intent && result.intent.toLowerCase() !== 'neutral' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', padding: '0.5rem', background: 'var(--input-bg)', borderRadius: 'var(--radius-sm)' }}>
            <Target size={16} className="text-warning" />
             <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Intent: {result.intent}</span>
          </div>
        )}

        {result.urls && result.urls.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <LinkIcon size={16} /> Detected URLs
            </h4>
            {result.urls.map((url, i) => (
              <div key={i} style={{ padding: '0.5rem', background: 'var(--input-bg)', borderRadius: 'var(--radius-sm)', wordBreak: 'break-all', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                {url}
              </div>
            ))}
            {result.urlFlags && result.urlFlags.length > 0 && (
              <div style={{ marginTop: '0.5rem', padding: '0.5rem', borderLeft: '3px solid var(--accent-scam)', background: 'rgba(239, 68, 68, 0.1)', fontSize: '0.75rem', color: 'var(--accent-scam)' }}>
                {result.urlFlags.map((flag, i) => <div key={i}>⚠️ {flag}</div>)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="glass-card" style={{ marginBottom: '2rem', borderLeft: `3px solid ${color}` }}>
        <h3 className="text-h3" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} /> Recommendation
        </h3>
        <p style={{ fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>{result.advice}</p>
      </div>

      {/* Action Panel */}
      <h3 className="text-h3" style={{ fontSize: '1rem', marginBottom: '1rem' }}>Take Action</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
        
        {isScam && (
          <button className="btn btn-danger" onClick={() => alert("Block the sender from your messaging app's contact options.")}>
            Block Sender
          </button>
        )}
        
        {result.report.reportRecommended && (
          <button className="btn btn-primary" style={{ background: '#8b5cf6' }} onClick={() => onNavigate('report')}>
            Report Scam
          </button>
        )}
        
        <button className="btn btn-secondary" onClick={() => onNavigate('home')}>
          Ignore & Return Home
        </button>
        
      </div>
    </div>
  );
};
  
// Helper Icon Component since Target isn't imported from lucide-react in this file
const Target = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
)

export default ResultScreen;
