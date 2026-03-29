import React, { useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, ShieldCheck, Link as LinkIcon, AlertCircle, ArrowLeft, Zap, ScanFace, Users, BadgeCheck } from 'lucide-react';

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
    if (result && !result.isELA) {
      const timer = setTimeout(() => {
        setShowScore(result.riskScore);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [result]);

  if (!result) return null;

  const isScam = result.level === 'scam';
  const isSuspicious = result.level === 'suspicious';
  const isSMS = result.source === 'SMS';
  const isCall = result.source === 'Phone Call';
  const isELA = result.isELA;
  
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
          {!isELA && (
            <div style={{ boxShadow: bgGlow, borderRadius: '50%', background: 'var(--card-bg)' }}>
              <CircularProgress score={showScore} color={color} />
            </div>
          )}
          
          {isELA && (
            <div style={{ padding: '1.5rem', background: 'var(--card-bg)', border: `2px dashed ${color}`, borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', boxShadow: bgGlow, width: '100%' }}>
              
              {result.elaImageBase64 ? (
                 <img 
                    src={`data:image/png;base64,${result.elaImageBase64}`} 
                    alt="ELA Map" 
                    style={{ width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }} 
                 />
              ) : (
                 <ScanFace size={36} color={color} />
              )}
              
              <h3 className="text-h3" style={{ margin: 0, color: color, fontSize: '0.9rem', textAlign: 'center' }}>Forensic ELA</h3>
              <p className="text-sub text-center" style={{ fontSize: '0.65rem' }}>
                Highlighted variance map of compression signatures. Glowing areas indicate potential manipulation.
              </p>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Icon color={color} size={24} />
          <h1 className="text-h1" style={{ color: color, background: 'none', margin: 0, textTransform: 'capitalize' }}>
            {isELA && isScam ? 'Manipulation Detected' : result.level}
          </h1>
        </div>
        
        <p className="text-sub">Confidence: <span style={{ color: 'var(--text-primary)' }}>{result.confidence}</span> • Type: <span style={{ color: 'var(--text-primary)' }}>{result.scamType}</span></p>
      </div>

      {isSMS && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
          <Zap size={20} className="text-primary" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0 }}>High Efficiency SMS Analysis</p>
            <p className="text-sub" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>This message was successfully verified against 1.2M+ known phishing patterns and behavioral heuristics in under 200ms.</p>
          </div>
        </div>
      )}

      {isCall && result.socialGraph && (
        <div className="glass-card" style={{ marginBottom: '1rem', borderTop: '3px solid #3b82f6' }}>
          <h3 className="text-h3" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={16} className="text-primary" /> Global Social Graph Sync
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-sub" style={{ fontSize: '0.875rem' }}>Verified Caller ID</span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {result.socialGraph.verifiedName} 
                {!isScam && <BadgeCheck size={14} className="text-primary" />}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-sub" style={{ fontSize: '0.875rem' }}>Location</span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{result.socialGraph.location}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-sub" style={{ fontSize: '0.875rem' }}>Network Provider</span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{result.socialGraph.carrier}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--input-bg)', borderRadius: 'var(--radius-sm)' }}>
              <span className="text-sub" style={{ fontSize: '0.875rem' }}>Community Spam Reports</span>
              <span className={result.socialGraph.spamReports > 10 ? 'text-scam' : 'text-safe'} style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                {result.socialGraph.spamReports} Reports
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card" style={{ marginBottom: '1rem' }}>
        <h3 className="text-h3" style={{ fontSize: '1rem' }}>Analysis Details</h3>
        <p className="text-sub" style={{ marginBottom: '0.5rem', lineHeight: '1.5' }}>
          {isELA ? result.elaMessage : result.reason}
        </p>
        
        {!isELA && result.intent !== 'Neutral' && (
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
          <button className="btn btn-danger" onClick={() => alert("Sender Blocked (Simulated)")}>
            Block {isCall ? 'Number' : (isELA ? 'Source' : 'Sender')}
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
