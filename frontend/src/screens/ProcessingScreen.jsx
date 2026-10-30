import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Search, Target, BrainCircuit, ShieldAlert, ScanText, WifiOff } from 'lucide-react';
import { analyzeInput } from '../api/client';

const textSteps = [
  { id: 1, text: "Extracting URLs...", icon: <Search size={20} /> },
  { id: 2, text: "Analyzing behavioral intent...", icon: <Target size={20} /> },
  { id: 3, text: "Running AI risk models...", icon: <BrainCircuit size={20} /> },
  { id: 4, text: "Combining risk signals...", icon: <ShieldAlert size={20} /> }
];
const imageSteps = [{ id: 0, text: "Reading text from screenshot (OCR)...", icon: <ScanText size={20} /> }, ...textSteps];
const urlSteps = [
  { id: 1, text: "Parsing domain...", icon: <Search size={20} /> },
  { id: 2, text: "Checking shorteners, TLDs and IPs...", icon: <ShieldAlert size={20} /> }
];

const STEP_MS = 450;

const ProcessingScreen = ({ data, onComplete, onCancel }) => {
  const steps = data?.type === 'image' ? imageSteps : data?.type === 'url' ? urlSteps : textSteps;
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    // The request runs immediately; the step list is a progress indicator that advances alongside it.
    let cancelled = false;
    const ticker = setInterval(() => setCurrentStep(s => Math.min(s + 1, steps.length - 1)), STEP_MS);
    const minDisplay = new Promise(resolve => setTimeout(resolve, STEP_MS * steps.length));

    Promise.all([analyzeInput(data), minDisplay])
      .then(([result]) => { if (!cancelled) onCompleteRef.current(result); })
      .catch(err => { if (!cancelled) setError(err.message || 'Analysis failed.'); })
      .finally(() => clearInterval(ticker));

    return () => {
      cancelled = true;
      clearInterval(ticker);
    };
  }, [data, attempt, steps.length]);

  const retry = () => {
    setError(null);
    setCurrentStep(0);
    setAttempt(a => a + 1);
  };

  if (error) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', gap: '1.5rem' }}>
        <WifiOff size={64} className="text-scam" />
        <h2 className="text-h2 text-center" style={{ margin: 0 }}>Scan failed</h2>
        <p className="text-sub text-center" style={{ maxWidth: '22rem' }}>{error}</p>
        <button className="btn btn-primary" onClick={retry}>Try again</button>
        <button className="btn btn-secondary" onClick={onCancel}>Back to home</button>
      </div>
    );
  }

  return (
    <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
      
      <div style={{ position: 'relative', marginBottom: '3rem' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '120px', height: '120px', borderRadius: '50%', background: 'var(--primary)', filter: 'blur(40px)', opacity: 0.3 }} className="animate-pulse"></div>
        <Loader2 size={80} className="text-primary animate-spin" style={{ position: 'relative' }} />
      </div>

      <h2 className="text-h2 text-center" style={{ marginBottom: '2rem' }}>Analyzing Request</h2>

      <div className="glass-card" style={{ width: '100%', padding: '1.5rem' }}>
        {steps.map((step, index) => (
          <div 
            key={step.id} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem', 
              marginBottom: index === steps.length - 1 ? '0' : '1rem',
              opacity: index <= currentStep ? 1 : 0.3,
              transform: index === currentStep ? 'scale(1.02)' : 'scale(1)',
              transition: 'all var(--transition-normal)'
            }}
          >
            <div style={{ 
              color: index <= currentStep ? 'var(--primary)' : 'var(--text-secondary)',
              background: index <= currentStep ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              padding: '0.5rem',
              borderRadius: '50%'
            }}>
              {step.icon}
            </div>
            <span style={{ fontWeight: index === currentStep ? 600 : 400 }}>{step.text}</span>
            {index < currentStep && <span style={{ marginLeft: 'auto', color: 'var(--accent-safe)' }}>✓</span>}
            {index === currentStep && <Loader2 size={16} className="animate-spin text-primary" style={{ marginLeft: 'auto' }} />}
          </div>
        ))}
      </div>

      <button className="btn btn-secondary" style={{ marginTop: '2rem' }} onClick={onCancel}>
        Cancel Scan
      </button>

    </div>
  );
};

export default ProcessingScreen;
