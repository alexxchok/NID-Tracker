// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabaseUrl = 'https://yymvagbwxdaxrldrhmtm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bXZhZ2J3eGRheHJsZHJobXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTEyMjcsImV4cCI6MjEwMjI2NzIyN30.W6WFGXzR7gMU0ln-vfMIJlsxwctWqnCv5Cb7qW8UXXY';
const supabase = createClient(supabaseUrl, supabaseKey);

const PUBLIC_HOLIDAYS = [];
const STANDARD_CASE_SLA_DAYS = 20;

const isHoliday = (dateObj) => {
  const dateStr = dateObj.toISOString().split('T')[0];
  return PUBLIC_HOLIDAYS.includes(dateStr);
};

const calculateBusinessDays = (dueDate) => {
  if (!dueDate) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
  let diff = 0;
  let cur = new Date(today);
  if (cur < due) {
    while (cur < due) {
      cur.setDate(cur.getDate() + 1);
      const day = cur.getDay();
      if (day !== 0 && day !== 6 && !isHoliday(cur)) diff++;
    }
    return diff;
  } else if (cur > due) {
    while (cur > due) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6 && !isHoliday(cur)) diff--;
      cur.setDate(cur.getDate() - 1);
    }
    return diff;
  }
  return 0;
};

const addBusinessDays = (startDate, daysToAdd) => {
  if (!startDate) return null;
  let date = new Date(startDate);
  date.setHours(0,0,0,0);
  let added = 0;
  while (added < daysToAdd) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6 && !isHoliday(date)) {
      added++;
    }
  }
  return date.toISOString().split('T')[0];
};

const calculatePriority = (slaDate) => {
  const days = calculateBusinessDays(slaDate);
  if (days <= 5) return 'High';
  if (days <= 10) return 'Medium';
  return 'Low';
};

