import React, { useState } from 'react';
import { Shield, Bell, MessageSquare, Activity, CheckCircle2, ChevronRight } from 'lucide-react';
import ScamShield from '../utils/ScamShieldPlugin';

const PermissionScreen = ({ onComplete }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);

  const allGranted = notificationsEnabled && smsEnabled && backgroundEnabled;

  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <div className="text-center" style={{ marginBottom: '2rem', marginTop: 'auto' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', marginBottom: '1rem' }}>
          <Shield size={48} color="var(--primary)" />
        </div>
        <h1 className="text-h1">Setup Protection</h1>
        <p className="text-sub" style={{ padding: '0 1rem' }}>Scam Shield requires root-level permissions to actively intercept threats before they reach you.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
        
        {/* Permission 1 */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderColor: notificationsEnabled ? 'var(--accent-safe)' : 'var(--card-border)' }}>
          <div style={{ background: notificationsEnabled ? 'rgba(34, 197, 94, 0.1)' : 'var(--input-bg)', padding: '0.75rem', borderRadius: '50%', color: notificationsEnabled ? 'var(--accent-safe)' : 'var(--text-secondary)' }}>
            <Bell size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Notification Interceptor</h3>
            <p className="text-sub" style={{ fontSize: '0.8rem', margin: 0, marginTop: '0.25rem' }}>Scan incoming WhatsApp & IG messages.</p>
          </div>
          <button 
            onClick={async () => {
              if (!notificationsEnabled) {
                 try {
                    await ScamShield.openNotificationSettings();
                 } catch(e) { console.log('Native plugin block', e); }
              }
              setNotificationsEnabled(!notificationsEnabled);
            }}
            style={{ 
              width: '48px', height: '26px', borderRadius: '30px', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.3s',
              background: notificationsEnabled ? 'var(--accent-safe)' : 'rgba(255,255,255,0.1)'
            }}
          >
            <div style={{ 
              width: '20px', height: '20px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', transition: 'left 0.3s',
              left: notificationsEnabled ? '25px' : '3px'
            }} />
          </button>
        </div>

        {/* Permission 2 */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderColor: smsEnabled ? 'var(--accent-safe)' : 'var(--card-border)' }}>
          <div style={{ background: smsEnabled ? 'rgba(34, 197, 94, 0.1)' : 'var(--input-bg)', padding: '0.75rem', borderRadius: '50%', color: smsEnabled ? 'var(--accent-safe)' : 'var(--text-secondary)' }}>
            <MessageSquare size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Read SMS Log</h3>
            <p className="text-sub" style={{ fontSize: '0.8rem', margin: 0, marginTop: '0.25rem' }}>Detect phishing links in text messages.</p>
          </div>
          <button 
            onClick={() => setSmsEnabled(!smsEnabled)}
            style={{ 
              width: '48px', height: '26px', borderRadius: '30px', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.3s',
              background: smsEnabled ? 'var(--accent-safe)' : 'rgba(255,255,255,0.1)'
            }}
          >
            <div style={{ 
              width: '20px', height: '20px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', transition: 'left 0.3s',
              left: smsEnabled ? '25px' : '3px'
            }} />
          </button>
        </div>

        {/* Permission 3 */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderColor: backgroundEnabled ? 'var(--accent-safe)' : 'var(--card-border)' }}>
          <div style={{ background: backgroundEnabled ? 'rgba(34, 197, 94, 0.1)' : 'var(--input-bg)', padding: '0.75rem', borderRadius: '50%', color: backgroundEnabled ? 'var(--accent-safe)' : 'var(--text-secondary)' }}>
            <Activity size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Background Execution</h3>
            <p className="text-sub" style={{ fontSize: '0.8rem', margin: 0, marginTop: '0.25rem' }}>Allow Scam Shield to run in the background.</p>
          </div>
          <button 
            onClick={() => setBackgroundEnabled(!backgroundEnabled)}
            style={{ 
              width: '48px', height: '26px', borderRadius: '30px', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.3s',
              background: backgroundEnabled ? 'var(--accent-safe)' : 'rgba(255,255,255,0.1)'
            }}
          >
            <div style={{ 
              width: '20px', height: '20px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', transition: 'left 0.3s',
              left: backgroundEnabled ? '25px' : '3px'
            }} />
          </button>
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {allGranted && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-safe)', marginBottom: '1rem', animation: 'fadeIn 0.5s ease-out' }}>
            <CheckCircle2 size={16} /> <span style={{ fontSize: '0.875rem' }}>All permissions granted</span>
          </div>
        )}
        <button 
          className="btn btn-primary" 
          onClick={onComplete}
          disabled={!allGranted}
          style={{ width: '100%', transition: 'all 0.3s', opacity: allGranted ? 1 : 0.5 }}
        >
          Continue to Login <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default PermissionScreen;
