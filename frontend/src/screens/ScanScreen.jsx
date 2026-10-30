import React, { useState } from 'react';
import { Type, Mail, Image as ImageIcon, Search, ArrowLeft, Link as LinkIcon } from 'lucide-react';

const ScanScreen = ({ onNavigate, onStartScan, initialData }) => {
  const [activeTab, setActiveTab] = useState(initialData?.tab || 'text'); // text, email, url, image
  
  // States for different inputs
  const [textInput, setTextInput] = useState('');
  const [textSource, setTextSource] = useState('SMS');
  
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSender, setEmailSender] = useState('');

  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  const [urlInput, setUrlInput] = useState('');

  const handleScan = () => {
    let payload = { type: activeTab };
    
    if (activeTab === 'text') {
      if (!textInput) return;
      payload.text = textInput;
      payload.source = textSource;
    } else if (activeTab === 'email') {
      if (!emailBody && !emailSubject) return;
      payload.subject = emailSubject;
      payload.body = emailBody;
      payload.sender = emailSender;
      payload.source = 'Email';
    } else if (activeTab === 'image') {
      if (!imageFile) return;
      payload.image = imageFile;
      payload.source = 'Screenshot';
    } else if (activeTab === 'url') {
      if (!urlInput.trim()) return;
      payload.url = urlInput.trim();
      payload.source = 'URL';
    }

    onStartScan(payload);
  };

  const handleImageUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  return (
    <div className="screen hide-scrollbar" style={{ paddingBottom: '6rem' }}>
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="back-btn" onClick={() => onNavigate('home')}>
             <ArrowLeft size={24} />
          </button>
          <h2 className="text-h2" style={{ margin: 0 }}>New Scan</h2>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', padding: '0.25rem', background: 'var(--input-bg)', borderRadius: 'var(--radius-md)', overflowX: 'auto', whiteSpace: 'nowrap' }} className="hide-scrollbar">
        <button 
          className="btn" 
          style={{ padding: '0.5rem 1rem', flexShrink: 0, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: activeTab === 'text' ? 'var(--primary)' : 'transparent', color: activeTab === 'text' ? 'white' : 'var(--text-secondary)' }}
          onClick={() => setActiveTab('text')}
        >
          <Type size={16} /> Text
        </button>
        <button 
          className="btn" 
          style={{ padding: '0.5rem 1rem', flexShrink: 0, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: activeTab === 'email' ? 'var(--primary)' : 'transparent', color: activeTab === 'email' ? 'white' : 'var(--text-secondary)' }}
          onClick={() => setActiveTab('email')}
        >
          <Mail size={16} /> Email
        </button>
        <button 
          className="btn" 
          style={{ padding: '0.5rem 1rem', flexShrink: 0, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: activeTab === 'url' ? 'var(--primary)' : 'transparent', color: activeTab === 'url' ? 'white' : 'var(--text-secondary)' }}
          onClick={() => setActiveTab('url')}
        >
          <LinkIcon size={16} /> Link
        </button>
        <button 
          className="btn" 
          style={{ padding: '0.5rem 1rem', flexShrink: 0, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: activeTab === 'image' ? 'var(--primary)' : 'transparent', color: activeTab === 'image' ? 'white' : 'var(--text-secondary)' }}
          onClick={() => setActiveTab('image')}
        >
          <ImageIcon size={16} /> Image
        </button>
      </div>

      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {activeTab === 'text' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
             <div className="input-group">
                <label className="input-label">Select Source</label>
                <select 
                  className="input-field" 
                  value={textSource} 
                  onChange={(e) => setTextSource(e.target.value)}
                  style={{ backgroundImage: 'none', appearance: 'menulist' }}
                >
                  <option>SMS</option>
                  <option>WhatsApp</option>
                  <option>Instagram</option>
                  <option>Telegram</option>
                </select>
             </div>
             
             <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Message Content</label>
                <textarea 
                  className="input-field" 
                  style={{ flex: 1, resize: 'none', minHeight: '150px' }} 
                  placeholder="Paste the suspicious message here..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                />
             </div>
          </div>
        )}

        {activeTab === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
             <div className="input-group">
                <label className="input-label">Sender Email</label>
                <input type="email" className="input-field" placeholder="support@paypal-secure-verify.com" value={emailSender} onChange={e => setEmailSender(e.target.value)} />
             </div>
             <div className="input-group">
                <label className="input-label">Subject</label>
                <input type="text" className="input-field" placeholder="Urgent: Account Suspended" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
             </div>
             <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Email Body</label>
                <textarea className="input-field" style={{ flex: 1, resize: 'none', minHeight: '100px' }} placeholder="Paste email body..." value={emailBody} onChange={e => setEmailBody(e.target.value)} />
             </div>
          </div>
        )}

        {activeTab === 'url' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
             <div className="input-group">
                <label className="input-label">Link</label>
                <input
                  type="url"
                  className="input-field"
                  placeholder="http://sbi-kyc-update.xyz/login"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                />
             </div>
             <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-md)', marginTop: '1rem' }}>
               <p className="text-sub" style={{ fontSize: '0.875rem', lineHeight: '1.5' }}>
                 Checks for link shorteners, suspicious TLDs, raw IP addresses, look-alike (punycode) and crafted domains. The link is never opened.
               </p>
             </div>
          </div>
        )}

        {activeTab === 'image' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', border: '2px dashed var(--card-border)', borderRadius: 'var(--radius-md)', padding: '2rem' }}>
             {imagePreviewUrl ? (
               <div style={{ position: 'relative', width: '100%' }}>
                  <img src={imagePreviewUrl} alt="Preview" style={{ width: '100%', borderRadius: 'var(--radius-md)', maxHeight: '200px', objectFit: 'contain' }} />
                  <button className="btn btn-secondary" style={{ marginTop: '1rem', padding: '0.5rem' }} onClick={() => { setImageFile(null); setImagePreviewUrl(null); }}>Remove</button>
               </div>
             ) : (
               <>
                 <ImageIcon size={48} className="text-secondary" />
                 <p className="text-sub text-center">Upload a screenshot of the suspicious message</p>
                 <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                   Choose Image
                   <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                 </label>
               </>
             )}
          </div>
        )}

      </div>

      <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
        <button 
          className="btn btn-primary" 
          onClick={handleScan}
          disabled={
            (activeTab === 'text' && !textInput) || 
            (activeTab === 'email' && (!emailBody && !emailSubject)) || 
            (activeTab === 'url' && !urlInput.trim()) ||
            (activeTab === 'image' && !imageFile)
          }
        >
          <Search size={20} />
          {activeTab === 'image' ? 'Extract & Analyze' : 'Analyze'}
        </button>
      </div>

    </div>
  );
};

export default ScanScreen;
