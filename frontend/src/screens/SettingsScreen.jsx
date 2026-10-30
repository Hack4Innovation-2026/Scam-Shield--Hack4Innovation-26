import React, { useState } from 'react';
import { User, Shield, Bell, Lock, LogOut, ChevronRight, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isNative, openNotificationAccessSettings } from '../native/nativeScanner';

const SettingsScreen = ({ privacyMode, setPrivacyMode, isDarkMode, setIsDarkMode, onLogout }) => {
  const [popupData, setPopupData] = useState(null); // { title, message }
  const { currentUser } = useAuth();

  const showPopup = (title, message) => {
    setPopupData({ title, message });
  };

  const enableNativeListener = () => {
    if (isNative) {
      openNotificationAccessSettings();
    } else {
      showPopup("Android app feature", "Background scanning reads incoming notifications and SMS, which only the Android app can do. In the browser, paste messages on the Scan screen.");
    }
  };

  return (
    <div className="screen" style={{ paddingBottom: '6rem' }}>
      <div className="app-header">
        <h2 className="header-title" style={{ margin: 0 }}>Privacy & Profile</h2>
      </div>

      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #8b5cf6)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <User size={32} color="white" />
        </div>
        <div>
          <h2 className="text-h2" style={{ margin: 0, fontSize: '1.25rem' }}>{currentUser ? currentUser.name : 'Guest'}</h2>
          <p className="text-sub">{currentUser ? currentUser.email : 'History saved on this device only'}</p>
        </div>
      </div>

      <h3 className="text-h3" style={{ fontSize: '1rem', marginBottom: '1rem' }}>Security Settings</h3>
      
      <div className="glass-card" style={{ marginBottom: '2rem', padding: '0.5rem 1rem' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0', borderBottom: '1px solid var(--card-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Lock size={20} className="text-safe" />
            <div>
              <p style={{ fontWeight: 500, margin: 0 }}>Privacy Mode</p>
              <p className="text-sub" style={{ fontSize: '0.75rem', margin: 0, marginTop: '0.25rem' }}>We do not store personal or sensitive data</p>
            </div>
          </div>
          <Toggle checked={privacyMode} onChange={() => setPrivacyMode(!privacyMode)} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0', borderBottom: '1px solid var(--card-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {isDarkMode ? <Moon size={20} className="text-primary" /> : <Sun size={20} className="text-primary" />}
            <div>
              <p style={{ fontWeight: 500, margin: 0 }}>Dark Theme</p>
              <p className="text-sub" style={{ fontSize: '0.75rem', margin: 0, marginTop: '0.25rem' }}>Improves battery and readability</p>
            </div>
          </div>
          <Toggle checked={isDarkMode} onChange={() => setIsDarkMode(!isDarkMode)} />
        </div>

        <div 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0', borderBottom: '1px solid var(--card-border)', cursor: 'pointer' }}
          onClick={enableNativeListener}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Bell size={20} className="text-warning" />
            <div>
              <p style={{ fontWeight: 500, margin: 0 }}>Background scanning</p>
              <p className="text-sub" style={{ fontSize: '0.75rem', margin: 0, marginTop: '0.25rem' }}>{isNative ? 'Manage notification access' : 'Available in the Android app'}</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-secondary" />
        </div>

        <div 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0', cursor: 'pointer' }}
          onClick={() => showPopup("Detection engine", "Scam Shield 1.1\n\n- Link analysis: shorteners, suspicious TLDs, raw IPs, look-alike domains\n- Behavioural patterns: urgency, fear, reward, authority\n- ML text models: TF-IDF + Random Forest (SMS), Random Forest (email)")}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Shield size={20} className="text-primary" />
            <div>
              <p style={{ fontWeight: 500, margin: 0 }}>Engine Version</p>
              <p className="text-sub" style={{ fontSize: '0.75rem', margin: 0, marginTop: '0.25rem' }}>Scam Shield 1.1</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-secondary" />
        </div>

      </div>

      <button className="btn btn-secondary" style={{ width: '100%', marginTop: 'auto', color: 'var(--accent-scam)', borderColor: 'var(--accent-scam)' }} onClick={onLogout}>
        <LogOut size={20} />
        Log Out
      </button>

      {/* Reusable Popup Modal */}
      {popupData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
          <div className="glass-card" style={{ width: '100%', background: 'var(--bg-dark)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="text-h3" style={{ margin: 0 }}>{popupData.title}</h3>
              <button 
                onClick={() => setPopupData(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p className="text-sub" style={{ whiteSpace: 'pre-line', lineHeight: '1.5', color: 'var(--text-primary)' }}>
              {popupData.message}
            </p>
            <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => setPopupData(null)}>Close</button>
          </div>
        </div>
      )}

    </div>
  );
};

const Toggle = ({ checked, onChange }) => (
  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '24px' }}>
    <input 
      type="checkbox" 
      checked={checked} 
      onChange={onChange}
      style={{ opacity: 0, width: 0, height: 0 }}
    />
    <span style={{ 
      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: checked ? 'var(--accent-safe)' : 'rgba(128,128,128,0.3)', 
      transition: '.4s', borderRadius: '24px',
    }}>
      <span style={{
        position: 'absolute', content: '""', height: '18px', width: '18px', left: '3px', bottom: '3px',
        backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
        transform: checked ? 'translateX(16px)' : 'translateX(0)'
      }}></span>
    </span>
  </label>
);

export default SettingsScreen;
