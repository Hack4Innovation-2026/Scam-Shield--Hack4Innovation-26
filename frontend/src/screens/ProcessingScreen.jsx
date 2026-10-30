import React, { useEffect, useState } from 'react';
import { Loader2, Search, Target, BrainCircuit, ShieldAlert } from 'lucide-react';
import { analyzeInput } from '../utils/mockEngine';

const steps = [
  { id: 1, text: "Masking sensitive PII data...", icon: <ShieldAlert size={20} /> },
  { id: 2, text: "Extracting URLs...", icon: <Search size={20} /> },
  { id: 3, text: "Analyzing behavioral intent...", icon: <Target size={20} /> },
  { id: 4, text: "Running AI risk models...", icon: <BrainCircuit size={20} /> }
];

const ProcessingScreen = ({ data, onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Simulate backend processing pipeline
    let stepTimer;
    let finishTimer;

    const runSteps = async () => {
      // Advance steps roughly every 600ms
      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(i);
        await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400));
      }

      // After all steps show briefly, run the engine
      try {
        const result = await analyzeInput(data);
        onComplete(result);
      } catch (err) {
        console.error("Analysis Failed:", err);
        // Fallback for demo stability
        onComplete({ level: 'error', reason: 'Backend connection failed.' });
      }
    };

    runSteps();

    // Cleanup
    return () => {
      clearTimeout(stepTimer);
      clearTimeout(finishTimer);
    };
  }, [data, onComplete]);

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

      {/* TODO: Connect to backend API: 
          axios.post('/api/v1/analyze', data).then(...) */}

      <button className="btn btn-secondary" style={{ marginTop: '2rem' }} onClick={onCancel}>
        Cancel Scan
      </button>

    </div>
  );
};

export default ProcessingScreen;
