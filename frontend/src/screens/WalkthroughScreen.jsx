import React, { useState } from 'react';
import { ShieldCheck, Zap, Lock, ChevronRight } from 'lucide-react';

const WalkthroughScreen = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: <ShieldCheck size={64} className="text-safe" />,
      title: "Real-time AI Detection",
      desc: "Scam Shield analyzes incoming links, emails, and SMS using advanced behavioral AI to detect threats instantly."
    },
    {
      icon: <Zap size={64} className="text-warning" />,
      title: "Immediate Action",
      desc: "Get notified when a link is suspicious. Instantly block senders or report them straight to cybercrime portals."
    },
    {
      icon: <Lock size={64} className="text-primary" />,
      title: "Privacy First",
      desc: "Your data is not stored. Private details like OTPs and numbers are scrambled before analysis."
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div 
        key={step} 
        style={{ animation: 'fadeIn 0.5s ease-in-out', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <div style={{ padding: '2rem', background: 'var(--card-bg)', borderRadius: '50%', marginBottom: '2rem', boxShadow: 'var(--shadow-glow-safe)' }}>
          {steps[step].icon}
        </div>
        <h2 className="text-h2">{steps[step].title}</h2>
        <p className="text-sub" style={{ fontSize: '1rem', maxWidth: '300px', lineHeight: '1.5' }}>
          {steps[step].desc}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '3rem', marginBottom: '3rem' }}>
        {steps.map((_, i) => (
          <div 
            key={i} 
            style={{ 
              width: i === step ? '24px' : '8px', 
              height: '8px', 
              borderRadius: '4px', 
              background: i === step ? 'var(--primary)' : 'var(--card-border)',
              transition: 'all var(--transition-normal)'
            }}
          />
        ))}
      </div>

      <button className="btn btn-primary" onClick={handleNext} style={{ width: '80%' }}>
        {step < steps.length - 1 ? 'Next' : 'Get Started'}
        <ChevronRight size={20} />
      </button>
    </div>
  );
};

export default WalkthroughScreen;