// Format exact date and time using local timezone
const formatDateTime = (timestamp) => {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return date.toLocaleString('en-GB', { 
    day: '2-digit', month: 'short', year: 'numeric', 
    hour: '2-digit', minute: '2-digit', 
    timeZone: 'Asia/Kuala_Lumpur' 
  });
};

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

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
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">📊</div>
          <h2>SLA Tracker</h2>
          <p>Sign in to your dashboard</p>
        </div>
        <form onSubmit={handleLogin}>
          <div className="form-group"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="form-group"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          {error && <div className="error-box">{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
      </div>
    </div>
  );
}

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
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const [sortConfig, setSortConfig] = useState({ key: 'sla_due_date', direction: 'ascending' });

  // Add Case Form State (simplified - no priority, no stage, SLA auto-calculated)
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [newCaseNum, setNewCaseNum] = useState('');
  const [newPic, setNewPic] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newSlaDays, setNewSlaDays] = useState(20);

  // WIP Form State
  const [wipActionType, setWipActionType] = useState('');
  const [wipDesc, setWipDesc] = useState('');
  const [wipDateSent, setWipDateSent] = useState(new Date().toISOString().split('T')[0]);
  const [wipSlaDays, setWipSlaDays] = useState(2);
  const [wipNotes, setWipNotes] = useState('');
  const [editingWipId, setEditingWipId] = useState(null);

  // DA Add Action State
  const [addingDaFor, setAddingDaFor] = useState(null);
  const [newDaAction, setNewDaAction] = useState('');
  const [newDaDate, setNewDaDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedDAs, setExpandedDAs] = useState({});
  const [newViolation, setNewViolation] = useState({});

  // Add Complainant/Respondent State
  const [showAddPersonForm, setShowAddPersonForm] = useState(null); // 'complainant' | 'respondent' | null
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonId, setNewPersonId] = useState('');
  const [newPersonCountry, setNewPersonCountry] = useState('');

  const fetchCases = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('cases').select('*, disciplinary_actions(respondent_name, respondent_id, complainant_name, complainant_id, current_action, violations), wip_actions(status)').order('sla_due_date', { ascending: true });
    if (error) console.error('Error:', error);
    else setCases(data);
    setLoading(false);
  };

  useEffect(() => { 
    fetchCases(); 
    supabase.from('mapping_rules').select('*').then(({ data }) => setMappingRules(data || []));
  }, []);

  const cleanVal = (val) => val === undefined || val === null ? null : String(val).trim() === '' ? null : String(val).trim();

  const formatDateString = (dateStr) => {
    if (!dateStr && dateStr !== 0) return null;
    if (typeof dateStr === 'string' && !isNaN(dateStr) && dateStr.trim() !== '') dateStr = parseFloat(dateStr);
    if (typeof dateStr === 'number') {
      const utc_days = Math.floor(dateStr - 25569);
      const date_info = new Date(utc_days * 86400 * 1000);
      if (!isNaN(date_info.getTime())) return `${date_info.getFullYear()}-${String(date_info.getMonth() + 1).padStart(2, '0')}-${String(date_info.getDate()).padStart(2, '0')}`;
    }
    const cleanStr = String(dateStr).trim().split(' ')[0];
    const parts = cleanStr.split(/[-/]/);
    if (parts.length === 3) {
      let [p1, p2, p3] = parts.map(p => parseInt(p, 10));
      if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
        if (p3 < 100) p3 = 2000 + p3;
        let dateObj = new Date(p3, p2 - 1, p1);
        if (p2 > 12 && p1 <= 12) dateObj = new Date(p3, p1 - 1, p2);
        if (!isNaN(dateObj.getTime())) return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      }
    }
    const fallbackDate = new Date(cleanStr);
    if (!isNaN(fallbackDate.getTime())) {
      const year = fallbackDate.getFullYear();
      if (year > 1900 && year < 2100) return `${year}-${String(fallbackDate.getMonth() + 1).padStart(2, '0')}-${String(fallbackDate.getDate()).padStart(2, '0')}`;
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
        if (headers.some(h => h.includes(headerSearch.toLowerCase()))) return name;
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
          const json = XLSX.utils.sheet_to_json(wb.Sheets[slaSheetName], { defval: null });
          casesToUpsert = json.map(row => {
            const getVal = (s) => { for (let k in row) { if (k.trim().toLowerCase().includes(s.toLowerCase())) return row[k]; } return null; };
            const caseNum = cleanVal(getVal(["CASE NUMBER", "Case Number", "CXN No"]));
            if (!caseNum) return null;
            return {
              case_number: caseNum, created_on: formatDateString(cleanVal(getVal(["CREATED ON"]))), sla_due_date: formatDateString(cleanVal(getVal(["CASE DUE DATE", "SLA DATE", "Due Date"]))),
              country: cleanVal(getVal(["COUNTRY"])), pic: cleanVal(getVal(["PIC"])), priority: cleanVal(getVal(["PRIORITY"])) || 'Medium',
              case_status: cleanVal(getVal(["CASE STATUS", "Status"])) || 'IN PROGRESS', stage: cleanVal(getVal(["STAGE OF CASE"])),
              date_completed: formatDateString(cleanVal(getVal(["DATE COMPLETED"]))), remarks: cleanVal(getVal(["REMARKS"]))
            };
          }).filter(Boolean);
        }

        let daDataToInsert = [];
        let daSheetName = findSheetByHeader(wb, "Action Taken 1") || findSheetByHeader(wb, "Current Action");
        if (daSheetName) {
          const json = XLSX.utils.sheet_to_json(wb.Sheets[daSheetName], { defval: null });
          daDataToInsert = json.map(row => {
            const getVal = (s) => { for (let k in row) { if (k.trim().toLowerCase().includes(s.toLowerCase())) return row[k]; } return null; };
            const caseNum = cleanVal(getVal(["CXN No", "CXN #"]));
            const respId = cleanVal(getVal(["Respondent ID#", "Respondent ID No", "Respondents' IR ID No"]));
            let history = [];
            for (let i = 1; i <= 4; i++) {
              const action = cleanVal(getVal([`Action Taken ${i}`]));
              const date = formatDateString(cleanVal(getVal([`Date of execution ${i}`])));
              if (action) history.push({ step: i, action, date });
            }
            if (history.length === 0) {
              const currAction = cleanVal(getVal(["Current Action"]));
              const currDate = formatDateString(cleanVal(getVal(["Current Action (Execution Date)", "Execution Date"])));
              if (currAction) history.push({ step: 1, action: currAction, date: currDate });
              const prevAction = cleanVal(getVal(["Previous Action"]));
              const prevDate = formatDateString(cleanVal(getVal(["(Previous Action (Execution Date)"])));
              if (prevAction) history.push({ step: 2, action: prevAction, date: prevDate });
            }
            const latestAction = history.length > 0 ? history[history.length - 1].action : null;
            const latestDate = history.length > 0 ? history[history.length - 1].date : null;
            return {
              case_number: caseNum, complainant_name: cleanVal(getVal(["Complainant Name", "Complainant's Name and IR ID No"])), complainant_id: cleanVal(getVal(["Complainant ID#"])),
              respondent_name: cleanVal(getVal(["Respondent Name", "Respondent's Name"])), respondent_id: respId,
              current_action: latestAction, execution_date: latestDate,
              action_history: history.length > 0 ? history : null, remarks: cleanVal(getVal(["Remarks"])),
              unique_key: caseNum && respId ? `${caseNum}|${respId}` : null
            };
          }).filter(item => item && item.case_number && item.unique_key);
        }

        if (casesToUpsert.length === 0 && daDataToInsert.length === 0) { setUploadMessage('❌ Error: No valid data found.'); setUploading(false); return; }

        setUploadMessage('3/5 Syncing Cases...');
        if (casesToUpsert.length > 0) for (let chunk of chunkArray(casesToUpsert, 100)) await supabase.from('cases').upsert(chunk, { onConflict: 'case_number' });

        setUploadMessage('4/5 Ensuring parent cases exist...');
        const { data: existingCases } = await supabase.from('cases').select('case_number');
        const existingSet = new Set(existingCases.map(c => c.case_number));
        const missingCases = [...new Set(daDataToInsert.map(item => item.case_number))].filter(cn => !existingSet.has(cn) && !casesToUpsert.some(c => c.case_number === cn)).map(cn => {
          const today = new Date(); const slaDate = new Date(today.setDate(today.getDate() + 30)).toISOString().split('T')[0];
          return { case_number: cn, case_status: 'IN PROGRESS', sla_due_date: slaDate, created_on: new Date().toISOString().split('T')[0], priority: 'Medium', stage: 'Stage 1' };
        });
        if (missingCases.length > 0) for (let chunk of chunkArray(missingCases, 100)) await supabase.from('cases').upsert(chunk, { onConflict: 'case_number', ignoreDuplicates: true });

        setUploadMessage('5/5 Uploading Respondents...');
        const uniqueMap = new Map();
        daDataToInsert.forEach(item => uniqueMap.set(item.unique_key, item));
        const finalDataToInsert = Array.from(uniqueMap.values());
        let errorCount = 0; let firstError = null;
        for (let chunk of chunkArray(finalDataToInsert, 100)) {
          const { error } = await supabase.from('disciplinary_actions').upsert(chunk, { onConflict: 'unique_key' });
          if (error) { errorCount++; if (!firstError) firstError = error.message; }
        }
        let finalMsg = `✅ Sync Complete! `;
        if (casesToUpsert.length > 0) finalMsg += `Updated ${casesToUpsert.length} Cases. `;
        if (finalDataToInsert.length > 0) finalMsg += `Processed ${finalDataToInsert.length} Respondents. `;
        if (missingCases.length > 0) finalMsg += `Auto-created ${missingCases.length} missing Cases. `;
        if (errorCount > 0) finalMsg = `⚠️ Completed with ${errorCount} errors. First: ${firstError}`;
        setUploadMessage(finalMsg);
        fetchCases(); setUploading(false);
      } catch (err) { setUploadMessage(`❌ Unexpected Error: ${err.message}`); setUploading(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCaseClick = async (caseNum) => {
    if (selectedCase === caseNum) { setSelectedCase(null); return; }
    setSelectedCase(caseNum);
    setShowWipForm(false);
    setEditingWipId(null);
    setAddingDaFor(null);
    setShowAddPersonForm(null);
    const { data: daData } = await supabase.from('disciplinary_actions').select('*').eq('case_number', caseNum);
    const { data: wipData } = await supabase.from('wip_actions').select('*').eq('case_number', caseNum).order('date_sent', { ascending: false });
    setDaList(daData || []); setWipList(wipData || []);
  };

  // --- ADD CASE (Simplified: No Priority, No Stage, SLA auto-calculated) ---
  const handleAddCase = async (e) => {
    e.preventDefault();
    const today = new Date().toISOString().split('T')[0];
    const slaDate = addBusinessDays(today, newSlaDays);
    const priority = calculatePriority(slaDate);
    
    const { error } = await supabase.from('cases').insert([{ 
      case_number: newCaseNum, pic: newPic, country: newCountry, case_status: 'IN PROGRESS', 
      sla_due_date: slaDate, priority: priority, stage: 'Stage 1', created_on: today
    }]);
    if (error) {
      alert('Error saving case: ' + error.message);
    } else {
      setShowCaseForm(false);
      setNewCaseNum(''); setNewPic(''); setNewCountry(''); setNewSlaDays(20);
      fetchCases(); 
    }
  };

  // --- COMPLETE / REACTIVATE CASE ---
  const handleCompleteCase = async (caseNum) => {
    const { error } = await supabase.from('cases').update({ 
      case_status: 'COMPLETED', date_completed: new Date().toISOString().split('T')[0], modified_by_email: userEmail 
    }).eq('case_number', caseNum);
    if (error) alert('Error completing case: ' + error.message);
    else fetchCases();
  };

  const handleReactivateCase = async (caseNum) => {
    const today = new Date().toISOString().split('T')[0];
    const newSlaDate = addBusinessDays(today, STANDARD_CASE_SLA_DAYS);
    const { error } = await supabase.from('cases').update({ 
      case_status: 'IN PROGRESS', date_completed: null, sla_due_date: newSlaDate, priority: calculatePriority(newSlaDate), modified_by_email: userEmail 
    }).eq('case_number', caseNum);
    if (error) alert('Error reactivating case: ' + error.message);
    else fetchCases();
  };

  // --- WIP LOGIC ---
  const resetWipForm = () => {
    setWipActionType(''); setWipDesc(''); setWipDateSent(new Date().toISOString().split('T')[0]); setWipSlaDays(2); setWipNotes(''); setEditingWipId(null); setShowWipForm(false);
  };

  const handleAddWIP = async (e) => {
    e.preventDefault();
    const rule = mappingRules.find(r => r.action_type === wipActionType);
    let stageToAssign = rule?.default_stage || null;
    let slaDays = Math.max(1, Math.min(100, wipSlaDays || rule?.default_sla_days || 2));

    if (rule && rule.initial_stage && rule.concluding_stage) {
      const currentCase = cases.find(c => c.case_number === selectedCase);
      const currentStageNum = parseInt(currentCase?.stage?.replace('Stage ', '') || '0', 10);
      stageToAssign = currentStageNum >= 6 ? rule.concluding_stage : rule.initial_stage;
    }
    
    let expiryDate = addBusinessDays(wipDateSent, slaDays);

    if (editingWipId) {
      const { error } = await supabase.from('wip_actions').update({ 
        action_type: wipActionType, description: wipDesc, stage_auto: stageToAssign,
        date_sent: wipDateSent, sla_days: slaDays, expiry_date: expiryDate, notes: wipNotes, pic: userEmail, last_modified: new Date().toISOString()
      }).eq('id', editingWipId);
      if (error) alert('Error updating WIP: ' + error.message);
    } else {
      const { error } = await supabase.from('wip_actions').insert([{ 
        case_number: selectedCase, action_type: wipActionType, description: wipDesc, stage_auto: stageToAssign,
        date_sent: wipDateSent, sla_days: slaDays, expiry_date: expiryDate, status: 'Pending', notes: wipNotes, pic: userEmail,
        last_modified: new Date().toISOString()
      }]);
      if (error) alert('Error logging WIP: ' + error.message);
    }

    if (stageToAssign) await supabase.from('cases').update({ stage: stageToAssign, modified_by_email: userEmail }).eq('case_number', selectedCase);
    
    const { data: newWipData } = await supabase.from('wip_actions').select('*').eq('case_number', selectedCase).order('date_sent', { ascending: false });
    setWipList(newWipData || []);
    resetWipForm();
    fetchCases();
  };

  const handleEditWip = (w) => {
    setEditingWipId(w.id);
    setWipActionType(w.action_type);
    setWipDesc(w.description);
    setWipDateSent(w.date_sent);
    setWipSlaDays(w.sla_days);
    setWipNotes(w.notes || '');
    setShowWipForm(true);
  };

  const handleCompleteWip = async (wipId) => {
    const { error } = await supabase.from('wip_actions').update({ 
      status: 'Done', completed_at: new Date().toISOString(), pic: userEmail, last_modified: new Date().toISOString()
    }).eq('id', wipId);
    if (error) alert('Error completing WIP: ' + error.message);
    else {
      const { data: newWipData } = await supabase.from('wip_actions').select('*').eq('case_number', selectedCase).order('date_sent', { ascending: false });
      setWipList(newWipData || []);
      fetchCases();
    }
  };

  // --- DA LOGIC ---
  const handleAddDaAction = async (e, daId) => {
    e.preventDefault();
    const da = daList.find(d => d.id === daId);
    if (!da) return;
    
    const history = da.action_history || [];
    history.push({ 
      step: history.length + 1, 
      action: newDaAction, 
      date: newDaDate, 
      added_by: userEmail, 
      added_at: new Date().toISOString() 
    });

    const { error } = await supabase.from('disciplinary_actions').update({ 
      action_history: history, 
      current_action: newDaAction, 
      execution_date: newDaDate,
      modified_by_email: userEmail,
      last_modified: new Date().toISOString()
    }).eq('id', daId);

    if (error) alert('Error adding action: ' + error.message);
    else {
      const { data: newDaData } = await supabase.from('disciplinary_actions').select('*').eq('case_number', selectedCase);
      setDaList(newDaData || []);
      setAddingDaFor(null);
      setNewDaAction('');
      setNewDaDate(new Date().toISOString().split('T')[0]);
      fetchCases();
    }
  };

  const handleAddViolation = async (daId) => {
    const violationText = newViolation[daId];
    if (!violationText) return;
    const da = daList.find(d => d.id === daId);
    const violations = da.violations || [];
    violations.push(violationText);

    const { error } = await supabase.from('disciplinary_actions').update({ 
      violations: violations, modified_by_email: userEmail, last_modified: new Date().toISOString()
    }).eq('id', daId);

    if (error) alert('Error adding violation: ' + error.message);
    else {
      const { data: newDaData } = await supabase.from('disciplinary_actions').select('*').eq('case_number', selectedCase);
      setDaList(newDaData || []);
      setNewViolation(prev => ({ ...prev, [daId]: '' }));
    }
  };

  const handleDeleteViolation = async (daId, index) => {
    const da = daList.find(d => d.id === daId);
    const violations = da.violations || [];
    violations.splice(index, 1);

    const { error } = await supabase.from('disciplinary_actions').update({ 
      violations: violations, modified_by_email: userEmail, last_modified: new Date().toISOString()
    }).eq('id', daId);

    if (error) alert('Error deleting violation: ' + error.message);
    else {
      const { data: newDaData } = await supabase.from('disciplinary_actions').select('*').eq('case_number', selectedCase);
      setDaList(newDaData || []);
    }
  };

  const toggleExpandDA = (daId) => {
    setExpandedDAs(prev => ({ ...prev, [daId]: !prev[daId] }));
  };

  // --- ADD COMPLAINANT / RESPONDENT ---
  const handleAddPerson = async (e) => {
    e.preventDefault();
    const timestamp = Date.now();
    const uniqueKey = `${selectedCase}|${showAddPersonForm}_${timestamp}`;
    
    const insertData = {
      case_number: selectedCase,
      unique_key: uniqueKey,
      modified_by_email: userEmail,
      last_modified: new Date().toISOString()
    };

    if (showAddPersonForm === 'complainant') {
      insertData.complainant_name = newPersonName;
      insertData.complainant_id = newPersonId;
      insertData.complainant_country = newPersonCountry;
    } else {
      insertData.respondent_name = newPersonName;
      insertData.respondent_id = newPersonId;
      insertData.respondent_country = newPersonCountry;
    }

    const { error } = await supabase.from('disciplinary_actions').insert([insertData]);
    
    if (error) {
      alert('Error adding ' + showAddPersonForm + ': ' + error.message);
    } else {
      const { data: newDaData } = await supabase.from('disciplinary_actions').select('*').eq('case_number', selectedCase);
      setDaList(newDaData || []);
      setShowAddPersonForm(null);
      setNewPersonName(''); setNewPersonId(''); setNewPersonCountry('');
      fetchCases();
    }
  };

  // --- SORTING LOGIC ---
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const filteredCases = cases.filter(c => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const matchCase = c.case_number?.toLowerCase().includes(search);
    const matchPic = c.pic?.toLowerCase().includes(search);
    const matchCountry = c.country?.toLowerCase().includes(search);
    const matchRespondent = c.disciplinary_actions?.some(da => da.respondent_name?.toLowerCase().includes(search) || da.respondent_id?.toLowerCase().includes(search));
    const matchComplainant = c.disciplinary_actions?.some(da => da.complainant_name?.toLowerCase().includes(search) || da.complainant_id?.toLowerCase().includes(search));
    return matchCase || matchPic || matchCountry || matchRespondent || matchComplainant;
  });

  const sortedCases = React.useMemo(() => {
    let sortableCases = [...filteredCases];
    if (sortConfig.key === 'da_in_force') {
      sortableCases.sort((a, b) => {
        const aCount = a.disciplinary_actions?.filter(da => {
          const action = da.current_action?.toLowerCase() || '';
          return action.includes('suspend') || action.includes('terminat');
        }).length || 0;
        const bCount = b.disciplinary_actions?.filter(da => {
          const action = da.current_action?.toLowerCase() || '';
          return action.includes('suspend') || action.includes('terminat');
        }).length || 0;
        return sortConfig.direction === 'ascending' ? aCount - bCount : bCount - aCount;
      });
    } else if (sortConfig.key === 'active_wip') {
      sortableCases.sort((a, b) => {
        const aCount = a.wip_actions?.filter(w => w.status === 'Pending').length || 0;
        const bCount = b.wip_actions?.filter(w => w.status === 'Pending').length || 0;
        return sortConfig.direction === 'ascending' ? aCount - bCount : bCount - aCount;
      });
    } else if (sortConfig.key) {
      sortableCases.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableCases;
  }, [filteredCases, sortConfig]);

  const totalPages = Math.ceil(sortedCases.length / pageSize);
  const currentCases = sortedCases.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalCases = cases.length;
  const inProgress = cases.filter(c => c.case_status === 'IN PROGRESS').length;
  const completed = cases.filter(c => c.case_status === 'COMPLETED').length;
  const outOfSlaCases = cases.filter(c => calculateBusinessDays(c.sla_due_date) < 0 && c.case_status === 'IN PROGRESS');

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

  const SortIndicator = ({ column }) => {
    if (sortConfig.key !== column) return <span style={{ color: '#cbd5e1', marginLeft: '4px' }}>↕</span>;
    return sortConfig.direction === 'ascending' ? <span style={{ marginLeft: '4px' }}>▲</span> : <span style={{ marginLeft: '4px' }}>▼</span>;
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        .auth-wrapper { display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #0f172a; }
        .auth-card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); width: 100%; max-width: 420px; margin: 16px; }
        .auth-header { text-align: center; margin-bottom: 30px; }
        .auth-icon { display: inline-block; padding: 12px; background-color: #3b82f6; border-radius: 12px; margin-bottom: 15px; color: white; font-size: 24px; }
        .auth-header h2 { margin: 0; color: #0f172a; font-size: 24px; font-weight: 600; }
        .auth-header p { color: #64748b; margin-top: 5px; font-size: 14px; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; margin-bottom: 6px; font-size: 14px; font-weight: 500; color: #334155; }
        .form-group input { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; }
        .error-box { color: #ef4444; font-size: 14px; margin-bottom: 16px; padding: 10px; background-color: #fee2e2; border-radius: 6px; }
        .btn-primary { width: 100%; background-color: #0f172a; color: white; padding: 14px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 15px; }
        .app-container { display: flex; min-height: 100vh; background-color: #f8fafc; color: #0f172a; }
        .sidebar { width: 260px; background-color: #0f172a; color: white; padding: 24px 16px; display: flex; flex-direction: column; transition: width 0.3s ease; flex-shrink: 0; }
        .sidebar.collapsed { width: 80px; }
        .sidebar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; }
        .sidebar-header.collapsed { justify-content: center; }
        .sidebar-header h1 { font-size: 20px; font-weight: 600; margin: 0; white-space: nowrap; }
        .sidebar-toggle { background: transparent; border: none; color: white; cursor: pointer; font-size: 20px; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; margin-bottom: 5px; cursor: pointer; }
        .nav-item:hover { background-color: #1e293b; }
        .nav-item.active { background-color: #1e293b; color: white; }
        .nav-item.inactive { color: #94a3b8; }
        .nav-item.collapsed { justify-content: center; }
        .nav-item span.icon { font-size: 18px; }
        .nav-item span.label { font-size: 14px; font-weight: 500; }
        .sidebar-footer { margin-top: auto; border-top: 1px solid #334155; padding-top: 16px; }
        .user-info { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .user-info.collapsed { justify-content: center; }
        .user-avatar { width: 36px; height: 36px; border-radius: 50%; background-color: #3b82f6; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
        .user-details .email { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .user-details .role { font-size: 12px; color: #94a3b8; }
        .btn-signout { width: 100%; padding: 8px; background-color: transparent; border: 1px solid #334155; color: #94a3b8; border-radius: 6px; cursor: pointer; font-size: 13px; }
        .main-content { flex: 1; padding: 24px; overflow-y: auto; }
        .page-header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
        .page-header-text h2 { font-size: 22px; font-weight: 600; margin: 0 0 5px 0; }
        .page-header-text p { color: '#64748b'; margin: 0; font-size: 13px; }
        .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; margin-bottom: 24px; }
        .card-header { margin-top: 0; margin-bottom: 8px; font-size: 16px; font-weight: 600; }
        .card-subtitle { color: #64748b; font-size: 13px; margin-bottom: 16px; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; }
        @media (min-width: 768px) { .stats-grid { grid-template-columns: repeat(4, 1fr); gap: 16px; } }
        .stat-card { background: white; padding: 16px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
        .stat-title { font-size: 12px; color: #64748b; margin-bottom: 4px; font-weight: 500; }
        .stat-value { display: flex; align-items: baseline; gap: 6px; }
        .stat-number { font-size: 24px; font-weight: 700; color: #0f172a; }
        .stat-badge { font-size: 11px; padding: 2px 6px; border-radius: 10px; font-weight: 600; }
        .upload-area { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .btn-upload { padding: 10px 16px; background-color: #0f172a; color: white; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; display: inline-block; }
        .upload-msg { font-size: 13px; font-weight: 500; color: #059669; }
        .btn-add-case { padding: 10px 16px; background-color: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; }
        .add-case-form { background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #e2e8f0; }
        .form-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 768px) { .form-grid { grid-template-columns: repeat(4, 1fr); align-items: end; } }
        .table-container { overflow-x: auto; border-radius: 12px; border: 1px solid #e2e8f0; background: white; }
        .table { width: 100%; border-collapse: collapse; text-align: left; min-width: 900px; }
        .table thead tr { border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; }
        .table th { padding: 12px 16px; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; cursor: pointer; }
        .table th:hover { background-color: #f1f5f9; }
        .table td { padding: 12px 16px; font-size: 13px; color: #475569; white-space: nowrap; border-bottom: 1px solid #f1f5f9; }
        .table tbody tr { cursor: pointer; transition: background-color 0.2s; }
        .table tbody tr:hover { background-color: #f9fafb; }
        .table tbody tr.selected { background-color: #f8fafc; }
        .badge { padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; white-space: nowrap; }
        .badge-blue { background-color: #dbeafe; color: #2563eb; }
        .badge-green { background-color: #d1fae5; color: #059669; }
        .badge-red { background-color: #fee2e2; color: #dc2626; }
        .badge-yellow { background-color: #fef3c7; color: #d97706; }
        .badge-grey { background-color: #e2e8f0; color: #64748b; }
        .badge-purple { background-color: #f3e8ff; color: #9333ea; }
        .btn-action { padding: 6px 10px; background-color: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; white-space: nowrap; margin-right: 4px; }
        .btn-success { background-color: #10b981; color: white; border: none; }
        .btn-warning { background-color: #f59e0b; color: white; border: none; }
        .btn-danger { background-color: #ef4444; color: white; border: none; }
        .btn-purple { background-color: #8b5cf6; color: white; border: none; }
        .expanded-content { padding: 16px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        .expanded-card { background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 16px; }
        .expanded-header { display: flex; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
        .expanded-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; display: block; margin-bottom: 4px; }
        .expanded-value { font-weight: 600; font-size: 15px; }
        .expanded-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
        .section-divider { border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 16px; }
        .section-title { margin: 0 0 12px 0; font-size: 14px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
        .wip-form { background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px; display: grid; grid-template-columns: 1fr; gap: 8px; }
        @media (min-width: 768px) { .wip-form { grid-template-columns: 2fr 2fr 1fr 1fr 2fr auto; align-items: end; } }
        .wip-input-group label { font-size: 10px; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px; }
        .wip-input-group select, .wip-input-group input, .wip-input-group textarea { width: 100%; padding: 6px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; }
        .wip-input-group textarea { resize: vertical; min-height: 32px; }
        .btn-log { padding: 8px 12px; background-color: #0f172a; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
        .list-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px; background-color: #f8fafc; border-radius: 8px; margin-bottom: 8px; flex-wrap: wrap; }
        .list-item.done { opacity: 0.5; background-color: #f1f5f9; }
        .step-circle { width: 22px; height: 22px; border-radius: 50%; background-color: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: #64748b; flex-shrink: 0; margin-top: 2px; }
        .item-content { flex: 1; min-width: 150px; }
        .item-title { font-weight: 600; font-size: 13px; color: #0f172a; }
        .item-sub { font-size: 11px; color: #64748b; margin-top: 4px; white-space: pre-wrap; }
        .item-meta { text-align: right; }
        .item-actions { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
        .pagination { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-top: 1px solid #e2e8f0; }
        .btn-page { padding: 6px 12px; background-color: white; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; }
        .btn-page:disabled { opacity: 0.5; cursor: not-allowed; }
        .chart-row { margin-bottom: 16px; }
        .chart-label { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
        .chart-track { width: 100%; background-color: #f1f5f9; border-radius: 6px; height: 8px; overflow: hidden; }
        .chart-fill { height: 100%; border-radius: 6px; transition: width 0.5s ease; }
        .person-form { background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px; display: grid; grid-template-columns: 1fr; gap: 8px; }
        @media (min-width: 768px) { .person-form { grid-template-columns: 2fr 2fr 2fr auto; align-items: end; } }
        @media (max-width: 768px) {
          .sidebar { position: fixed; left: 0; top: 0; bottom: 0; z-index: 100; box-shadow: 2px 0 10px rgba(0,0,0,0.1); }
          .sidebar.collapsed { transform: translateX(-100%); width: 260px; }
          .main-content { padding: 16px; }
        }
      `}</style>
      
      <div className="app-container">
        <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
          <div className={`sidebar-header ${sidebarOpen ? '' : 'collapsed'}`}>
            {sidebarOpen && <h1>SLA Tracker</h1>}
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="sidebar-toggle">☰</button>
          </div>
          <nav style={{ flex: 1 }}>
            {navItems.map(item => (
              <div key={item.id} onClick={() => setActiveTab(item.id)} className={`nav-item ${activeTab === item.id ? 'active' : 'inactive'} ${sidebarOpen ? '' : 'collapsed'}`}>
                <span className="icon">{item.icon}</span>
                {sidebarOpen && <span className="label">{item.label}</span>}
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className={`user-info ${sidebarOpen ? '' : 'collapsed'}`}>
              <div className="user-avatar">{userEmail?.charAt(0).toUpperCase()}</div>
              {sidebarOpen && (<div className="user-details"><div className="email">{userEmail}</div><div className="role">Administrator</div></div>)}
            </div>
            {sidebarOpen && <button onClick={onSignOut} className="btn-signout">Sign Out</button>}
          </div>
        </aside>

        <main className="main-content">
          
          {activeTab === 'dashboard' && (
            <>
              <div className="page-header">
                <div className="page-header-text">
                  <h2>Dashboard Overview</h2>
                  <p>Monitor all case statuses and SLA compliance in real-time.</p>
                </div>
              </div>
              <div className="stats-grid">
                <div className="stat-card"><div className="stat-title">Total Cases</div><div className="stat-value"><span className="stat-number">{totalCases}</span><span className="stat-badge badge-grey">cases</span></div></div>
                <div className="stat-card"><div className="stat-title">In Progress</div><div className="stat-value"><span className="stat-number" style={{color: '#d97706'}}>{inProgress}</span><span className="stat-badge badge-yellow">cases</span></div></div>
                <div className="stat-card"><div className="stat-title">Completed</div><div className="stat-value"><span className="stat-number" style={{color: '#059669'}}>{completed}</span><span className="stat-badge badge-green">cases</span></div></div>
                <div className="stat-card"><div className="stat-title">Out of SLA</div><div className="stat-value"><span className="stat-number" style={{color: '#dc2626'}}>{outOfSlaCases.length}</span><span className="stat-badge badge-red">cases</span></div></div>
              </div>
              <div className="card">
                <h3 className="card-header">Data Synchronization</h3>
                <p className="card-subtitle">Upload your Excel workbook (.xlsx) to sync data.</p>
                <div className="upload-area">
                  <label className="btn-upload">Upload Excel<input type="file" accept=".xlsx, .xls" onChange={handleMasterUpload} disabled={uploading} style={{ display: 'none' }} /></label>
                  {uploadMessage && <span className="upload-msg" style={{ color: uploadMessage.includes('Error') ? '#dc2626' : '#059669' }}>{uploadMessage}</span>}
                </div>
              </div>
              <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 className="card-header" style={{ margin: 0 }}>SLA Breaches Alert</h3>
                  <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '13px' }}>Cases that have passed their due date.</p>
                </div>
                <div style={{ padding: '16px' }}>
                  {outOfSlaCases.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '14px' }}>No SLA breaches. All on track!</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {outOfSlaCases.slice(0, 5).map(c => {
                        const days = calculateBusinessDays(c.sla_due_date);
                        return (
                          <div key={c.case_number} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                            <div><div style={{ fontWeight: 600, fontSize: '14px' }}>{c.case_number}</div><div style={{ fontSize: '12px', color: '#64748b' }}>{c.pic} | {c.country}</div></div>
                            <div className="badge badge-red">🔴 {Math.abs(days)} working days overdue</div>
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
              <div className="page-header">
                <div className="page-header-text">
                  <h2>Case Tracker</h2>
                  <p>Search and manage all disciplinary cases. Click column headers to sort.</p>
                </div>
                <button onClick={() => setShowCaseForm(!showCaseForm)} className="btn-add-case">{showCaseForm ? 'Close Form' : '+ Add New Case'}</button>
              </div>

              {showCaseForm && (
                <form onSubmit={handleAddCase} className="add-case-form">
                  <div className="form-grid">
                    <div className="wip-input-group"><label>Case Number</label><input type="text" value={newCaseNum} onChange={(e) => setNewCaseNum(e.target.value)} required /></div>
                    <div className="wip-input-group"><label>PIC</label><input type="text" value={newPic} onChange={(e) => setNewPic(e.target.value)} /></div>
                    <div className="wip-input-group"><label>Country</label><input type="text" value={newCountry} onChange={(e) => setNewCountry(e.target.value)} required /></div>
                    <div className="wip-input-group"><label>SLA Days (auto-calculates due date)</label><input type="number" min="1" max="100" value={newSlaDays} onChange={(e) => setNewSlaDays(parseInt(e.target.value) || 20)} required /></div>
                    <button type="submit" className="btn-log" style={{ backgroundColor: '#10b981' }}>Save Case</button>
                  </div>
                </form>
              )}

              <div className="table-container">
                <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
                  <input type="text" placeholder="Search cases, PICs, respondents, complainants..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }} />
                </div>
                
                {loading ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading data...</div>
                ) : (
                  <>
                    <table className="table">
                      <thead>
                        <tr>
                          <th onClick={() => requestSort('case_number')}>Case Number <SortIndicator column="case_number" /></th>
                          <th onClick={() => requestSort('pic')}>PIC <SortIndicator column="pic" /></th>
                          <th onClick={() => requestSort('case_status')}>Status <SortIndicator column="case_status" /></th>
                          <th onClick={() => requestSort('sla_due_date')}>SLA Date <SortIndicator column="sla_due_date" /></th>
                          <th onClick={() => requestSort('da_in_force')}>DA In Force <SortIndicator column="da_in_force" /></th>
                          <th onClick={() => requestSort('active_wip')}>Active WIP <SortIndicator column="active_wip" /></th>
                          <th style={{ width: '80px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentCases.map((c, index) => {
                          const slaDays = calculateBusinessDays(c.sla_due_date);
                          const daInForce = c.disciplinary_actions?.filter(da => {
                            const action = da.current_action?.toLowerCase() || '';
                            return action.includes('suspend') || action.includes('terminat');
                          }).length || 0;
                          const activeWip = c.wip_actions?.filter(w => w.status === 'Pending').length || 0;
                          const isBreached = slaDays < 0 && c.case_status === 'IN PROGRESS';
                          return (
                            <React.Fragment key={index}>
                              <tr className={selectedCase === c.case_number ? 'selected' : ''}>
                                <td style={{ fontWeight: 600, color: '#0f172a' }}>{c.case_number}</td>
                                <td>{c.pic || '—'}</td>
                                <td><span className={`badge ${c.case_status === 'IN PROGRESS' ? 'badge-blue' : 'badge-green'}`}>{c.case_status}</span></td>
                                <td style={{ color: isBreached ? '#dc2626' : '#059669', fontWeight: 600 }}>{c.sla_due_date || '—'}</td>
                                <td style={{ textAlign: 'center', fontWeight: 600, color: daInForce > 0 ? '#dc2626' : '#94a3b8' }}>{daInForce}</td>
                                <td style={{ textAlign: 'center', fontWeight: 600, color: activeWip > 0 ? '#8b5cf6' : '#94a3b8' }}>{activeWip}</td>
                                <td><button onClick={() => handleCaseClick(c.case_number)} className="btn-action">{selectedCase === c.case_number ? 'Hide' : 'View'}</button></td>
                              </tr>
                              
                              {selectedCase === c.case_number && (
                                <tr>
                                  <td colSpan="7" className="expanded-content">
                                    <div className="expanded-card">
                                      <div className="expanded-header">
                                        <div>
                                          <span className="expanded-label">CASE DETAILS</span>
                                          <div className="expanded-value">{c.case_number}</div>
                                          <div className="expanded-sub">Priority: {c.priority || '—'} | Stage: {c.stage || '—'}</div>
                                          {c.date_completed && <div className="expanded-sub" style={{ color: '#059669', marginTop: '4px' }}>Completed on: {c.date_completed}</div>}
                                          {c.modified_by_email && <div className="expanded-sub" style={{ marginTop: '4px' }}>Last modified by {c.modified_by_email.split('@')[0]} on {formatDateTime(c.last_modified)}</div>}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                          <span className="expanded-label">SLA DUE DATE</span>
                                          <div className="expanded-value">{c.sla_due_date || '—'}</div>
                                          <div className="expanded-sub">Created: {c.created_on || '—'}</div>
                                        </div>
                                      </div>
                                      
                                      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                        {c.case_status === 'IN PROGRESS' && <button onClick={() => handleCompleteCase(c.case_number)} className="btn-action btn-success">Complete Case</button>}
                                        {c.case_status === 'COMPLETED' && <button onClick={() => handleReactivateCase(c.case_number)} className="btn-action btn-warning">Reactivate Case</button>}
                                        {!showAddPersonForm && <button onClick={() => setShowAddPersonForm('complainant')} className="btn-action">+ Add Complainant</button>}
                                        {!showAddPersonForm && <button onClick={() => setShowAddPersonForm('respondent')} className="btn-action">+ Add Respondent</button>}
                                      </div>

                                      {showAddPersonForm && (
                                        <form onSubmit={handleAddPerson} className="person-form">
                                          <div className="wip-input-group"><label>{showAddPersonForm === 'complainant' ? 'Complainant Name' : 'Respondent Name'}</label><input type="text" value={newPersonName} onChange={(e) => setNewPersonName(e.target.value)} required /></div>
                                          <div className="wip-input-group"><label>Qnet ID#</label><input type="text" value={newPersonId} onChange={(e) => setNewPersonId(e.target.value)} /></div>
                                          <div className="wip-input-group"><label>Country</label><input type="text" value={newPersonCountry} onChange={(e) => setNewPersonCountry(e.target.value)} /></div>
                                          <div style={{ display: 'flex', gap: '4px', alignItems: 'end' }}>
                                            <button type="submit" className="btn-log" style={{ backgroundColor: '#10b981' }}>Add</button>
                                            <button type="button" onClick={() => { setShowAddPersonForm(null); setNewPersonName(''); setNewPersonId(''); setNewPersonCountry(''); }} className="btn-action">Cancel</button>
                                          </div>
                                        </form>
                                      )}

                                      <div className="section-divider">
                                        <div className="section-title">
                                          <span>⏳ WIP Tracker (Daily Actions)</span>
                                          {!showWipForm && <button onClick={() => { setEditingWipId(null); setShowWipForm(true); }} className="btn-action btn-purple" style={{ color: 'white' }}>+ Log Action</button>}
                                        </div>

                                        {showWipForm && (
                                          <form onSubmit={handleAddWIP} className="wip-form">
                                            <div className="wip-input-group"><label>Action Type</label><select value={wipActionType} onChange={(e) => setWipActionType(e.target.value)} required><option value="">Select...</option>{mappingRules.map(rule => <option key={rule.id} value={rule.action_type}>{rule.action_type}</option>)}</select></div>
                                            <div className="wip-input-group"><label>Description</label><input type="text" value={wipDesc} onChange={(e) => setWipDesc(e.target.value)} required /></div>
                                            <div className="wip-input-group"><label>Date Sent</label><input type="date" value={wipDateSent} onChange={(e) => setWipDateSent(e.target.value)} required /></div>
                                            <div className="wip-input-group"><label>SLA Days (1-100)</label><input type="number" min="1" max="100" value={wipSlaDays} onChange={(e) => setWipSlaDays(Math.max(1, Math.min(100, parseInt(e.target.value) || 2)))} required /></div>
                                            <div className="wip-input-group"><label>Notes / Replies</label><textarea value={wipNotes} onChange={(e) => setWipNotes(e.target.value)} rows="1" placeholder="e.g., Reply 1 (Date)..."></textarea></div>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                              <button type="submit" className="btn-log">{editingWipId ? 'Update' : 'Log'}</button>
                                              <button type="button" onClick={resetWipForm} className="btn-action">Cancel</button>
                                            </div>
                                          </form>
                                        )}

                                        {wipList.length === 0 ? (
                                          <div style={{ padding: '12px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#94a3b8', fontSize: '13px' }}>No WIP actions logged yet.</div>
                                        ) : (
                                          <div>
                                            {wipList.map((w, i) => {
                                              const wipSlaDays = calculateBusinessDays(w.expiry_date);
                                              return (
                                                <div key={w.id} className={`list-item ${w.status === 'Done' ? 'done' : ''}`}>
                                                  <div className="step-circle">{i + 1}</div>
                                                  <div className="item-content">
                                                    <div className="item-title">{w.action_type} {w.status === 'Done' && <span className="badge badge-green" style={{ marginLeft: '4px' }}>Done</span>}</div>
                                                    <div className="item-sub">{w.description}</div>
                                                    {w.notes && <div className="item-sub" style={{ marginTop: '4px', color: '#475569', fontStyle: 'italic' }}>Notes: {w.notes}</div>}
                                                    <div className="item-sub" style={{ marginTop: '4px' }}>By: {w.pic?.split('@')[0] || '—'} | Sent: {w.date_sent} | Modified: {formatDateTime(w.last_modified)}</div>
                                                  </div>
                                                  <div className="item-meta"><div className="expanded-label">Stage</div><span className="badge badge-blue">{w.stage_auto || '—'}</span></div>
                                                  <div className="item-meta"><div className="expanded-label">SLA Timer</div><span style={{ fontWeight: 600, color: wipSlaDays < 0 ? '#dc2626' : '#059669' }}>{wipSlaDays < 0 ? `🔴 ${Math.abs(wipSlaDays)}wd` : `🟢 ${wipSlaDays}wd`}</span></div>
                                                  {w.status !== 'Done' && (<div className="item-actions"><button onClick={() => handleEditWip(w)} className="btn-action">Edit</button><button onClick={() => handleCompleteWip(w.id)} className="btn-action btn-success">Complete</button></div>)}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>

                                      <div className="section-divider">
                                        <div className="section-title">⚖️ Disciplinary Actions (Respondents)</div>
                                        {daList.length === 0 ? (
                                          <div style={{ padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#94a3b8' }}>No respondents linked to this case. Use "+ Add Respondent" above.</div>
                                        ) : (
                                          <div>
                                            {daList.map((da, i) => {
                                              const colors = getActionColor(da.current_action);
                                              const isExpanded = expandedDAs[da.id];
                                              return (
                                                <div key={da.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                                                    <div><span className="expanded-label">Respondent: </span><span className="item-title">{da.respondent_name || '—'}</span><span className="item-sub" style={{ marginLeft: '8px' }}>({da.respondent_id || '—'})</span></div>
                                                    <div style={{ textAlign: 'right' }}><span className="expanded-label">Complainant: </span><span className="item-title">{da.complainant_name || '—'}</span></div>
                                                  </div>
                                                  
                                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px' }} onClick={() => toggleExpandDA(da.id)}>
                                                    <span className="expanded-label" style={{ margin: 0 }}>Action Timeline ({da.action_history?.length || 0})</span>
                                                    <span style={{ fontSize: '12px', color: '#64748b' }}>{isExpanded ? '▲ Hide' : '▼ Show'}</span>
                                                  </div>

                                                  {isExpanded && (
                                                    <div style={{ marginTop: '8px' }}>
                                                      {da.action_history && da.action_history.map((h, idx) => {
                                                        const hColors = getActionColor(h.action);
                                                        return (
                                                          <div key={idx} className="list-item">
                                                            <div className="step-circle">{h.step}</div>
                                                            <div className="item-content">
                                                              <span className="badge" style={{ backgroundColor: hColors.bg, color: hColors.text }}>{h.action || '—'}</span>
                                                              <div className="item-sub" style={{ marginTop: '4px' }}>Date: {h.date || 'No date'}</div>
                                                              {h.added_by && <div className="item-sub" style={{ fontSize: '10px' }}>Added by: {h.added_by?.split('@')[0]} on {formatDateTime(h.added_at)}</div>}
                                                            </div>
                                                          </div>
                                                        );
                                                      })}

                                                      {addingDaFor === da.id ? (
                                                        <form onSubmit={(e) => handleAddDaAction(e, da.id)} style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                          <input type="text" placeholder="Action Name" value={newDaAction} onChange={(e) => setNewDaAction(e.target.value)} required style={{ flex: 1, minWidth: '150px', padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px' }} />
                                                          <input type="date" value={newDaDate} onChange={(e) => setNewDaDate(e.target.value)} style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px' }} />
                                                          <button type="submit" className="btn-log" style={{ backgroundColor: '#10b981' }}>Add</button>
                                                          <button type="button" onClick={() => setAddingDaFor(null)} className="btn-action">Cancel</button>
                                                        </form>
                                                      ) : (
                                                        <button onClick={() => setAddingDaFor(da.id)} className="btn-action" style={{ marginTop: '8px' }}>+ Add Action</button>
                                                      )}
                                                    </div>
                                                  )}

                                                  <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                                                    <div className="expanded-label">Violations</div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                                      {(da.violations || []).map((v, vIdx) => (
                                                        <span key={vIdx} className="badge badge-red" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                          {v}
                                                          <button onClick={() => handleDeleteViolation(da.id, vIdx)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>×</button>
                                                        </span>
                                                      ))}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                                                      <input type="text" placeholder="Add violation..." value={newViolation[da.id] || ''} onChange={(e) => setNewViolation(prev => ({ ...prev, [da.id]: e.target.value }))} style={{ flex: 1, padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px' }} />
                                                      <button onClick={() => handleAddViolation(da.id)} className="btn-action">Add</button>
                                                    </div>
                                                  </div>
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

                    <div className="pagination">
                      <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="btn-page">← Previous</button>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>Page {currentPage} of {totalPages || 1}</span>
                      <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} className="btn-page">Next →</button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {activeTab === 'analytics' && (
            <>
              <div className="page-header">
                <div className="page-header-text">
                  <h2>Analytics & Insights</h2>
                  <p>Visual breakdown of case metrics and performance.</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <div className="card"><h3 className="card-header">Case Status Breakdown</h3><ChartRow label="In Progress" value={inProgress} total={totalCases} color="#3b82f6" /><ChartRow label="Completed" value={completed} total={totalCases} color="#10b981" /><ChartRow label="Cancelled" value={cases.filter(c => c.case_status === 'CANCELLED').length} total={totalCases} color="#ef4444" /></div>
                <div className="card"><h3 className="card-header">SLA Compliance (Active Cases)</h3><ChartRow label="Within SLA" value={inProgress - outOfSlaCases.length} total={inProgress} color="#10b981" /><ChartRow label="Out of SLA" value={outOfSlaCases.length} total={inProgress} color="#ef4444" /></div>
                <div className="card"><h3 className="card-header">Priority Distribution</h3><ChartRow label="High Priority" value={cases.filter(c => c.priority === 'High').length} total={totalCases} color="#ef4444" /><ChartRow label="Medium Priority" value={cases.filter(c => c.priority === 'Medium').length} total={totalCases} color="#f59e0b" /><ChartRow label="Low Priority" value={cases.filter(c => c.priority === 'Low').length} total={totalCases} color="#64748b" /></div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

function ChartRow({ label, value, total, color }) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="chart-row">
      <div className="chart-label"><span style={{ fontWeight: 500, color: '#334155' }}>{label}</span><span style={{ color: '#64748b' }}>{value} ({percent.toFixed(1)}%)</span></div>
      <div className="chart-track"><div className="chart-fill" style={{ width: `${percent}%`, backgroundColor: color }}></div></div>
    </div>
  );
}

export default App;