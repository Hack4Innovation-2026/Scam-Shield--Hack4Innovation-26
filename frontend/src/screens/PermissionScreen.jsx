import React, { useCallback, useEffect, useState } from 'react';
import { Shield, Bell, MessageSquare, BellRing, CheckCircle2, ChevronRight } from 'lucide-react';
import {
  isNative,
  getNativeStatus,
  openNotificationAccessSettings,
  requestSmsPermission,
  requestAlertPermission,
} from '../native/nativeScanner';

const SWITCH_OFF = '#94a3b8';

const PERMISSIONS = [
  {
    key: 'notificationAccess',
    icon: Bell,
    title: 'Notification access',
    description: 'Scan incoming WhatsApp, Telegram, Instagram and email messages in the background.',
    // A special-access permission: only grantable on the system settings screen.
    request: openNotificationAccessSettings,
  },
  {
    key: 'sms',
    icon: MessageSquare,
    title: 'Incoming SMS',
    description: 'Scan text messages the moment they arrive.',
    request: requestSmsPermission,
  },
  {
    key: 'postNotifications',
    icon: BellRing,
    title: 'Scam alerts',
    description: 'Show a warning notification when a message looks like a scam.',
    request: requestAlertPermission,
  },
];

const Switch = ({ on, label, onClick, disabled }) => (
  <button
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
    style={{
      width: '48px', height: '26px', borderRadius: '30px', border: 'none', position: 'relative', transition: 'background 0.3s',
      cursor: disabled ? 'default' : 'pointer', flexShrink: 0,
      background: on ? 'var(--accent-safe)' : SWITCH_OFF,
    }}
  >
    <div style={{
      width: '20px', height: '20px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', transition: 'left 0.3s',
      left: on ? '25px' : '3px'
    }} />
  </button>
);

const PermissionScreen = ({ onComplete }) => {
  const [status, setStatus] = useState({ notificationAccess: false, sms: false, postNotifications: false });

  const refresh = useCallback(() => getNativeStatus().then(setStatus), []);

  // Notification access is granted on a system screen: re-read the real state when the user returns.
  useEffect(() => {
    if (!isNative) return undefined;
    refresh();
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const request = async (permission) => {
    if (status[permission.key]) return;   // revoking happens in system settings
    const next = await permission.request();
    if (next && typeof next === 'object' && permission.key in next) setStatus(next);
    else refresh();
  };

  const allGranted = PERMISSIONS.every(p => status[p.key]);

  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <div className="text-center" style={{ marginBottom: '2rem', marginTop: 'auto' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', marginBottom: '1rem' }}>
          <Shield size={48} color="var(--primary)" />
        </div>
        <h1 className="text-h1">Setup Protection</h1>
        <p className="text-sub" style={{ padding: '0 1rem' }}>
          {isNative
            ? 'Turn these on so Scam Shield can check messages in the background - even when the app is closed.'
            : 'These permissions apply to the Android app. In the browser you can scan messages manually - continue to get started.'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
        {PERMISSIONS.map(permission => {
          const on = Boolean(status[permission.key]);
          const Icon = permission.icon;
          return (
            <div key={permission.key} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderColor: on ? 'var(--accent-safe)' : 'var(--card-border)' }}>
              <div style={{ background: on ? 'rgba(34, 197, 94, 0.1)' : 'var(--input-bg)', padding: '0.75rem', borderRadius: '50%', color: on ? 'var(--accent-safe)' : 'var(--text-secondary)' }}>
                <Icon size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>{permission.title}</h3>
                <p className="text-sub" style={{ fontSize: '0.8rem', margin: 0, marginTop: '0.25rem' }}>{permission.description}</p>
              </div>
              <Switch on={on} label={permission.title} onClick={() => request(permission)} disabled={!isNative} />
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {isNative && allGranted && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-safe)', marginBottom: '1rem', animation: 'fadeIn 0.5s ease-out' }}>
            <CheckCircle2 size={16} /> <span style={{ fontSize: '0.875rem' }}>Background protection is on</span>
          </div>
        )}
        <button className="btn btn-primary" onClick={onComplete} style={{ width: '100%' }}>
          Continue to Login <ChevronRight size={20} />
        </button>
        {isNative && !allGranted && (
          <p className="text-sub text-center" style={{ fontSize: '0.75rem', marginTop: '0.75rem' }}>
            You can turn these on later in Settings.
          </p>
        )}
      </div>
    </div>
  );
};

export default PermissionScreen;
