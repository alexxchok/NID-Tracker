// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabaseUrl = 'https://yymvagbwxdaxrldrhmtm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bXZhZ2J3eGRheHJsZHJobXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTEyMjcsImV4cCI6MjEwMjI2NzIyN30.W6WFGXzR7gMU0ln-vfMIJlsxwctWqnCv5Cb7qW8UXXY';
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (!session) return <AuthScreen />;
  return <Dashboard userEmail={session.user.email} onSignOut={() => supabase.auth.signOut()} />;
}

function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', width: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'inline-block', padding: '12px', backgroundColor: '#3b82f6', borderRadius: '12px', marginBottom: '15px' }}>
            <span style={{ color: 'white', fontSize: '24px' }}>📊</span>
          </div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '24px', fontWeight: 600 }}>SLA Tracker</h2>
          <p style={{ color: '#64748b', marginTop: '5px', fontSize: '14px' }}>Sign in to your dashboard</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#334155' }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }} />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#334155' }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }} />
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: '14px', marginBottom: '16px', padding: '10px', backgroundColor: '#fee2e2', borderRadius: '6px' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width: '100%', backgroundColor: '#0f172a', color: 'white', padding: '14px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '15px' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Helper to format time ago
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000); // seconds
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

function Dashboard({ userEmail, onSignOut }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [selectedCase, setSelectedCase] = useState(null);
  const [daList, setDaList] = useState([]);
  const [wipList, setWipList] = useState([]);

  const [showWipForm, setShowWipForm] = useState(false);
  const [mappingRules, setMappingRules] = useState([]);
  const [wipActionType, setWipActionType] = useState('');
  const [wipDesc, setWipDesc] = useState('');
  const [wipDateSent, setWipDateSent] = useState(new Date().toISOString().split('T')[0]);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const fetchCases = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('cases').select('*, disciplinary_actions(respondent_name, respondent_id)').order('sla_due_date', { ascending: true });
    if (error) console.error('Error fetching cases:', error);
    else setCases(data);
    setLoading(false);
  };

  useEffect(() => { 
    fetchCases(); 
    supabase.from('mapping_rules').select('*').then(({ data }) => setMappingRules(data || []));
  }, []);

  const cleanVal = (val) => {
    if (val === undefined || val === null) return null;
    const str = String(val).trim();
    return str === '' ? null : str;
  };

  const formatDateString = (dateStr) => {
    if (!dateStr && dateStr !== 0) return null;
    if (typeof dateStr === 'string' && !isNaN(dateStr) && dateStr.trim() !== '') {
      dateStr = parseFloat(dateStr);
    }
    if (typeof dateStr === 'number') {
      const utc_days = Math.floor(dateStr - 25569);
      const utc_value = utc_days * 86400;        
      const date_info = new Date(utc_value * 1000);
      if (!isNaN(date_info.getTime())) {
        return `${date_info.getFullYear()}-${String(date_info.getMonth() + 1).padStart(2, '0')}-${String(date_info.getDate()).padStart(2, '0')}`;
      }
    }
    const cleanStr = String(dateStr).trim().split(' ')[0];
    const parts = cleanStr.split(/[-/]/);
    if (parts.length === 3) {
      let [p1, p2, p3] = parts.map(p => parseInt(p, 10));
      if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
        if (p3 < 100) p3 = 2000 + p3;
        let dateObj = new Date(p3, p2 - 1, p1);
        if (p2 > 12 && p1 <= 12) dateObj = new Date(p3, p1 - 1, p2);
        if (!isNaN(dateObj.getTime())) {
          return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        }
      }
    }
    const fallbackDate = new Date(cleanStr);
    if (!isNaN(fallbackDate.getTime())) {
      const year = fallbackDate.getFullYear();
      if (year > 1900 && year < 2100) {
        return `${year}-${String(fallbackDate.getMonth() + 1).padStart(2, '0')}-${String(fallbackDate.getDate()).padStart(2, '0')}`;
      }
    }
    return null;
  };

  const chunkArray = (array, size) => {
    const result = [];
    for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
    return result;
  };

  const findSheetByHeader = (wb, headerSearch) => {
    for (let name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      if (json.length > 0) {
        const headers = json[0].map(h => String(h || '').trim().toLowerCase());
        if (headers.some(h => h.includes(headerSearch.toLowerCase()))) {
          return name;
        }
      }
    }
    return null;
  };

  const handleMasterUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMessage('1/5 Reading Excel file...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        setUploadMessage('2/5 Extracting sheets...');
        
        let casesToUpsert = [];
        const slaSheetName = wb.SheetNames.find(name => name.trim().toLowerCase() === 'sla_tracker');
        if (slaSheetName) {
          const ws = wb.Sheets[slaSheetName];
          const json = XLSX.utils.sheet_to_json(ws, { defval: null });
          casesToUpsert = json.map(row => {
            const getVal = (searchStrings) => { for (let key in row) { const cl = key.trim().toLowerCase(); for (let s of searchStrings) { if (cl.includes(s.toLowerCase())) return row[key]; } } return null; };
            const caseNum = cleanVal(getVal(["CASE NUMBER", "Case Number", "CXN No"]));
            if (!caseNum) return null;
            return {
              case_number: caseNum,
              created_on: formatDateString(cleanVal(getVal(["CREATED ON", "Created On"]))),
              sla_due_date: formatDateString(cleanVal(getVal(["CASE DUE DATE", "SLA DATE", "Due Date"]))),
              country: cleanVal(getVal(["COUNTRY"])),
              pic: cleanVal(getVal(["PIC"])),
              priority: cleanVal(getVal(["PRIORITY"])) || 'Medium',
              case_status: cleanVal(getVal(["CASE STATUS", "Status"])) || 'IN PROGRESS',
              stage: cleanVal(getVal(["STAGE OF CASE", "STAGE OF CASE"])),
              date_completed: formatDateString(cleanVal(getVal(["DATE COMPLETED", "DATE COMPLETED / CANCELLED"]))),
              remarks: cleanVal(getVal(["REMARKS"]))
            };
          }).filter(Boolean);
        }

        let daDataToInsert = [];
        let daSheetName = findSheetByHeader(wb, "Action Taken 1");
        if (!daSheetName) daSheetName = findSheetByHeader(wb, "Current Action");
        
        if (daSheetName) {
          const ws = wb.Sheets[daSheetName];
          const json = XLSX.utils.sheet_to_json(ws, { defval: null });
          daDataToInsert = json.map(row => {
            const getVal = (searchStrings) => { for (let key in row) { const cl = key.trim().toLowerCase(); for (let s of searchStrings) { if (cl.includes(s.toLowerCase())) return row[key]; } } return null; };
            const caseNum = cleanVal(getVal(["CXN No", "CXN #"]));
            const respId = cleanVal(getVal(["Respondent ID#", "Respondent ID No", "Respondents' IR ID No"])); 
            
            let history = [];
            for (let i = 1; i <= 4; i++) {
              const action = cleanVal(getVal([`Action Taken ${i}`]));
              const dateStr = cleanVal(getVal([`Date of execution ${i}`]));
              const date = formatDateString(dateStr);
              if (action) {
                history.push({ step: i, action: action, date: date });
              }
            }
            if (history.length === 0) {
                const currAction = cleanVal(getVal(["Current Action"]));
                const currDate = formatDateString(cleanVal(getVal(["Current Action (Execution Date)", "Execution Date"])));
                if (currAction) history.push({ step: 1, action: currAction, date: currDate });
                
                const prevAction = cleanVal(getVal(["Previous Action"]));
                const prevDate = formatDateString(cleanVal(getVal(["(Previous Action (Execution Date)", "Previous Action (Execution Date)"])));
                if (prevAction) history.push({ step: 2, action: prevAction, date: prevDate });
            }

            const latestAction = history.length > 0 ? history[history.length - 1].action : null;
            const latestDate = history.length > 0 ? history[history.length - 1].date : null;
            
            let actionDays = null;
            if (latestDate) { const today = new Date(); const exec = new Date(latestDate); if (!isNaN(exec.getTime())) actionDays = Math.floor((today - exec) / (1000 * 60 * 60 * 24)); }
            
            return {
              case_number: caseNum,
              complainant_name: cleanVal(getVal(["Complainant Name", "Complainant's Name and IR ID No"])),
              complainant_id: cleanVal(getVal(["Complainant ID#"])),
              complainant_country: cleanVal(getVal(["Complainant Country"])),
              respondent_name: cleanVal(getVal(["Respondent Name", "Respondent's Name"])),
              respondent_id: respId,
              respondent_country: cleanVal(getVal(["Respondent Country", "Country"])),
              current_action: latestAction, 
              execution_date: latestDate,
              action_history: history.length > 0 ? history : null,
              remarks: cleanVal(getVal(["Remarks"])),
              action_days: actionDays,
              unique_key: caseNum && respId ? `${caseNum}|${respId}` : null
            };
          }).filter(item => item && item.case_number && item.unique_key);
        }

        if (casesToUpsert.length === 0 && daDataToInsert.length === 0) {
          setUploadMessage('❌ Error: No valid data found.');
          setUploading(false);
          return;
        }

        setUploadMessage('3/5 Syncing Cases...');
        if (casesToUpsert.length > 0) {
          const chunks = chunkArray(casesToUpsert, 100);
          for (let chunk of chunks) {
            await supabase.from('cases').upsert(chunk, { onConflict: 'case_number' });
          }
        }

        setUploadMessage('4/5 Ensuring parent cases exist...');
        const { data: existingCases } = await supabase.from('cases').select('case_number');
        const existingSet = new Set(existingCases.map(c => c.case_number));
        const uniqueDA_caseNums = [...new Set(daDataToInsert.map(item => item.case_number))];
        const missingCases = uniqueDA_caseNums.filter(cn => !existingSet.has(cn) && !casesToUpsert.some(c => c.case_number === cn)).map(cn => {
            const today = new Date(); const slaDate = new Date(today.setDate(today.getDate() + 30)).toISOString().split('T')[0];
            return { case_number: cn, case_status: 'IN PROGRESS', sla_due_date: slaDate, created_on: new Date().toISOString().split('T')[0], priority: 'Medium', stage: 'Stage 1' };
        });
        if (missingCases.length > 0) {
          const missingChunks = chunkArray(missingCases, 100);
          for (let chunk of missingChunks) {
            await supabase.from('cases').upsert(chunk, { onConflict: 'case_number', ignoreDuplicates: true });
          }
        }

        setUploadMessage('5/5 Uploading Respondents...');
        const uniqueMap = new Map();
        daDataToInsert.forEach(item => uniqueMap.set(item.unique_key, item));
        const finalDataToInsert = Array.from(uniqueMap.values());

        let errorCount = 0; let firstError = null;
        const daChunks = chunkArray(finalDataToInsert, 100);
        for (let chunk of daChunks) {
          const { error } = await supabase.from('disciplinary_actions').upsert(chunk, { onConflict: 'unique_key' });
          if (error) { errorCount++; if (!firstError) firstError = error.message; }
        }

        let finalMsg = `✅ Sync Complete! `;
        if (casesToUpsert.length > 0) finalMsg += `Updated ${casesToUpsert.length} Cases. `;
        if (finalDataToInsert.length > 0) finalMsg += `Processed ${finalDataToInsert.length} Respondents. `;
        if (missingCases.length > 0) finalMsg += `Auto-created ${missingCases.length} missing Cases. `;
        if (errorCount > 0) finalMsg = `⚠️ Completed with ${errorCount} errors. First: ${firstError}`;

        setUploadMessage(finalMsg);
        fetchCases(); 
        setUploading(false);
      } catch (err) {
        setUploadMessage(`❌ Unexpected Error: ${err.message}`);
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCaseClick = async (caseNum) => {
    if (selectedCase === caseNum) { setSelectedCase(null); return; }
    setSelectedCase(caseNum);
    setShowWipForm(false);
    const { data: daData } = await supabase.from('disciplinary_actions').select('*').eq('case_number', caseNum);
    const { data: wipData } = await supabase.from('wip_actions').select('*').eq('case_number', caseNum).order('date_sent', { ascending: false });
    setDaList(daData || []);
    setWipList(wipData || []);
  };

  const handleAddWIP = async (e) => {
    e.preventDefault();
    const rule = mappingRules.find(r => r.action_type === wipActionType);
    let stageToAssign = rule?.default_stage || null;
    let slaDays = rule?.default_sla_days || 2;

    if (rule && rule.initial_stage && rule.concluding_stage) {
      const currentCase = cases.find(c => c.case_number === selectedCase);
      const currentStageNum = parseInt(currentCase?.stage?.replace('Stage ', '') || '0', 10);
      if (currentStageNum >= 6) {
        stageToAssign = rule.concluding_stage;
      } else {
        stageToAssign = rule.initial_stage;
      }
    }

    let expiryDate = null;
    if (wipDateSent) {
      let d = new Date(wipDateSent);
      d.setDate(d.getDate() + slaDays);
      expiryDate = d.toISOString().split('T')[0];
    }

    const { error: wipError } = await supabase.from('wip_actions').insert([{ 
      case_number: selectedCase, 
      action_type: wipActionType, 
      description: wipDesc, 
      stage_auto: stageToAssign,
      date_sent: wipDateSent, 
      sla_days: slaDays,
      expiry_date: expiryDate,
      status: 'Pending',
      pic: userEmail 
    }]);
    
    if (wipError) {
      alert('Error logging WIP: ' + wipError.message);
      return;
    }
    
    if (stageToAssign) {
      // Also pass modified_by_email here!
      await supabase.from('cases').update({ stage: stageToAssign, modified_by_email: userEmail }).eq('case_number', selectedCase);
    }

    const { data: newWipData } = await supabase.from('wip_actions').select('*').eq('case_number', selectedCase).order('date_sent', { ascending: false });
    setWipList(newWipData || []);
    setWipDesc('');
    setShowWipForm(false);
    fetchCases();
  };

  const handleUpdateStatus = async (caseNum, newStatus) => {
    // Pass modified_by_email here!
    const { error } = await supabase.from('cases').update({ case_status: newStatus, modified_by_email: userEmail }).eq('case_number', caseNum);
    if (error) alert('Error updating status: ' + error.message);
    else fetchCases();
  };

  const calculateSlaDays = (dueDate) => {
    if (!dueDate) return 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((new Date(dueDate) - today) / (1000 * 60 * 60 * 24));
  };

  const filteredCases = cases.filter(c => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const matchCase = c.case_number?.toLowerCase().includes(search);
    const matchPic = c.pic?.toLowerCase().includes(search);
    const matchCountry = c.country?.toLowerCase().includes(search);
    const matchRespondent = c.disciplinary_actions?.some(da => da.respondent_name?.toLowerCase().includes(search) || da.respondent_id?.toLowerCase().includes(search));
    return matchCase || matchPic || matchCountry || matchRespondent;
  });

  const totalPages = Math.ceil(filteredCases.length / pageSize);
  const currentCases = filteredCases.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalCases = cases.length;
  const inProgress = cases.filter(c => c.case_status === 'IN PROGRESS').length;
  const completed = cases.filter(c => c.case_status === 'COMPLETED').length;
  const outOfSlaCases = cases.filter(c => calculateSlaDays(c.sla_due_date) < 0 && c.case_status === 'IN PROGRESS');

  const getActionColor = (action) => {
    if (!action) return { text: '#64748b', bg: '#f1f5f9' };
    const lower = action.toLowerCase();
    if (lower.includes('terminat')) return { text: '#dc2626', bg: '#fee2e2' };
    if (lower.includes('suspend')) return { text: '#d97706', bg: '#fef3c7' };
    if (lower.includes('release') || lower.includes('issued warning')) return { text: '#059669', bg: '#d1fae5' };
    return { text: '#2563eb', bg: '#dbeafe' };
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'cases', label: 'Cases', icon: '📁' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Inter', system-ui, sans-serif", color: '#0f172a' }}>
      
      <aside style={{ width: sidebarOpen ? '260px' : '80px', backgroundColor: '#0f172a', color: 'white', padding: '24px 16px', display: 'flex', flexDirection: 'column', transition: 'width 0.3s ease', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'space-between' : 'center', marginBottom: '40px' }}>
          {sidebarOpen && <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>SLA Tracker</h1>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px' }}>☰</button>
        </div>
        
        <nav style={{ flex: 1 }}>
          {navItems.map(item => (
            <div 
              key={item.id} 
              onClick={() => setActiveTab(item.id)}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', marginBottom: '5px', cursor: 'pointer',
                backgroundColor: activeTab === item.id ? '#1e293b' : 'transparent',
                color: activeTab === item.id ? 'white' : '#94a3b8',
                justifyContent: sidebarOpen ? 'flex-start' : 'center'
              }}
            >
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              {sidebarOpen && <span style={{ fontSize: '14px', fontWeight: 500 }}>{item.label}</span>}
            </div>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid #334155', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', flexShrink: 0 }}>
              {userEmail?.charAt(0).toUpperCase()}
            </div>
            {sidebarOpen && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Administrator</div>
              </div>
            )}
          </div>
          {sidebarOpen && <button onClick={onSignOut} style={{ width: '100%', padding: '8px', backgroundColor: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Sign Out</button>}
        </div>
      </aside>

      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        
        {activeTab === 'dashboard' && (
          <>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 5px 0' }}>Dashboard Overview</h2>
              <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Monitor all case statuses and SLA compliance in real-time.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
              <StatCard title="Total Cases" value={totalCases} color="#64748b" bg="#f1f5f9" />
              <StatCard title="In Progress" value={inProgress} color="#d97706" bg="#fef3c7" />
              <StatCard title="Completed" value={completed} color="#059669" bg="#d1fae5" />
              <StatCard title="Out of SLA" value={outOfSlaCases.length} color="#dc2626" bg="#fee2e2" />
            </div>

            <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', marginBottom: '32px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '16px', fontWeight: 600 }}>Data Synchronization</h3>
              <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>Upload your Excel workbook (.xlsx) to sync data.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <label style={{ padding: '10px 16px', backgroundColor: '#0f172a', color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                  Upload Excel
                  <input type="file" accept=".xlsx, .xls" onChange={handleMasterUpload} disabled={uploading} style={{ display: 'none' }} />
                </label>
                {uploadMessage && <span style={{ fontSize: '13px', fontWeight: 500, color: uploadMessage.includes('Error') || uploadMessage.includes('errors') ? '#dc2626' : '#059669' }}>{uploadMessage}</span>}
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>SLA Breaches Alert</h3>
                <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '13px' }}>Cases that have passed their due date.</p>
              </div>
              <div style={{ padding: '16px 24px' }}>
                {outOfSlaCases.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '14px' }}>No SLA breaches. All on track!</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {outOfSlaCases.slice(0, 5).map(c => {
                      const days = calculateSlaDays(c.sla_due_date);
                      return (
                        <div key={c.case_number} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{c.case_number}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{c.pic} | {c.country}</div>
                          </div>
                          <div style={{ padding: '4px 12px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                            🔴 {Math.abs(days)} days overdue
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'cases' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 5px 0' }}>Case Tracker</h2>
              <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Search and manage all disciplinary cases.</p>
            </div>

            <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
                <input 
                  type="text" placeholder="Search cases, PICs, respondents..." value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  style={{ width: '100%', padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }}
                />
              </div>
              
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading data...</div>
              ) : (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                        <Th>Case Number</Th>
                        <Th>PIC</Th>
                        <Th>Status</Th>
                        <Th>SLA</Th>
                        <Th style={{ textAlign: 'center', width: '60px' }}>Resp</Th>
                        <Th style={{ width: '140px' }}>Last Modified</Th>
                        <Th style={{ width: '120px' }}>Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentCases.map((c, index) => {
                        const slaDays = calculateSlaDays(c.sla_due_date);
                        const respondentCount = c.disciplinary_actions?.length || 0;
                        const isBreached = slaDays < 0 && c.case_status === 'IN PROGRESS';
                        const modifierName = c.modified_by_email ? c.modified_by_email.split('@')[0] : '—';
                        return (
                          <React.Fragment key={index}>
                            <tr style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', backgroundColor: selectedCase === c.case_number ? '#f8fafc' : 'white' }}>
                              <Td style={{ fontWeight: 600, color: '#0f172a' }}>{c.case_number}</Td>
                              <Td style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.pic || '—'}</Td>
                              <Td>
                                <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, backgroundColor: c.case_status === 'IN PROGRESS' ? '#dbeafe' : '#d1fae5', color: c.case_status === 'IN PROGRESS' ? '#2563eb' : '#059669', whiteSpace: 'nowrap' }}>{c.case_status}</span>
                              </Td>
                              <Td>
                                {c.case_status !== 'IN PROGRESS' ? '—' : (
                                  <span style={{ fontWeight: 600, color: isBreached ? '#dc2626' : '#059669', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                    {isBreached ? `🔴 ${Math.abs(slaDays)}d` : `🟢 ${slaDays}d`}
                                  </span>
                                )}
                              </Td>
                              <Td style={{ textAlign: 'center', fontWeight: 600, color: respondentCount > 0 ? '#2563eb' : '#94a3b8' }}>{respondentCount}</Td>
                              <Td>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{modifierName}</div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{formatTimeAgo(c.last_modified)}</div>
                              </Td>
                              <Td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button onClick={() => handleCaseClick(c.case_number)} style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap' }}>{selectedCase === c.case_number ? 'Hide' : 'View'}</button>
                                  {c.case_status === 'IN PROGRESS' && <button onClick={() => handleUpdateStatus(c.case_number, 'COMPLETED')} style={{ padding: '6px 12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap' }}>✓</button>}
                                </div>
                              </Td>
                            </tr>
                            
                            {selectedCase === c.case_number && (
                              <tr>
                                <td colSpan="7" style={{ padding: '24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                  <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                                      <div>
                                        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>CASE DETAILS</span>
                                        <div style={{ fontWeight: 600, fontSize: '16px', marginTop: '4px' }}>{c.case_number}</div>
                                        <div style={{ fontSize: '13px', color: '#64748b' }}>Country: {c.country || '—'} | Priority: {c.priority || '—'} | Stage: {c.stage || '—'}</div>
                                      </div>
                                      <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>SLA DUE DATE</span>
                                        <div style={{ fontWeight: 600, fontSize: '16px', marginTop: '4px' }}>{c.sla_due_date || '—'}</div>
                                        <div style={{ fontSize: '13px', color: '#64748b' }}>Created: {c.created_on || '—'}</div>
                                      </div>
                                    </div>
                                    
                                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginBottom: '20px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>⏳ WIP Tracker (Daily Actions)</h4>
                                        <button onClick={() => setShowWipForm(!showWipForm)} style={{ padding: '6px 12px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>{showWipForm ? 'Cancel' : '+ Log Action'}</button>
                                      </div>

                                      {showWipForm && (
                                        <form onSubmit={handleAddWIP} style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '2fr 3fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                                          <div>
                                            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Action Type</label>
                                            <select value={wipActionType} onChange={(e) => setWipActionType(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }}>
                                              <option value="">Select an action...</option>
                                              {mappingRules.map(rule => <option key={rule.id} value={rule.action_type}>{rule.action_type}</option>)}
                                            </select>
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Description</label>
                                            <input type="text" value={wipDesc} onChange={(e) => setWipDesc(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }} />
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Date Sent</label>
                                            <input type="date" value={wipDateSent} onChange={(e) => setWipDateSent(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }} />
                                          </div>
                                          <button type="submit" style={{ padding: '9px 16px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>Log</button>
                                        </form>
                                      )}

                                      {wipList.length === 0 ? (
                                        <div style={{ padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#94a3b8', fontSize: '13px' }}>No WIP actions logged yet.</div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          {wipList.map((w, i) => {
                                            const wipSlaDays = calculateSlaDays(w.expiry_date);
                                            return (
                                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: '#64748b', flexShrink: 0 }}>{i + 1}</div>
                                                <div style={{ flex: 1 }}>
                                                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{w.action_type}</div>
                                                  <div style={{ fontSize: '12px', color: '#64748b' }}>{w.description}</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Mapped Stage</div>
                                                  <span style={{ padding: '2px 8px', backgroundColor: '#dbeafe', color: '#2563eb', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>{w.stage_auto || '—'}</span>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>SLA Timer</div>
                                                  <span style={{ fontWeight: 600, fontSize: '13px', color: wipSlaDays < 0 ? '#dc2626' : '#059669' }}>{wipSlaDays < 0 ? `🔴 ${Math.abs(wipSlaDays)}d` : `🟢 ${wipSlaDays}d`}</span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>

                                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                                      <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>Disciplinary Actions (Respondents)</h4>
                                      {daList.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#94a3b8' }}>No respondents linked to this case.</div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                          {daList.map((da, i) => {
                                            const colors = getActionColor(da.current_action);
                                            return (
                                              <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                                  <div>
                                                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8' }}>Respondent: </span>
                                                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{da.respondent_name || '—'}</span>
                                                    <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>({da.respondent_id || '—'})</span>
                                                  </div>
                                                  <div style={{ textAlign: 'right' }}>
                                                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8' }}>Complainant: </span>
                                                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{da.complainant_name || '—'}</span>
                                                  </div>
                                                </div>
                                                
                                                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '8px' }}>Action Timeline</div>
                                                {da.action_history && da.action_history.length > 0 ? (
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {da.action_history.map((h, idx) => {
                                                      const hColors = getActionColor(h.action);
                                                      return (
                                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: '#64748b', flexShrink: 0 }}>{h.step}</div>
                                                          <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                                            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, backgroundColor: hColors.bg, color: hColors.text }}>{h.action || '—'}</span>
                                                            <span style={{ fontSize: '12px', color: '#64748b' }}>{h.date || 'No date'}</span>
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                ) : (
                                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, backgroundColor: colors.bg, color: colors.text }}>{da.current_action || '—'}</span>
                                                    <span style={{ fontSize: '12px', color: '#64748b' }}>{da.execution_date || 'No date'}</span>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid #e2e8f0' }}>
                    <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} style={{ padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1, fontSize: '13px', fontWeight: 500 }}>← Previous</button>
                    <span style={{ color: '#64748b', fontSize: '13px' }}>Page {currentPage} of {totalPages || 1} ({filteredCases.length} cases)</span>
                    <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} style={{ padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', opacity: (currentPage === totalPages || totalPages === 0) ? 0.5 : 1, fontSize: '13px', fontWeight: 500 }}>Next →</button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {activeTab === 'analytics' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 5px 0' }}>Analytics & Insights</h2>
              <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Visual breakdown of case metrics and performance.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
              <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>Case Status Breakdown</h3>
                <ChartRow label="In Progress" value={inProgress} total={totalCases} color="#3b82f6" />
                <ChartRow label="Completed" value={completed} total={totalCases} color="#10b981" />
                <ChartRow label="Cancelled" value={cases.filter(c => c.case_status === 'CANCELLED').length} total={totalCases} color="#ef4444" />
              </div>

              <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>SLA Compliance (Active Cases)</h3>
                <ChartRow label="Within SLA" value={inProgress - outOfSlaCases.length} total={inProgress} color="#10b981" />
                <ChartRow label="Out of SLA" value={outOfSlaCases.length} total={inProgress} color="#ef4444" />
              </div>

              <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>Priority Distribution</h3>
                <ChartRow label="High Priority" value={cases.filter(c => c.priority === 'High').length} total={totalCases} color="#ef4444" />
                <ChartRow label="Medium Priority" value={cases.filter(c => c.priority === 'Medium').length} total={totalCases} color="#f59e0b" />
                <ChartRow label="Low Priority" value={cases.filter(c => c.priority === 'Low').length} total={totalCases} color="#64748b" />
              </div>
            </div>
          </>
        )}

      </main>
    </div>
  );
}

function StatCard({ title, value, color, bg }) {
  return (
    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px', fontWeight: 500 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ fontSize: '28px', fontWeight: 700, color: color }}>{value}</span>
        <span style={{ fontSize: '13px', padding: '2px 8px', backgroundColor: bg, color: color, borderRadius: '12px', fontWeight: 600 }}>cases</span>
      </div>
    </div>
  );
}

function ChartRow({ label, value, total, color }) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{label}</span>
        <span style={{ fontSize: '14px', color: '#64748b' }}>{value} ({percent.toFixed(1)}%)</span>
      </div>
      <div style={{ width: '100%', backgroundColor: '#f1f5f9', borderRadius: '6px', height: '8px' }}>
        <div style={{ width: `${percent}%`, backgroundColor: color, height: '100%', borderRadius: '6px', transition: 'width 0.5s ease' }}></div>
      </div>
    </div>
  );
}

function Th({ children, style }) {
  return <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', ...style }}>{children}</th>;
}

function Td({ children, style }) {
  return <td style={{ padding: '14px 24px', fontSize: '14px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...style }}>{children}</td>;
}

export default App;