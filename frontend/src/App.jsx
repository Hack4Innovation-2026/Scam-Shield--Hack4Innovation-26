import React, { useState, useEffect, useCallback, useRef } from 'react';
import PermissionScreen from './screens/PermissionScreen';
import LoginScreen from './screens/LoginScreen';
import WalkthroughScreen from './screens/WalkthroughScreen';
import HomeScreen from './screens/HomeScreen';
import ScanScreen from './screens/ScanScreen';
import ProcessingScreen from './screens/ProcessingScreen';
import ResultScreen from './screens/ResultScreen';
import ReportScreen from './screens/ReportScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';
import NotificationSimulation from './components/NotificationSimulation';
import { Home, Scan, Clock, Settings } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { loadHistory, saveScan } from './utils/historyStore';
import { syncNativeConfig, subscribeToNativeScans } from './native/nativeScanner';
function App() {
  const { currentUser, logout } = useAuth();
  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  const [permissionsGranted, setPermissionsGranted] = useState(() => {
    return localStorage.getItem('scamShieldPermissions') === 'true';
  });
  const [currentScreen, setCurrentScreen] = useState(() => {
    if (!permissionsGranted) return 'permissions';
    return currentUser ? 'home' : 'login';
  });
  const [history, setHistory] = useState([]);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false); // Light by default
  
  // State for scanning
  const [scanData, setScanData] = useState(null); // The input being scanned
  const [scanResult, setScanResult] = useState(null); // The result of the scan

  // Simulation of background notification
  const [showNotification, setShowNotification] = useState(false);
  const [notificationData, setNotificationData] = useState(null);

  // Load persisted history whenever the signed-in user changes (guest -> localStorage)
  useEffect(() => {
    let cancelled = false;
    loadHistory(currentUser)
      .then(items => { if (!cancelled) setHistory(items); })
      .catch(err => console.error('Could not load scan history:', err));
    return () => { cancelled = true; };
  }, [currentUser]);

  // Apply theme class to document body
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove('theme-light');
    } else {
      document.body.classList.add('theme-light');
    }
  }, [isDarkMode]);

  // Android: keep the background scanner's API address and login token in sync with the app.
  useEffect(() => {
    syncNativeConfig();
  }, [currentUser]);

  // Android: results of background scans (notifications / SMS) and taps on scam alerts.
  useEffect(() => subscribeToNativeScans({
    onScan: (record) => {
      setHistory(prev => [record, ...prev]);
      // Signed-in scans are already saved on the server; guests keep them on the device.
      saveScan(currentUserRef.current, record).catch(() => {});
      if (record.riskScore >= 70) {
        setNotificationData({ app: record.source, sender: record.scamType, text: record.scannedText, record });
        setShowNotification(true);
      }
    },
    onOpen: (record) => {
      setScanResult(record);
      setCurrentScreen('result');
    },
  }), []);

  const navigateTo = (screen, data = null) => {
    if (data && screen === 'processing') {
      setScanData(data);
    }
    if (data && screen === 'result') {
      setScanResult(data);
    }
    if (data && screen === 'scan') {
      setScanData(data); // Pass config data to scan module
    }
    setCurrentScreen(screen);
  };

  const handleLogin = () => {
    setCurrentScreen('home');
  };

  const startScan = (data) => {
    navigateTo('processing', data);
  };

  const handleScanComplete = useCallback(async (result) => {
    const scanRecord = { ...result, id: Date.now(), date: new Date().toISOString() };

    // Update local state instantly
    setHistory(prev => [scanRecord, ...prev]);

    try {
      await saveScan(currentUser, scanRecord);
    } catch (err) {
      console.error("Error saving scan history:", err);
    }

    setScanResult(scanRecord);
    setCurrentScreen('result');
  }, [currentUser]);

  const handleLogout = async () => {
    await logout();
    setCurrentScreen('login');
  };

  const handleNotificationClick = () => {
    setShowNotification(false);
    setScanResult(notificationData.record);
    setCurrentScreen('result');
  };

  const handleNotificationDismiss = () => {
    setShowNotification(false);
  };

  return (
      <div className={`app-container ${isDarkMode ? '' : 'theme-light'}`} style={{ position: 'relative' }}>
        
      {/* Screens */}
      {currentScreen === 'permissions' && (
        <PermissionScreen 
          onComplete={() => {
            localStorage.setItem('scamShieldPermissions', 'true');
            setPermissionsGranted(true);
            setCurrentScreen('login');
          }} 
        />
      )}
      {currentScreen === 'login' && <LoginScreen onLogin={handleLogin} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />}
      {currentScreen === 'walkthrough' && <WalkthroughScreen onComplete={() => setCurrentScreen('home')} />}
      {currentScreen === 'home' && <HomeScreen onNavigate={navigateTo} history={history} privacyMode={privacyMode} />}
      {currentScreen === 'scan' && <ScanScreen onNavigate={navigateTo} onStartScan={startScan} initialData={scanData} />}
      {currentScreen === 'processing' && <ProcessingScreen data={scanData} onComplete={handleScanComplete} onCancel={() => navigateTo('home')} />}
      {currentScreen === 'result' && <ResultScreen result={scanResult} onNavigate={navigateTo} />}
      {currentScreen === 'report' && <ReportScreen result={scanResult} onNavigate={navigateTo} />}
      {currentScreen === 'history' && <HistoryScreen history={history} onNavigate={navigateTo} />}
      {currentScreen === 'settings' && <SettingsScreen privacyMode={privacyMode} setPrivacyMode={setPrivacyMode} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} onNavigate={navigateTo} onLogout={handleLogout} />}

      {/* Notification Overlay */}
      {showNotification && (
        <NotificationSimulation 
          data={notificationData} 
          onClick={handleNotificationClick} 
          onDismiss={handleNotificationDismiss} 
        />
      )}

      {/* Navigation Bar - only show on stable main screens */}
      {['home', 'scan', 'history', 'settings'].includes(currentScreen) && (
        <div className="bottom-nav">
          <button className={`nav-item ${currentScreen === 'home' ? 'active' : ''}`} onClick={() => navigateTo('home')}>
            <Home />
            <span>Home</span>
          </button>
          <button className={`nav-item ${currentScreen === 'scan' ? 'active' : ''}`} onClick={() => navigateTo('scan')}>
            <Scan />
            <span>Scan</span>
          </button>
          <button className={`nav-item ${currentScreen === 'history' ? 'active' : ''}`} onClick={() => navigateTo('history')}>
            <Clock />
            <span>History</span>
          </button>
          <button className={`nav-item ${currentScreen === 'settings' ? 'active' : ''}`} onClick={() => navigateTo('settings')}>
            <Settings />
            <span>Settings</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
