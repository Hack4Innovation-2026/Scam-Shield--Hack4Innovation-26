// Mock AI Engine for Scam Shield
// Simulates the backend FastAPI logic described in the requirements

// Deterministic string hash to replace Math.random() for consistent scores
const stringHash = (str) => {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; 
  }
  return Math.abs(hash);
};

export const analyzeInput = async (payload) => {
  // payload: { type: 'text' | 'email' | 'image' | 'call', ... }

  if (payload.type === 'image') {
    try {
      const formData = new FormData();
      formData.append('file', payload.image);
      
      const response = await fetch('http://localhost:8000/scan/image', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      
      const isScam = data.threat_level.toLowerCase() === 'scam';
      const confidenceStr = data.ai_confidence > 80 ? 'High' : (data.ai_confidence > 50 ? 'Medium' : 'Low');
      
      return {
        isELA: true,
        level: data.threat_level.toLowerCase(),
        manipulationDetected: data.ai_forgery_detected,
        elaMessage: data.conclusion + (data.metadata_flags && data.metadata_flags.length > 0 ? (" Metadata flags found: " + data.metadata_flags.join(', ')+"." ) : ""),
        elaImageBase64: data.ela_image_base64 || null,
        scamType: isScam ? 'Image Forgery / Fake Receipt' : 'None',
        intent: isScam ? 'Deception' : 'Neutral',
        confidence: confidenceStr,
        advice: data.advice,
        action: isScam ? 'Discard & Report' : 'Proceed Cautiously',
        urls: [],
        urlFlags: [],
        source: 'Image Forensics (AI Pipeline)',
        report: {
          reportRecommended: isScam,
          reportLink: 'https://cybercrime.gov.in',
          reportSummary: "This submitted screenshot has been identified as a digitally altered forgery by the Scam Shield Backend."
        }
      };
    } catch (e) {
      console.error("Backend Error", e);
      // Fallback if backend isn't running
      const fileId = payload.image ? (payload.image.name + payload.image.size) : 'unknown';
      const hashVal = stringHash(fileId);
      const isFake = (hashVal % 10) > 4; // Deterministic 50/50 probability
      return {
        isELA: true,
        level: isFake ? 'scam' : 'safe',
        manipulationDetected: isFake,
        elaMessage: "Backend connection failed. Simulated Analysis: " + (isFake ? "High error level variance detected." : "Compression signatures are uniform."),
        scamType: isFake ? 'Image Forgery / Fake Receipt' : 'None',
        intent: isFake ? 'Deception' : 'Neutral',
        confidence: 'Low (Offline)',
        advice: "Unable to reach deep learning engine. Proceed with caution.",
        action: 'Retry Later',
        urls: [],
        urlFlags: [],
        source: 'Image Forensics (Offline Mock)',
        report: {
          reportRecommended: false,
          reportLink: 'https://cybercrime.gov.in',
          reportSummary: "Offline Mock Analysis."
        }
      };
    }
  }

  if (payload.type === 'call') {
    const isSuspiciousNum = payload.phoneNumber && (payload.phoneNumber.includes('555') || payload.phoneNumber.includes('000') || Math.random() > 0.6);
    let riskScore = 15;
    let level = 'safe';
    let intentText = 'Neutral';
    let explanation = 'No significant negative reports found for this number in our global directory.';
    let advice = "This number appears to be safe, but always verify the caller's identity if they ask for sensitive info.";
    const reports = Math.floor(Math.random() * 100) + 12;

    if (isSuspiciousNum) {
      riskScore = 80 + Math.floor(Math.random() * 15);
      intentText = 'Extortion / Impersonation';
      level = riskScore >= 85 ? 'scam' : 'suspicious';
      explanation = `This number has been reported ${reports} times by the community recently for impersonating official services or spam.`;
      advice = 'Do not answer or return calls from this number. Block it immediately.';
    }

    return {
      isELA: false,
      riskScore,
      level,
      scamType: level === 'safe' ? 'None' : 'Phone Scam',
      intent: intentText,
      confidence: riskScore > 80 ? 'High' : (riskScore > 50 ? 'Medium' : 'Low'),
      reason: explanation,
      advice,
      action: riskScore >= 70 ? 'Block Number' : 'Ignore',
      urls: [],
      urlFlags: [],
      source: payload.source || 'Phone Call',
      socialGraph: {
        verifiedName: isSuspiciousNum ? "FedEx Tracking / Amazon Support (Unverified)" : "Unknown Caller (Personal)",
        location: isSuspiciousNum ? "VoIP / International Routing" : "New York, USA",
        spamReports: reports,
        carrier: isSuspiciousNum ? "Bandwidth.com (VoIP)" : "AT&T Wireless"
      },
      report: {
        reportRecommended: riskScore >= 85,
        reportLink: 'https://cybercrime.gov.in',
        reportSummary: "This phone number is involved in a suspected impersonation scam."
      }
    };
  }

  // 1. Preprocess: Combine text
  let rawText = '';
  if (payload.type === 'text') rawText = payload.text || '';
  if (payload.type === 'email') rawText = (payload.subject || '') + ' ' + (payload.body || '');

  const text = rawText.toLowerCase();

  // 2. Extract URLs (Regex simulation)
  const urlRegex = /(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;
  const foundUrls = text.match(urlRegex) || [];
  
  // URL Risk Simulation
  let urlScore = 0;
  let urlFlags = [];
  const suspiciousKeywords = ['bit.ly', 'tinyurl', 'verify', 'secure', 'update', 'account', 'login', 'xyz', 'top'];
  
  if (foundUrls.length > 0) {
    urlScore += 20; // base penalty for having a url in an unsolicited msg
    foundUrls.forEach(url => {
      suspiciousKeywords.forEach(keyword => {
        if (url.includes(keyword)) {
          urlScore += 15;
          if (!urlFlags.includes(`Suspicious domain pattern: ${keyword}`)) {
            urlFlags.push(`Suspicious domain pattern: ${keyword}`);
          }
        }
      });
      if (url.includes('bit.ly') || url.includes('tinyurl')) {
        if (!urlFlags.includes('Shortened URL hidden destination')) {
           urlFlags.push('Shortened URL hidden destination');
        }
      }
    });
  }

  // Cap URL score
  urlScore = Math.min(urlScore, 40);

  // 3. Behavioral Intent Analysis
  let intentScore = 0;
  let intentText = 'Neutral';
  
  const urgencyKeywords = ['immediate', 'urgent', 'now', 'suspend', 'block', 'action required', 'expires'];
  const rewardKeywords = ['won', 'prize', 'lottery', 'claim', 'free', 'bonus'];
  const fearKeywords = ['police', 'arrest', 'fine', 'penalty', 'unauthorized', 'compromised'];
  
  let detectedPatterns = [];

  const checkKeywords = (keywords, type) => {
    for (let word of keywords) {
      if (text.includes(word)) {
        detectedPatterns.push(type);
        intentScore += 25;
        intentText = type;
        break; // Count once per category
      }
    }
  };

  checkKeywords(fearKeywords, 'Fear / Intimidation');
  if (intentScore === 0) checkKeywords(urgencyKeywords, 'Urgency / Pressure');
  if (intentScore === 0) checkKeywords(rewardKeywords, 'Reward / Bait');

  intentScore = Math.min(intentScore, 30);

  // 4. ML Engine Simulation
  // Deterministic ML risk base (0-15) + bump if we found patterns
  const hashVal = (stringHash(rawText) % 100) / 100.0;
  let mlScore = Math.floor(hashVal * 15);
  if (urlScore > 0 || intentScore > 0) mlScore += 15;
  mlScore = Math.min(mlScore, 30);

  // 5. Final Scoring System
  let riskScore = Math.floor(urlScore + intentScore + mlScore);
  
  // Edge cases based on explicit inputs (to make demo impressive)
  if (text.includes('wa-verify-secure.xyz')) riskScore = 98; // Force high score for demo notification
  if (rawText.length < 5 && foundUrls.length === 0) riskScore = 5; // Too short/safe
  
  // Enforce bounds
  riskScore = Math.max(0, Math.min(riskScore, 100));

  let level = 'safe';
  if (riskScore >= 40) level = 'suspicious';
  if (riskScore >= 70) level = 'scam';

  // 6. Explanation and Advice Engine
  let explanation = "This message appears to be safe. No common scam patterns or suspicious URLs detected.";
  let advice = "You can proceed safely, but always remain cautious.";
  let scamType = "None";

  if (level === 'scam') {
    explanation = `This message uses ${intentText.toLowerCase()} tactics and contains a suspicious URL, a common pattern for phishing attacks.`;
    advice = "Do not click the link or share personal information.";
    scamType = intentText.includes('Fear') ? 'Extortion / Impersonation' : (intentText.includes('Reward') ? 'Lottery / Prize Scam' : 'Phishing');
  } else if (level === 'suspicious') {
    explanation = "This message has some unusual characteristics but lacks strong evidence of a scam.";
    advice = "Verify the sender through an official channel before proceeding.";
    scamType = "Potential Spam";
  }

  // 7. Decision Engine
  let action = "Ignore";
  let reportRecommended = false;
  if (riskScore >= 70) action = "Block Sender";
  if (riskScore >= 95) reportRecommended = true;

  // Final Response Format mimicking FastAPI output
  return {
    riskScore,
    level,
    scamType,
    intent: intentText,
    confidence: riskScore > 85 ? 'High' : (riskScore > 50 ? 'Medium' : 'Low'),
    reason: explanation,
    advice,
    action,
    urls: foundUrls,
    urlFlags,
    source: payload.source || 'Unknown',
    report: {
      reportRecommended,
      reportLink: 'https://cybercrime.gov.in',
      reportSummary: "This message appears to be a phishing scam using a suspicious URL and urgency tactics."
    }
  };
};
