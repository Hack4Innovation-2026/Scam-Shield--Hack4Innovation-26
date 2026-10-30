import React, { useState, useEffect, useCallback } from 'react';
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
import { analyzeText } from './api/client';
import { loadHistory, saveScan } from './utils/historyStore';
import ScamShield from './utils/ScamShieldPlugin';
function App() {
  const { currentUser, logout } = useAuth();
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

  // Native Notification Bridge
  useEffect(() => {
    let nativeListener;
    const initializeNativeBridge = async () => {
      try {
        nativeListener = await ScamShield.addListener('notificationReceived', async (data) => {
           console.log("[Native Notification Intercepted]", data);
           if (!data || !data.text) return;

           const analysisPayload = {
             type: 'text',
             source: data.app || 'Native App',
             text: (data.title || '') + " " + data.text
           };

           let result;
           try {
             result = await analyzeText(analysisPayload.text, 'notifications');
           } catch (err) {
             console.warn('Notification scan failed:', err.message);
             return;
           }
           if (result.riskScore >= 70) {
              // Trigger Native Android Toast matching user request, including percentage!
              await ScamShield.showToast({ text: `⚠ Scam message detected! Risk: ${result.riskScore}%` });
              
              setNotificationData({
                app: data.app || 'Unknown Native Source',
                sender: data.title || 'System Alert',
                text: analysisPayload.text
              });
              setShowNotification(true);
           }
        });
      } catch (e) {
         console.log("Native API bridge unavailable", e);
      }
    };
    
    initializeNativeBridge();
    
    return () => {
       if (nativeListener) nativeListener.remove();
    };
  }, []);

  // Background Message Simulator removed per user request. 
  // The app now relies 100% on the Native Event bridge (lines 49-87) to read real device notifications!

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
    startScan({
      type: 'text',
      source: notificationData.app,
      text: notificationData.text
    });
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
