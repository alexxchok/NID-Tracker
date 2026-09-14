// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabaseUrl = 'https://yymvagbwxdaxrldrhmtm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bXZhZ2J3eGRheHJsZHJobXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTEyMjcsImV4cCI6MjEwMjI2NzIyN30.W6WFGXzR7gMU0ln-vfMIJlsxwctWqnCv5Cb7qW8UXXY';
const supabase = createClient(supabaseUrl, supabaseKey);
// ==== ADMIN ACCESS CONTROL ====
// Enter admin emails in lowercase. Only these users see edit buttons.
const ADMIN_EMAILS = [
  'alex.chok@qigroup.com',
  // 'second-admin@company.com',
];

const PUBLIC_HOLIDAYS = [];
const STANDARD_CASE_SLA_DAYS = 30;

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

// ==== ADMIN: count business days between a start date and a due date ====
const businessDaysFromStart = (startDate, dueDate) => {
  if (!startDate || !dueDate) return null;
  const start = new Date(startDate); const due = new Date(dueDate);
  if (isNaN(start.getTime()) || isNaN(due.getTime())) return null;
  start.setHours(0, 0, 0, 0); due.setHours(0, 0, 0, 0);
  let count = 0; let cur = new Date(start);
  while (cur < due) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay();
    if (day !== 0 && day !== 6 && !isHoliday(cur)) count++;
  }
  return count;
};
const calculatePriority = (slaDate) => {
  const days = calculateBusinessDays(slaDate);
  if (days <= 5) return 'High';
  if (days <= 10) return 'Medium';
  return 'Low';
};

const formatDateTime = (timestamp) => {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kuala_Lumpur'
  });
};

// ==== IMPORT NORMALIZATION ====
const normalizeCaseNumber = (val) => {
  if (val === undefined || val === null) return null;
  let s = String(val).trim();
  if (s === '') return null;
  s = s.toUpperCase().replace(/\s+/g, '');
  if (s.includes('/')) {
    const parts = s.split('/').filter(p => p !== '');
    const cxnPart = parts.find(p => p.startsWith('CXN'));
    if (cxnPart) return cxnPart;
    if (parts.length > 0) return parts[0];
  }
  return s;
};

const normalizeStatus = (val) => {
  if (val === undefined || val === null) return null;
  const raw = String(val).trim();
  if (raw === '') return null;
  const s = raw.toUpperCase().replace(/[^A-Z]/g, '');
  if (s.startsWith('CANCEL')) return 'CANCELLED';
  if (s.startsWith('COMPLET') || s === 'DONE' || s === 'CLOSED' || s === 'PROBLEMSOLVED') return 'COMPLETED';
  if (s === 'INPROGRESS' || s === 'OPEN' || s === 'ACTIVE' || s === 'PENDING' ||
      s === 'WAITINGDISTRIBUTORRESPONSE' || s === 'PENDINGINFO' || s === 'FOLLOWUP' || s === 'PENDINGAPPROVAL') return 'IN PROGRESS';
  return raw;
};

const normalizeCountry = (val) => {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (s === '') return null;
  if (s.toUpperCase().includes('INDIA')) return 'India';
  return s;
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
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [daList, setDaList] = useState([]);
  const [wipList, setWipList] = useState([]);
  const [showWipForm, setShowWipForm] = useState(false);
  const [mappingRules, setMappingRules] = useState([]);
  // PERF FIX: searchInput updates instantly (what the user types/sees),
  // searchTerm updates 250ms after they stop typing (what filtering/sorting actually uses).
  // This means filteredCases/sortedCases — which scan ~2500 cases — only recompute
  // once typing pauses, instead of on every single keystroke.
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const [sortConfig, setSortConfig] = useState({ key: 'sla_due_date', direction: 'ascending' });
  const [filters, setFilters] = useState({ pic: '', status: '', da_in_force: '' });

  const [showCaseForm, setShowCaseForm] = useState(false);
  const [newCaseNum, setNewCaseNum] = useState('');
  const [newPic, setNewPic] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newSlaDays, setNewSlaDays] = useState(30);

  const [wipActionType, setWipActionType] = useState('');
  const [wipDesc, setWipDesc] = useState('');
  const [wipDateSent, setWipDateSent] = useState(new Date().toISOString().split('T')[0]);
  const [wipSlaDays, setWipSlaDays] = useState(2);
  const [wipNotes, setWipNotes] = useState('');
  const [editingWipId, setEditingWipId] = useState(null);

  const [addingDaFor, setAddingDaFor] = useState(null);
  const [newDaAction, setNewDaAction] = useState('');
  const [newDaDate, setNewDaDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedDAs, setExpandedDAs] = useState({});
  const [newViolation, setNewViolation] = useState({});

  const [showAddPersonForm, setShowAddPersonForm] = useState(null);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonId, setNewPersonId] = useState('');
  const [newPersonCountry, setNewPersonCountry] = useState('');

  const [editingDaAction, setEditingDaAction] = useState(null);
  const [editDaActionName, setEditDaActionName] = useState('');
  const [editDaActionDate, setEditDaActionDate] = useState('');
  const [addingSubAction, setAddingSubAction] = useState(null);
  const [newSubActionDesc, setNewSubActionDesc] = useState('');
  const [newSubActionDate, setNewSubActionDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingSubActionEntry, setEditingSubActionEntry] = useState(null);
  const [editSubActionDesc, setEditSubActionDesc] = useState('');
  const [editSubActionDate, setEditSubActionDate] = useState('');

  const [hideRespondents, setHideRespondents] = useState(true);
  // ==== ADMIN: case edit state ====
const isAdmin = ADMIN_EMAILS.includes((userEmail || '').toLowerCase());
const [editingCase, setEditingCase] = useState(false);
const [caseForm, setCaseForm] = useState({
  case_number: '', pic: '', country: '', sla_due_date: '', created_on: '', sla_days: '', priority: 'Medium',
  stage: '', case_status: 'IN PROGRESS', remarks: '', date_completed: '',
  complainant_name: '', complainant_id: '', complainant_country: ''
});
// ==== ADMIN: respondent edit state ====
const [editingRespondentId, setEditingRespondentId] = useState(null);
const [respondentEdits, setRespondentEdits] = useState({});
// ==== Close-case chooser state ====
const [showCloseOptions, setShowCloseOptions] = useState(false);
const [showMyCases, setShowMyCases] = useState(false);

  const fetchCases = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase.from('cases').select('*, disciplinary_actions(*), wip_actions(status)').order('sla_due_date', { ascending: true });
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
    setUploadMessage('1/6 Reading Excel file...');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        setUploadMessage('2/6 Identifying sheets...');

        const norm = (s) => String(s).toLowerCase().replace(/\s+/g, '');
        const findSheetByHeaders = (phrases) => {
          for (let name of wb.SheetNames) {
            const ws = wb.Sheets[name];
            const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
            if (json.length > 0) {
              const headers = json[0].map(h => String(h || '').trim().toLowerCase());
              if (headers.some(h => phrases.some(p => norm(h).includes(norm(p))))) return name;
            }
          }
          return null;
        };

        let casesToUpsert = [];
        let daDataToInsert = [];
        let masterCaseCount = 0;
        let indiaCaseCount = 0;

        // A) MASTER: sheet named "sla_tracker"
        const slaSheetName = wb.SheetNames.find(name => name.trim().toLowerCase() === 'sla_tracker');
        if (slaSheetName) {
          const json = XLSX.utils.sheet_to_json(wb.Sheets[slaSheetName], { defval: null });
          const masterCases = json.map(row => {
            const getVal = (terms) => {
              const list = Array.isArray(terms) ? terms : [terms];
              for (const t of list) {
                for (let k in row) { if (norm(k).includes(norm(t))) return row[k]; }
              }
              return null;
            };
            const caseNum = normalizeCaseNumber(cleanVal(getVal(['CASE NUMBER', 'Case Number', 'CXN No'])));
            if (!caseNum) return null;
            return {
              case_number: caseNum, created_on: formatDateString(cleanVal(getVal(['CREATED ON']))),
              sla_due_date: formatDateString(cleanVal(getVal(['CASE DUE DATE', 'SLA DATE', 'Due Date']))),
              country: normalizeCountry(cleanVal(getVal(['COUNTRY']))), pic: cleanVal(getVal(['PIC'])),
              priority: cleanVal(getVal(['PRIORITY'])) || 'Medium',
              case_status: normalizeStatus(cleanVal(getVal(['CASE STATUS', 'Status']))) || 'IN PROGRESS',
              stage: cleanVal(getVal(['STAGE OF CASE'])),
              date_completed: formatDateString(cleanVal(getVal(['DATE COMPLETED']))),
              remarks: cleanVal(getVal(['REMARKS']))
            };
          }).filter(Boolean);
          masterCaseCount = masterCases.length;
          casesToUpsert = masterCases;
        }

        // B) INDIA FILE: correct column structure
        const indiaSheetName = findSheetByHeaders(['Complaint/Respondent', 'Stage Status']);
        if (indiaSheetName && indiaSheetName !== slaSheetName) {
          const json = XLSX.utils.sheet_to_json(wb.Sheets[indiaSheetName], { defval: null });
          const indiaCases = json.map(row => {
            const getVal = (terms) => {
              const list = Array.isArray(terms) ? terms : [terms];
              for (const t of list) {
                for (let k in row) { if (norm(k).includes(norm(t))) return row[k]; }
              }
              return null;
            };
            const caseNum = normalizeCaseNumber(cleanVal(getVal(['Case Number'])));
            if (!caseNum) return null;
            const role = String(cleanVal(getVal(['Complaint/Respondent'])) || '').trim();
            const isRespondent = role.toLowerCase().includes('respondent');
            const customerStr = String(cleanVal(getVal(['Customer'])) || '').trim();
            let personName = null;
            let personId = cleanVal(getVal(['IR ID']));
            if (customerStr) {
              const m = customerStr.match(/^IR:(\S+)\s+(.+)$/);
              if (m) { if (!personId) personId = m[1]; personName = m[2].trim(); }
              else { personName = customerStr; }
            }
            const status = normalizeStatus(cleanVal(getVal(['Case Status']))) || 'IN PROGRESS';
            const country = normalizeCountry(cleanVal(getVal(['Country']))) || 'India';
            const stage = cleanVal(getVal(['Stage Status']));
            const pic = cleanVal(getVal(['In-Charge']));
            const created = formatDateString(cleanVal(getVal(['Created On'])));
            const dueRaw = formatDateString(cleanVal(getVal(['Due Date'])));
            const priority = cleanVal(getVal(['Priority'])) || 'Medium';
            const noticeType = cleanVal(getVal(['Type of Notices Issued']));
            let slaDue = dueRaw;
            if (!slaDue) { const base = created ? new Date(created) : new Date(); base.setDate(base.getDate() + 30); slaDue = base.toISOString().split('T')[0]; }
            if (personName || personId) {
              const pr = {
                case_number: caseNum, current_action: noticeType,
                remarks: cleanVal(getVal(['Remarks'])),
                unique_key: isRespondent ? `${caseNum}|${personId || personName}` : `${caseNum}|complainant_${personId || personName}`
              };
              if (isRespondent) { pr.respondent_name = personName; pr.respondent_id = personId; pr.respondent_country = country; }
              else { pr.complainant_name = personName; pr.complainant_id = personId; pr.complainant_country = country; }
              daDataToInsert.push(pr);
            }
            return {
              case_number: caseNum, created_on: created, sla_due_date: slaDue, country: country, pic: pic,
              priority: priority, case_status: status, stage: stage,
              remarks: noticeType ? `[${noticeType}]` : cleanVal(getVal(['Remarks']))
            };
          }).filter(Boolean);
          indiaCaseCount = indiaCases.length;
          casesToUpsert = casesToUpsert.concat(indiaCases);
        }

        // C) RESPONDENT SHEET (shared folder or master DA sheet)
        const daSheetName = findSheetByHeaders(['Action Taken', 'Current Action', 'Respondent Name', "Respondent's Name"]);
        if (daSheetName && daSheetName !== slaSheetName && daSheetName !== indiaSheetName) {
          const json = XLSX.utils.sheet_to_json(wb.Sheets[daSheetName], { defval: null });
          daDataToInsert = daDataToInsert.concat(json.map(row => {
            const getVal = (terms) => {
              const list = Array.isArray(terms) ? terms : [terms];
              for (const t of list) {
                for (let k in row) { if (norm(k).includes(norm(t))) return row[k]; }
              }
              return null;
            };
            const caseNum = normalizeCaseNumber(cleanVal(getVal(['CXN No', 'CXN #', 'Case Number', 'Case No'])));
            const respId = cleanVal(getVal(["Respondent ID#", 'Respondent ID No', "Respondents' IR ID No", 'IR ID']));
            const respName = cleanVal(getVal(['Respondent Name', "Respondent's Name"]));
            let history = [];
            for (let i = 1; i <= 4; i++) {
              const action = cleanVal(getVal([`Action Taken ${i}`]));
              const date = formatDateString(cleanVal(getVal([`Date of execution ${i}`])));
              if (action) history.push({ step: i, action, date });
            }
            if (history.length === 0) {
              const currAction = cleanVal(getVal(['Current Action', 'Action Taken', 'Action']));
              const currDate = formatDateString(cleanVal(getVal(['Current Action (Execution Date)', 'Execution Date', 'Date of Execution'])));
              if (currAction) history.push({ step: 1, action: currAction, date: currDate });
              const prevAction = cleanVal(getVal(['Previous Action']));
              const prevDate = formatDateString(cleanVal(getVal(['(Previous Action (Execution Date)', 'Previous Action (Execution Date)'])));
              if (prevAction) history.push({ step: 2, action: prevAction, date: prevDate });
            }
            const latestAction = history.length > 0 ? history[history.length - 1].action : cleanVal(getVal(['Current Action', 'Action Taken', 'Action']));
            const latestDate = history.length > 0 ? history[history.length - 1].date : formatDateString(cleanVal(getVal(['Execution Date'])));
            const violationType = cleanVal(getVal(['Violation Type', 'Type of Violation', 'Violation']));
            const vCategory = cleanVal(getVal(['Violation Category']));
            const refId = cleanVal(getVal(["Respondent's Referrer ID", 'Referrer ID']));
            const refName = cleanVal(getVal(["Respondent's Referrer Name", 'Referrer Name']));
            const upId = cleanVal(getVal(['nearest VA Upline ID', 'VA Upline ID']));
            const upName = cleanVal(getVal(['nearest VA Upline Name', 'VA Upline Name']));
            const teamName = cleanVal(getVal(['Team Name']));
            const sentBy = cleanVal(getVal(['Sent by']));
            const nidNo = cleanVal(getVal(['NID case no', 'NID Case No']));
            const dateRecv = formatDateString(cleanVal(getVal(['Date of instruction received'])));
            const respCountry = normalizeCountry(cleanVal(getVal(['Country'])));
            const uniqueBase = respId || respName;
            const rawComp = cleanVal(getVal(["Complainant Name", "Complainant's Name and IR ID No"]));
            const explicitCompId = cleanVal(getVal(['Complainant ID#']));
            const compList = parseComplainants(rawComp);
            if (!caseNum || !uniqueBase) return null;
            return compList.map((c, ci) => ({
              case_number: caseNum,
              complainant_name: c.name,
              complainant_id: explicitCompId || c.id,
              complainant_cust_id: c.cust,
              respondent_name: respName, respondent_id: respId,
              current_action: latestAction, execution_date: latestDate,
              action_history: history.length > 0 ? history : null,
              violations: violationType ? [violationType] : undefined,
              remarks: cleanVal(getVal(['Remarks'])),
              violation_category: vCategory,
              referrer_id: refId,
              referrer_name: refName,
              upline_id: upId,
              upline_name: upName,
              team_name: teamName,
              sent_by: sentBy,
              nid_case_no: nidNo,
              date_received: dateRecv,
              respondent_country: respCountry,
              unique_key: `${caseNum}|${uniqueBase}|${c.id || c.name || ci}`
            }));
          }).flat().filter(item => item && item.case_number && item.unique_key));
        }

        if (casesToUpsert.length === 0 && daDataToInsert.length === 0) { setUploadMessage('❌ Error: No recognized sheets found.'); setUploading(false); return; }

        setUploadMessage('3/6 Syncing cases...');
        if (casesToUpsert.length > 0) for (let chunk of chunkArray(casesToUpsert, 100)) await supabase.from('cases').upsert(chunk, { onConflict: 'case_number' });

        setUploadMessage('4/6 Ensuring parent cases exist...');
        const { data: existingCases } = await supabase.from('cases').select('case_number');
        const existingSet = new Set(existingCases.map(c => c.case_number));
        const missingCases = [...new Set(daDataToInsert.map(item => item.case_number))].filter(cn => !existingSet.has(cn) && !casesToUpsert.some(c => c.case_number === cn)).map(cn => {
          const today = new Date(); const slaDate = new Date(today.setDate(today.getDate() + 30)).toISOString().split('T')[0];
          return { case_number: cn, case_status: 'IN PROGRESS', sla_due_date: slaDate, created_on: new Date().toISOString().split('T')[0], priority: 'Medium', stage: 'Stage 1' };
        });
        if (missingCases.length > 0) for (let chunk of chunkArray(missingCases, 100)) await supabase.from('cases').upsert(chunk, { onConflict: 'case_number', ignoreDuplicates: true });

        setUploadMessage('5/6 Merging respondents...');
        const daRowsToUpsert = [];
        const daRowsToUpdate = [];
        const involved = [...new Set(daDataToInsert.filter(i => !i.respondent_id && i.respondent_name).map(i => i.case_number))];
        const nameToRow = new Map();
        for (let chunk of chunkArray(involved, 50)) {
          const { data: existingDa } = await supabase.from('disciplinary_actions').select('id, case_number, respondent_name, violations').in('case_number', chunk);
          (existingDa || []).forEach(r => {
            const nn = (r.respondent_name || '').toUpperCase().replace(/\s+/g, ' ').trim();
            if (nn) nameToRow.set(`${r.case_number}|${nn}`, r);
          });
        }
        daDataToInsert.forEach(item => {
          if (!item.respondent_id && item.respondent_name) {
            const nn = item.respondent_name.toUpperCase().replace(/\s+/g, ' ').trim();
            const match = nameToRow.get(`${item.case_number}|${nn}`);
            if (match) {
              const patch = { modified_by_email: userEmail, last_modified: new Date().toISOString() };
              if (item.violations && item.violations.length) patch.violations = [...new Set([...(match.violations || []), ...item.violations])];
              if (item.current_action) patch.current_action = item.current_action;
              if (item.remarks) patch.remarks = item.remarks;
              daRowsToUpdate.push({ id: match.id, patch });
              return;
            }
          }
          daRowsToUpsert.push(item);
        });
        for (const u of daRowsToUpdate) { await supabase.from('disciplinary_actions').update(u.patch).eq('id', u.id); }

        setUploadMessage('6/6 Uploading respondents...');
        const uniqueMap = new Map();
        daRowsToUpsert.forEach(item => uniqueMap.set(item.unique_key, item));
        const finalDataToInsert = Array.from(uniqueMap.values());
        let errorCount = 0; let firstError = null;
        for (let chunk of chunkArray(finalDataToInsert, 100)) {
          const { error } = await supabase.from('disciplinary_actions').upsert(chunk, { onConflict: 'unique_key' });
          if (error) { errorCount++; if (!firstError) firstError = error.message; }
        }
        let finalMsg = `✅ Sync Complete! `;
        if (masterCaseCount > 0) finalMsg += `Master: ${masterCaseCount} cases. `;
        if (indiaCaseCount > 0) finalMsg += `India: ${indiaCaseCount} CVN cases. `;
        if (daRowsToUpdate.length > 0) finalMsg += `Merged ${daRowsToUpdate.length} respondents. `;
        if (finalDataToInsert.length > 0) finalMsg += `Processed ${finalDataToInsert.length} respondents. `;
        if (missingCases.length > 0) finalMsg += `Auto-created ${missingCases.length} missing cases. `;
        if (errorCount > 0) finalMsg = `⚠️ Completed with ${errorCount} errors. First: ${firstError}`;
        setUploadMessage(finalMsg);
        fetchCases(true); setUploading(false);
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
    setHideRespondents(true);
    setEditingCase(false);
setShowCloseOptions(false);
setEditingRespondentId(null);
    const { data: daData } = await supabase.from('disciplinary_actions').select('*').eq('case_number', caseNum);
    const { data: wipData } = await supabase.from('wip_actions').select('*').eq('case_number', caseNum).order('date_sent', { ascending: false });
    setDaList(daData || []); setWipList(wipData || []);
  };

  const handleAddCase = async (e) => {
    e.preventDefault();
    const today = new Date().toISOString().split('T')[0];
    const slaDate = addBusinessDays(today, newSlaDays);
    const priority = calculatePriority(slaDate);
    const { error } = await supabase.from('cases').insert([{
      case_number: newCaseNum, pic: newPic, country: newCountry, case_status: 'IN PROGRESS',
      sla_due_date: slaDate, priority: priority, stage: 'Stage 1', created_on: today
    }]);
    if (error) alert('Error saving case: ' + error.message);
    else { setShowCaseForm(false); setNewCaseNum(''); setNewPic(''); setNewCountry(''); setNewSlaDays(30); fetchCases(true); }
  };

  const handleCompleteCase = async (caseNum, closeStatus = 'COMPLETED') => {
    const { error } = await supabase.from('cases').update({
      case_status: closeStatus, priority: 'Low', date_completed: new Date().toISOString().split('T')[0], modified_by_email: userEmail, last_modified: new Date().toISOString()
    }).eq('case_number', caseNum);
    if (error) alert('Error closing case: ' + error.message);
    else { setShowCloseOptions(false); fetchCases(true); }
  };

  const handleReactivateCase = async (caseNum) => {
    const today = new Date().toISOString().split('T')[0];
    const newSlaDate = addBusinessDays(today, STANDARD_CASE_SLA_DAYS);
    const { error } = await supabase.from('cases').update({
      case_status: 'IN PROGRESS', date_completed: null, sla_due_date: newSlaDate, priority: calculatePriority(newSlaDate), modified_by_email: userEmail, reactivated_at: new Date().toISOString(), last_modified: new Date().toISOString()
    }).eq('case_number', caseNum);
    if (error) alert('Error reactivating case: ' + error.message);
    else fetchCases(true);
  };

  // ==== ADMIN: open the edit form pre-filled with current case values ====
const openCaseEdit = () => {
  const c = cases.find(x => x.case_number === selectedCase);
  if (!c) return;
  const daWithComplainant = daList.find(d => d.complainant_name || d.complainant_id);
  setCaseForm({
    case_number: c.case_number || '',
    pic: c.pic || '', country: c.country || '', sla_due_date: c.sla_due_date || '',
    created_on: c.created_on || '',
    sla_days: businessDaysFromStart(c.created_on, c.sla_due_date) ?? '',
    priority: c.priority || 'Medium', stage: c.stage || '',
    case_status: c.case_status || 'IN PROGRESS', remarks: c.remarks || '', date_completed: c.date_completed || '',
    complainant_name: daWithComplainant?.complainant_name || '',
    complainant_id: daWithComplainant?.complainant_id || '',
    complainant_country: daWithComplainant?.complainant_country || ''
  });
  setEditingCase(true);
};

// ==== ADMIN: save the edited case (handles rename + complainant sync) ====
const handleUpdateCase = async (e) => {
  e.preventDefault();
  const c = cases.find(x => x.case_number === selectedCase);
  if (!c) return;

  // 1) Case-number rename — moves respondents & WIP actions along with it
  const newCaseNum = cleanVal(caseForm.case_number);
  let caseNumToUse = selectedCase;
  if (newCaseNum && newCaseNum !== selectedCase) {
    const { data: clash } = await supabase.from('cases').select('case_number').eq('case_number', newCaseNum);
    if (clash && clash.length > 0) { alert('Cannot rename: case number "' + newCaseNum + '" already exists.'); return; }
    // Move respondent rows (and their unique_keys) first
    const { data: daRows } = await supabase.from('disciplinary_actions').select('id, unique_key').eq('case_number', selectedCase);
    let renameError = null;
    for (const row of (daRows || [])) {
      const patch = { case_number: newCaseNum };
      if (row.unique_key && row.unique_key.startsWith(selectedCase + '|')) {
        patch.unique_key = newCaseNum + row.unique_key.slice(selectedCase.length);
      }
      const { error } = await supabase.from('disciplinary_actions').update(patch).eq('id', row.id);
      if (error) renameError = error.message;
    }
    const { error: wipError } = await supabase.from('wip_actions').update({ case_number: newCaseNum }).eq('case_number', selectedCase);
    if (renameError || wipError) { alert('Rename failed: ' + (renameError || wipError)); return; }
    await supabase.from('cases').update({ case_number: newCaseNum }).eq('case_number', selectedCase);
    caseNumToUse = newCaseNum;
    setSelectedCase(newCaseNum);
  }

  // 2) Complainant details — saved on every respondent row of this case
  const compName = cleanVal(caseForm.complainant_name);
  const compId = cleanVal(caseForm.complainant_id);
  const compCountry = cleanVal(caseForm.complainant_country);
  if (daList.length > 0) {
    await supabase.from('disciplinary_actions').update({
      complainant_name: compName, complainant_id: compId, complainant_country: compCountry,
      modified_by_email: userEmail, last_modified: new Date().toISOString()
    }).eq('case_number', caseNumToUse);
  } else if (compName || compId) {
    // No respondent rows yet — create one so the complainant can be stored
    await supabase.from('disciplinary_actions').insert([{
      case_number: caseNumToUse, unique_key: `${caseNumToUse}|complainant_${Date.now()}`,
      complainant_name: compName, complainant_id: compId, complainant_country: compCountry,
      modified_by_email: userEmail, last_modified: new Date().toISOString()
    }]);
  }

  // 3) Case fields
  const updates = {
    pic: cleanVal(caseForm.pic),
    country: cleanVal(caseForm.country),
    sla_due_date: cleanVal(caseForm.sla_due_date) || c.sla_due_date,
    created_on: cleanVal(caseForm.created_on) || c.created_on,
    priority: caseForm.priority,
    stage: cleanVal(caseForm.stage),
    case_status: caseForm.case_status,
    remarks: cleanVal(caseForm.remarks),
    modified_by_email: userEmail,
    last_modified: new Date().toISOString()
  };
  const isClosed = (s) => s === 'COMPLETED' || s === 'CANCELLED';
  if (isClosed(caseForm.case_status) && !isClosed(c.case_status)) {
    updates.date_completed = cleanVal(caseForm.date_completed) || new Date().toISOString().split('T')[0];
    // Auto-set priority to Low when closing — unless the admin changed it in this same edit
    if (caseForm.priority === c.priority) updates.priority = 'Low';
  } else if (isClosed(caseForm.case_status) && isClosed(c.case_status)) {
    // Already closed — admin may be changing the closure date
    if (caseForm.date_completed !== (c.date_completed || '')) {
      updates.date_completed = cleanVal(caseForm.date_completed) || c.date_completed;
    }
  } else if (!isClosed(caseForm.case_status) && isClosed(c.case_status)) {
    updates.date_completed = null;
  }
  const { error } = await supabase.from('cases').update(updates).eq('case_number', caseNumToUse);
  if (error) { alert('Error updating case: ' + error.message); return; }

  setEditingCase(false);
  fetchCases(true);
  const { data: refreshedDa } = await supabase.from('disciplinary_actions').select('*').eq('case_number', caseNumToUse);
  setDaList(refreshedDa || []);
};

// ==== ADMIN: open the respondent editor ====
// ==== ADMIN: delete a respondent row ====
const handleDeleteRespondent = async (daId) => {
  const da = daList.find(d => d.id === daId);
  if (!da) return;
  const isLastRow = daList.length <= 1;
  let msg = `Delete this respondent row?\n\n${da.respondent_name || '(unnamed)'}${da.respondent_id ? ' · ' + da.respondent_id : ''}`;
  if (isLastRow) {
    msg += `\n\n⚠️ This is the LAST respondent row for this case.`;
    if (da.complainant_name || da.complainant_id) {
      msg += `\nThe complainant details (${da.complainant_name || da.complainant_id}) are stored on this row and will be deleted too. Re-add them via ✏️ Edit Case if still needed.`;
    }
  }
  if (!window.confirm(msg)) return;
  const { error } = await supabase.from('disciplinary_actions').delete().eq('id', daId);
  if (error) alert('Error deleting respondent: ' + error.message);
  else { setEditingRespondentId(null); refreshDaList(); }
};
const startRespondentEdit = (da) => {
  setEditingRespondentId(da.id);
  setRespondentEdits(prev => ({
    ...prev,
    [da.id]: { name: da.respondent_name || '', id: da.respondent_id || '', country: da.respondent_country || '' }
  }));
};

// ==== ADMIN: save respondent details ====
const handleUpdateRespondent = async (e, daId) => {
  e.preventDefault();
  const edits = respondentEdits[daId];
  if (!edits) return;
  const oldDa = daList.find(d => d.id === daId);
  const newId = cleanVal(edits.id);
  const updates = {
    respondent_name: cleanVal(edits.name),
    respondent_id: newId,
    respondent_country: cleanVal(edits.country),
    modified_by_email: userEmail,
    last_modified: new Date().toISOString()
  };
  // Keep unique_key in sync when the ID changes (so future Excel uploads match)
  if (newId && newId !== oldDa?.respondent_id) {
    updates.unique_key = `${selectedCase}|${newId}`;
  }
  const { error } = await supabase.from('disciplinary_actions').update(updates).eq('id', daId);
  if (error) alert('Error updating respondent: ' + error.message);
  else { setEditingRespondentId(null); refreshDaList(); }
};
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
        date_sent: wipDateSent, sla_days: slaDays, expiry_date: expiryDate, status: 'Pending', notes: wipNotes, pic: userEmail, last_modified: new Date().toISOString()
      }]);
      if (error) alert('Error logging WIP: ' + error.message);
    }

    await supabase.from('cases').update({ modified_by_email: userEmail, last_modified: new Date().toISOString() }).eq('case_number', selectedCase);
    if (stageToAssign) await supabase.from('cases').update({ stage: stageToAssign }).eq('case_number', selectedCase);

    const { data: newWipData } = await supabase.from('wip_actions').select('*').eq('case_number', selectedCase).order('date_sent', { ascending: false });
    setWipList(newWipData || []);
    resetWipForm();
    fetchCases(true);
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
      await supabase.from('cases').update({ modified_by_email: userEmail, last_modified: new Date().toISOString() }).eq('case_number', selectedCase);
      fetchCases(true);
    }
  };

  const refreshDaList = async () => {
    const { data: newDaData } = await supabase.from('disciplinary_actions').select('*').eq('case_number', selectedCase);
    setDaList(newDaData || []);
    await supabase.from('cases').update({ modified_by_email: userEmail, last_modified: new Date().toISOString() }).eq('case_number', selectedCase);
    fetchCases(true);
  };

  const handleAddDaAction = async (e, daId) => {
    e.preventDefault();
    const da = daList.find(d => d.id === daId);
    if (!da) return;
    const extraIds = Object.keys(bulkActionTargets).filter(k => bulkActionTargets[k]);
    const targets = bulkActionMode ? [daId, ...extraIds] : [daId];
    if (bulkActionMode && extraIds.length > 0) {
      if (!window.confirm(`Add "${newDaAction}" to ${targets.length} respondents?`)) return;
    }

    const stamp = new Date().toISOString();
    for (const tid of targets) {
      const t = daList.find(d => d.id === tid);
      if (!t) continue;
      const th = [...(t.action_history || [])];
      const entry = { step: th.length + 1, action: newDaAction, date: null, added_by: userEmail, added_at: stamp, sub_actions: [] };
      if (bulkJournalText.trim()) {
        entry.sub_actions.push({ desc: bulkJournalText.trim(), date: new Date().toISOString().split('T')[0], status: 'Pending', added_by: userEmail, added_at: stamp });
      }
      th.push(entry);
      const { error: tErr } = await supabase.from('disciplinary_actions').update({
        action_history: th,
        previous_action: t.current_action || null,
        current_action: newDaAction,
        execution_date: null,
        da_confirmed: null, da_confirmed_by: null, da_confirmed_at: null,
        modified_by_email: userEmail, last_modified: stamp
      }).eq('id', tid);
      if (tErr) { alert('Error adding action: ' + tErr.message); return; }
    }

    setAddingDaFor(null); setNewDaAction(''); setNewDaDate(new Date().toISOString().split('T')[0]);
    setBulkActionMode(false); setBulkActionTargets({}); setBulkJournalText('');
    await refreshDaList();
    return;
    const history = da.action_history || [];
    history.push({ step: history.length + 1, action: newDaAction, date: null, added_by: userEmail, added_at: new Date().toISOString(), sub_actions: [] });
    const { error } = await supabase.from('disciplinary_actions').update({
      action_history: history,
      previous_action: da.current_action || null,
           current_action: newDaAction,
           execution_date: null,
      da_confirmed: null,
      da_confirmed_by: null,
      da_confirmed_at: null,
      modified_by_email: userEmail,
      last_modified: new Date().toISOString()
    }).eq('id', daId);
    if (error) alert('Error adding action: ' + error.message);
    else {
      setAddingDaFor(null); setNewDaAction(''); setNewDaDate(new Date().toISOString().split('T')[0]);
      refreshDaList();
    }
  };

  const handleEditDaAction = async (e, daId, stepIndex) => {
    e.preventDefault();
    const da = daList.find(d => d.id === daId);
    const history = [...da.action_history];
    history[stepIndex].action = editDaActionName;
    history[stepIndex].date = editDaActionDate;
    history[stepIndex].modified_by = userEmail;
    history[stepIndex].modified_at = new Date().toISOString();

    if (stepIndex === history.length - 1) {
      await supabase.from('disciplinary_actions').update({ current_action: editDaActionName, execution_date: editDaActionDate }).eq('id', daId);
    }

    const { error } = await supabase.from('disciplinary_actions').update({ action_history: history, modified_by_email: userEmail, last_modified: new Date().toISOString() }).eq('id', daId);
    if (error) alert('Error editing action: ' + error.message);
    else {
      setEditingDaAction(null);
      refreshDaList();
    }
  };

  const handleEditSubAction = async (e, daId, stepIndex, saIndex) => {
    e.preventDefault();
    const da = daList.find(d => d.id === daId);
    if (!da) return;
    const history = [...da.action_history];
    if (!history[stepIndex] || !history[stepIndex].sub_actions || !history[stepIndex].sub_actions[saIndex]) return;
    history[stepIndex].sub_actions[saIndex].desc = editSubActionDesc;
    history[stepIndex].sub_actions[saIndex].date = editSubActionDate;
    history[stepIndex].sub_actions[saIndex].modified_by = userEmail;
    history[stepIndex].sub_actions[saIndex].modified_at = new Date().toISOString();
    const { error } = await supabase.from('disciplinary_actions').update({
      action_history: history, modified_by_email: userEmail, last_modified: new Date().toISOString()
    }).eq('id', daId);
    if (error) alert('Error editing journal entry: ' + error.message);
    else { setEditingSubActionEntry(null); refreshDaList(); }
  };
  const handleCompleteSubAction = async (daId, stepIndex, saIndex) => {
    const da = daList.find(d => d.id === daId);
    if (!da) return;
    const history = [...da.action_history];
    if (!history[stepIndex] || !history[stepIndex].sub_actions || !history[stepIndex].sub_actions[saIndex]) return;
    history[stepIndex].sub_actions[saIndex].status = 'Done';
    history[stepIndex].sub_actions[saIndex].completed_by = userEmail;
    history[stepIndex].sub_actions[saIndex].completed_at = new Date().toISOString();
    const { error } = await supabase.from('disciplinary_actions').update({
      action_history: history, modified_by_email: userEmail, last_modified: new Date().toISOString()
    }).eq('id', daId);
    if (error) alert('Error completing journal entry: ' + error.message);
    else refreshDaList();
  };
  const handleAddSubAction = async (e, daId, stepIndex) => {
    e.preventDefault();
    const da = daList.find(d => d.id === daId);
    const history = [...da.action_history];
    history[stepIndex].sub_actions = history[stepIndex].sub_actions || [];
    history[stepIndex].sub_actions.push({ desc: newSubActionDesc, date: newSubActionDate, added_by: userEmail, added_at: new Date().toISOString(), status: 'Pending' });

    const { error } = await supabase.from('disciplinary_actions').update({ action_history: history, modified_by_email: userEmail, last_modified: new Date().toISOString() }).eq('id', daId);
    if (error) alert('Error adding journal entry: ' + error.message);
    else {
      setAddingSubAction(null); setNewSubActionDesc(''); setNewSubActionDate(new Date().toISOString().split('T')[0]);
      refreshDaList();
    }
  };

  const handleAddViolation = async (daId) => {
    const violationText = newViolation[daId];
    if (!violationText) return;
    const da = daList.find(d => d.id === daId);
    const violations = da.violations || [];
    violations.push(violationText);
    const { error } = await supabase.from('disciplinary_actions').update({ violations: violations, modified_by_email: userEmail, last_modified: new Date().toISOString() }).eq('id', daId);
    if (error) alert('Error adding violation: ' + error.message);
    else { refreshDaList(); setNewViolation(prev => ({ ...prev, [daId]: '' })); }
  };
  const [bulkMode, setBulkMode] = React.useState(false);
  const [bulkText, setBulkText] = React.useState('');
  const [bulkPreview, setBulkPreview] = React.useState(null);

  const [bulkActionMode, setBulkActionMode] = React.useState(false);
  const [bulkActionTargets, setBulkActionTargets] = React.useState({});
  const [bulkJournalText, setBulkJournalText] = React.useState('');
  const parseBulkPeople = (raw) => {
    const lines = (raw || '').split(/\n+/).map(s => s.replace(/\u2060|\u200b/g, '').trim()).filter(Boolean);
    return lines.map((line, i) => {
      let work = line.replace(/^\s*\d+\s*[\.\)\-]\s*/, '').trim();
      let id = '', cust = '';
      work = work.replace(/[\(\[]([^\)\]]+)[\)\]]/g, (m, inner) => {
        inner.split('/').map(s => s.trim()).filter(Boolean).forEach(p => {
          if (/^CU/i.test(p)) cust = cust ? `${cust}; ${p}` : p;
          else if (!id && /^[A-Za-z]{2}\d{4,}$/.test(p)) id = p;
          else cust = cust ? `${cust}; ${p}` : p;
        });
        return ' ';
      });
      work = work.replace(/\b([A-Za-z]{2}\d{4,})\b/g, (m, found) => {
        if (/^CU/i.test(found)) { cust = cust ? `${cust}; ${found}` : found; return ' '; }
        if (!id) { id = found; return ' '; }
        return ' ';
      });
      const name = work.replace(/[\(\)\[\]]/g, ' ').replace(/\s+/g, ' ').replace(/^[\.,;\-\s]+|[\.,;\-\s]+$/g, '').trim();
      return { row: i + 1, name, id, cust, include: true };
    });
  };
  const handleDeleteDaStep = async (daId, stepIndex) => {
    const da = daList.find(d => d.id === daId);
    if (!da) return;
    const history = [...(da.action_history || [])];
    const removed = history[stepIndex];
    if (!removed) return;

    const remaining = history.filter((_, i) => i !== stepIndex).map((h, i) => ({ ...h, step: i + 1 }));
    const last = remaining[remaining.length - 1] || null;
    const prev = remaining[remaining.length - 2] || null;

    const msg = `Delete this action from the timeline?\n\n"${removed.action || '—'}" (${removed.date || 'no date'}) will be removed.\n\n`
      + (last ? `Current action reverts to "${last.action}".` : 'This respondent will have no action recorded.')
      + `\n\nThis cannot be undone.`;
    if (!window.confirm(msg)) return;

    const { error } = await supabase.from('disciplinary_actions').update({
      action_history: remaining,
      current_action: last ? last.action : null,
      execution_date: last ? last.date : null,
      previous_action: prev ? prev.action : null,
      da_confirmed: last && last.confirmed_by ? true : null,
      da_confirmed_by: last && last.confirmed_by ? last.confirmed_by : null,
      da_confirmed_at: last && last.confirmed_at ? last.confirmed_at : null,
      modified_by_email: userEmail,
      last_modified: new Date().toISOString()
    }).eq('id', daId);
    if (error) alert('Error deleting action: ' + error.message);
    else refreshDaList();
  };
  const handleConfirmDA = async (daId, stepAction) => {
    const act = (stepAction || '').toLowerCase();
    const isResolving = act.includes('release') || act.includes('terminat');
    const msg = isResolving
      ? 'Confirm this action has been approved and is now in effect?\n\nThis will remove the respondent from the DA In Force count.'
      : 'Confirm this Disciplinary Action is in force?';
    if (!window.confirm(msg)) return;

    const da = daList.find(d => d.id === daId);
    const today = new Date().toISOString().split('T')[0];
    const history = (da?.action_history || []).map((h, i, arr) =>
      i === arr.length - 1
        ? { ...h, date: h.date || today, confirmed_by: userEmail, confirmed_at: new Date().toISOString() }
        : h
    );
    const lastStep = history[history.length - 1] || null;

    const { error } = await supabase.from('disciplinary_actions').update({
      da_confirmed: true, da_confirmed_by: userEmail, da_confirmed_at: new Date().toISOString(),
      action_history: history,
      execution_date: lastStep ? lastStep.date : null,
      modified_by_email: userEmail, last_modified: new Date().toISOString()
    }).eq('id', daId);
    if (error) alert('Error confirming DA: ' + error.message);
    else refreshDaList();
  };
  const handleClearDA = async (daId) => {
    if (!window.confirm('Remove this respondent from the DA In Force count?\n\nThe action stays in the timeline but is no longer counted as a Disciplinary Action taken.\n\nThe "Date DA in force" will be cleared, with a record of what it was.')) return;
    const da = daList.find(d => d.id === daId);
    const history = (da?.action_history || []).map((h, i, arr) =>
      i === arr.length - 1
        ? { ...h, date: null, was_in_force_from: h.date || null, cleared_by: userEmail, cleared_at: new Date().toISOString() }
        : h
    );
    const { error } = await supabase.from('disciplinary_actions').update({
      da_confirmed: false,
      action_history: history,
      execution_date: null,
      modified_by_email: userEmail,
      last_modified: new Date().toISOString()
    }).eq('id', daId);
    if (error) alert('Error clearing DA: ' + error.message);
    else refreshDaList();
  };
  const handleDeleteViolation = async (daId, index) => {
    const da = daList.find(d => d.id === daId);
    const violations = da.violations || [];
    violations.splice(index, 1);
    const { error } = await supabase.from('disciplinary_actions').update({ violations: violations, modified_by_email: userEmail, last_modified: new Date().toISOString() }).eq('id', daId);
    if (error) alert('Error deleting violation: ' + error.message);
    else refreshDaList();
  };

  const toggleExpandDA = (daId) => setExpandedDAs(prev => ({ ...prev, [daId]: !prev[daId] }));

  const [caseComplainants, setCaseComplainants] = React.useState([]);

  const loadCaseComplainants = React.useCallback(async (caseNum) => {
    if (!caseNum) { setCaseComplainants([]); return; }
    const { data } = await supabase
      .from('case_complainants')
      .select('*')
      .eq('case_number', caseNum)
      .order('is_anchor', { ascending: false })
      .order('last_modified', { ascending: true });
    setCaseComplainants(data || []);
  }, []);

  React.useEffect(() => { loadCaseComplainants(selectedCase); }, [selectedCase]);

  const handleRelinkComplainant = async (daId, complainantRowId) => {
    const c = caseComplainants.find(x => x.id === complainantRowId);
    if (!c) return;
    const { error } = await supabase.from('disciplinary_actions').update({
      complainant_name: c.complainant_name,
      complainant_id: c.complainant_id,
      complainant_cust_id: c.complainant_cust_id,
      complainant_country: c.complainant_country,
      modified_by_email: userEmail,
      last_modified: new Date().toISOString()
    }).eq('id', daId);
    if (error) alert('Error changing complainant: ' + error.message);
    else await refreshDaList();
  };

  const handleAddPerson = async (e) => {
    e.preventDefault();

    if (bulkMode && bulkPreview) {
      const chosen = bulkPreview.filter(p => p.include && p.name);
      if (chosen.length === 0) { alert('Nothing selected to add.'); return; }

      const anchor = (caseComplainants || []).find(c => c.is_anchor) || (caseComplainants || [])[0] || null;
      if (showAddPersonForm === 'respondent' && !anchor) {
        alert('This case has no complainant yet.\n\nAdd a complainant first, then add respondents.');
        return;
      }
      if (!window.confirm(`Add ${chosen.length} ${showAddPersonForm}${chosen.length > 1 ? 's' : ''} to ${selectedCase}?`)) return;

      const rows = chosen.map((p, i) => {
        const row = {
          case_number: selectedCase,
          unique_key: `${selectedCase}|${showAddPersonForm}_${Date.now()}_${i}`,
          modified_by_email: userEmail,
          last_modified: new Date().toISOString()
        };
        if (showAddPersonForm === 'complainant') {
          row.complainant_name = p.name; row.complainant_id = p.id || null;
          row.complainant_cust_id = p.cust || null; row.complainant_country = newPersonCountry || null;
        } else {
          row.respondent_name = p.name; row.respondent_id = p.id || null;
          row.respondent_cust_id = p.cust || null; row.respondent_country = newPersonCountry || null;
          row.complainant_name = anchor.complainant_name;
          row.complainant_id = anchor.complainant_id;
          row.complainant_cust_id = anchor.complainant_cust_id;
          row.complainant_country = anchor.complainant_country;
        }
        return row;
      });

      for (let i = 0; i < rows.length; i += 10) {
        const { error: bErr } = await supabase.from('disciplinary_actions').insert(rows.slice(i, i + 10));
        if (bErr) { alert('Error adding batch: ' + bErr.message); return; }
      }

      if (showAddPersonForm === 'complainant') {
        const { data: existing } = await supabase.from('case_complainants').select('id').eq('case_number', selectedCase).limit(1);
        const hasAny = existing && existing.length > 0;
        const cRows = chosen.map((p, i) => ({
          case_number: selectedCase, complainant_name: p.name, complainant_id: p.id || null,
          complainant_cust_id: p.cust || null, complainant_country: newPersonCountry || null,
          is_anchor: !hasAny && i === 0, modified_by_email: userEmail
        }));
        for (let i = 0; i < cRows.length; i += 10) {
          await supabase.from('case_complainants').insert(cRows.slice(i, i + 10));
        }
        await loadCaseComplainants(selectedCase);
      }

      alert(`Added ${chosen.length} ${showAddPersonForm}${chosen.length > 1 ? 's' : ''}.`);
      setShowAddPersonForm(null); setBulkMode(false); setBulkText(''); setBulkPreview('');
      setNewPersonName(''); setNewPersonId(''); setNewPersonCountry('');
      await refreshDaList();
      return;
    }

    const timestamp = Date.now();
    const uniqueKey = `${selectedCase}|${showAddPersonForm}_${timestamp}`;
    const insertData = { case_number: selectedCase, unique_key: uniqueKey, modified_by_email: userEmail, last_modified: new Date().toISOString() };
    if (showAddPersonForm === 'complainant') {
      insertData.complainant_name = newPersonName; insertData.complainant_id = newPersonId; insertData.complainant_country = newPersonCountry;
    } else {
      insertData.respondent_name = newPersonName; insertData.respondent_id = newPersonId; insertData.respondent_country = newPersonCountry;
    }
    let error = null;
    if (showAddPersonForm === 'respondent') {
      const { data: openRows } = await supabase
        .from('disciplinary_actions')
        .select('id, complainant_name, respondent_name')
        .eq('case_number', selectedCase)
        .is('respondent_name', null)
        .not('complainant_name', 'is', null)
        .order('last_modified', { ascending: true })
        .limit(1);
      if (openRows && openRows.length > 0) {
        const res = await supabase.from('disciplinary_actions').update({
          respondent_name: newPersonName,
          respondent_id: newPersonId,
          respondent_country: newPersonCountry,
          modified_by_email: userEmail,
          last_modified: new Date().toISOString()
        }).eq('id', openRows[0].id);
        error = res.error;
      } else {
        const { data: anchorRows } = await supabase
          .from('disciplinary_actions')
          .select('complainant_name, complainant_id, complainant_country')
          .eq('case_number', selectedCase)
          .not('complainant_name', 'is', null)
          .order('last_modified', { ascending: true })
          .limit(1);
        if (anchorRows && anchorRows.length > 0) {
          insertData.complainant_name = anchorRows[0].complainant_name;
          insertData.complainant_id = anchorRows[0].complainant_id;
          insertData.complainant_country = anchorRows[0].complainant_country;
        }
        const res = await supabase.from('disciplinary_actions').insert([insertData]);
        error = res.error;
      }
    } else {
      const res = await supabase.from('disciplinary_actions').insert([insertData]);
      error = res.error;
      if (!error) {
        const { data: existing } = await supabase
          .from('case_complainants')
          .select('id')
          .eq('case_number', selectedCase)
          .limit(1);
        await supabase.from('case_complainants').insert([{
          case_number: selectedCase,
          complainant_name: newPersonName,
          complainant_id: newPersonId,
          complainant_country: newPersonCountry,
          is_anchor: !existing || existing.length === 0,
          modified_by_email: userEmail
        }]);
        await loadCaseComplainants(selectedCase);
      }
    }
    if (error) alert('Error adding ' + showAddPersonForm + ': ' + error.message);
    else {
      setShowAddPersonForm(null); setNewPersonName(''); setNewPersonId(''); setNewPersonCountry('');
      await refreshDaList();
    }
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key, direction });
  };

  const filteredCases = cases.filter(c => {
    if ((c.case_number || '').toUpperCase().startsWith('CVN') && !c.promoted) return false;
    if (showMyCases) {
      const myName = (userEmail || '').split('@')[0].split('.').join(' ').toLowerCase();
      const picLower = (c.pic || '').toLowerCase();
      if (!picLower.includes(myName)) return false;
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchCase = c.case_number?.toLowerCase().includes(search);
      const matchPic = c.pic?.toLowerCase().includes(search);
      const matchCountry = c.country?.toLowerCase().includes(search);
      const matchRespondent = c.disciplinary_actions?.some(da => da.respondent_name?.toLowerCase().includes(search) || da.respondent_id?.toLowerCase().includes(search));
      const matchComplainant = c.disciplinary_actions?.some(da => da.complainant_name?.toLowerCase().includes(search) || da.complainant_id?.toLowerCase().includes(search));
      if (!matchCase && !matchPic && !matchCountry && !matchRespondent && !matchComplainant) return false;
    }

    if (filters.pic && c.pic !== filters.pic) return false;
    if (filters.status && c.case_status !== filters.status) return false;
    if (filters.da_in_force) {
      const daInForce = c.disciplinary_actions?.filter(isDAInForce).length || 0;
      if (filters.da_in_force === 'yes' && daInForce === 0) return false;
      if (filters.da_in_force === 'no' && daInForce > 0) return false;
    }

    return true;
  });

  const sortedCases = React.useMemo(() => {
    let sortableCases = [...filteredCases];
    if (sortConfig.key === 'active_wip') {
      sortableCases.sort((a, b) => {
        const aCount = a.wip_actions?.filter(w => w.status === 'Pending').length || 0;
        const bCount = b.wip_actions?.filter(w => w.status === 'Pending').length || 0;
        return sortConfig.direction === 'ascending' ? aCount - bCount : bCount - aCount;
      });
    } else if (sortConfig.key === 'sla_due_date') {
      const asc = sortConfig.direction === 'ascending';
      const currentYear = new Date().getFullYear();
      const caseInfo = new Map();
      sortableCases.forEach(c => {
        const m = String(c.case_number || '').toUpperCase().match(/CXN-?(\d{4})(\d{2})(\d{2})/);
        caseInfo.set(c.case_number, {
          year: m ? parseInt(m[1], 10) : 0,
          creationDate: m ? parseInt(m[1] + m[2] + m[3], 10) : 0
        });
      });
      sortableCases.sort((a, b) => {
        const aClosed = a.case_status === 'COMPLETED' || a.case_status === 'CANCELLED';
        const bClosed = b.case_status === 'COMPLETED' || b.case_status === 'CANCELLED';
        if (!aClosed && bClosed) return -1;
        if (aClosed && !bClosed) return 1;
        if (!aClosed && !bClosed) {
          const aInfo = caseInfo.get(a.case_number) || { year: 0, creationDate: 0 };
          const bInfo = caseInfo.get(b.case_number) || { year: 0, creationDate: 0 };
          const aCurrent = aInfo.year >= currentYear;
          const bCurrent = bInfo.year >= currentYear;
          if (aCurrent && !bCurrent) return -1;
          if (!aCurrent && bCurrent) return 1;
          if (aCurrent && bCurrent) {
            if (a.sla_due_date < b.sla_due_date) return asc ? -1 : 1;
            if (a.sla_due_date > b.sla_due_date) return asc ? 1 : -1;
          } else {
            if (aInfo.creationDate < bInfo.creationDate) return -1;
            if (aInfo.creationDate > bInfo.creationDate) return 1;
          }
        } else {
          if (a.sla_due_date < b.sla_due_date) return asc ? 1 : -1;
          if (a.sla_due_date > b.sla_due_date) return asc ? -1 : 1;
        }
        return 0;
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
  const cancelled = cases.filter(c => c.case_status === 'CANCELLED').length;
  // PERF FIX: was recalculated on every render (including every keystroke anywhere
  // in the Dashboard). Now only recalculates when `cases` actually changes.
  const outOfSlaCases = React.useMemo(
    () => cases.filter(c => calculateBusinessDays(c.sla_due_date) < 0 && c.case_status === 'IN PROGRESS'),
    [cases]
  );

  // ==== DA In Force: latest action determines if the DA is still active ====
// Release or Termination = resolved, no longer in force
const isDAResolving = (da) => {
  const action = (da?.current_action || '').toLowerCase();
  return action.includes('release') || action.includes('terminat');
};

const isDAInForce = (da) => {
  if (!da) return false;
  const action = (da.current_action || '').toLowerCase();
  const prev = (da.previous_action || '').toLowerCase();

  if (isDAResolving(da)) {
    // A release or termination only takes effect once confirmed.
    if (da.da_confirmed === true) return false;
    // Not yet approved — the earlier action still governs.
    return prev.includes('suspend');
  }

  // Only suspensions count. Other actions (SCO/SCN, warning letters, reinstatements)
  // are tracked via WIP, not the DA count.
  // Only suspensions count, and only once confirmed as approved and in force.
  // Unapproved suspensions are tracked via WIP until the notice is issued.
  if (!action.includes('suspend')) return false;
  return da.da_confirmed === true;
};
  const getActionColor = (action) => {
    if (!action) return { text: '#64748b', bg: '#f1f5f9' };
    const lower = action.toLowerCase();
    if (lower.includes('terminat')) return { text: '#dc2626', bg: '#fee2e2' };
    if (lower.includes('suspend')) return { text: '#d67706', bg: '#fef3c7' };
    if (lower.includes('release') || lower.includes('issued warning')) return { text: '#059669', bg: '#d1fae5' };
    return { text: '#2563eb', bg: '#dbeafe' };
  };

  // ==== Complainant display: name + QNET ID# + country ====
const renderComplainantLine = () => {
  const da = daList.find(d => d.complainant_name || d.complainant_id || d.complainant_country);
  if (!da) return <span style={{ color: '#94a3b8' }}>—</span>;
  return (
    <span className="complainant-line">
      <span className="complainant-name">{da.complainant_name || '(unnamed)'}</span>
      {da.complainant_id && <span className="badge badge-purple" style={{ marginLeft: '6px' }}>QNET ID#: {da.complainant_id}</span>}
      {da.complainant_country && <span className="badge badge-grey" style={{ marginLeft: '6px' }}>{da.complainant_country}</span>}
    </span>
  );
};
// ==== Closure / reactivation dates display ====
// ==== Last-modified display ====
const renderModifiedInfo = (c) => {
  if (!c.last_modified) return null;
  return (
    <div className="expanded-sub" style={{ color: '#94a3b8', fontSize: '11px' }}>
      Modified: {formatDateTime(c.last_modified)}{c.modified_by_email ? ` (by ${c.modified_by_email.split('@')[0]})` : ''}
    </div>
  );
};
const renderClosureInfo = (c) => {
  const isClosed = c.case_status === 'COMPLETED' || c.case_status === 'CANCELLED';
  const label = c.case_status === 'CANCELLED' ? 'Closed (Cancelled): ' : 'Completed: ';
  return (
    <>
      {isClosed && c.date_completed && <div className="expanded-sub">{label}{c.date_completed}</div>}
      {c.reactivated_at && <div className="expanded-sub" style={{ color: '#64748b' }}>Reactivated: {formatDateTime(c.reactivated_at)}</div>}
    </>
  );
};
  // ==== INDIA STAGING: state, computations, handlers ====
  const [indiaSearch, setIndiaSearch] = useState('');
  const [indiaMatchFilter, setIndiaMatchFilter] = useState('');
  const [indiaPage, setIndiaPage] = useState(1);

  const indiaStaging = cases.filter(c => (c.case_number || '').toUpperCase().startsWith('CVN') && !c.promoted);
  const promotedCases = cases.filter(c => !(c.case_number || '').toUpperCase().startsWith('CVN') || c.promoted);

  const indiaPromotedIdMap = new Map();
  promotedCases.forEach(pc => {
    (pc.disciplinary_actions || []).forEach(pda => {
      if (pda.respondent_id) indiaPromotedIdMap.set(pda.respondent_id, pc.case_number);
    });
  });

  const indiaDuplicateMap = new Map();
  indiaStaging.forEach(sc => {
    const match = (sc.disciplinary_actions || []).find(da => da.respondent_id && indiaPromotedIdMap.has(da.respondent_id));
    if (match) indiaDuplicateMap.set(sc.case_number, indiaPromotedIdMap.get(match.respondent_id));
  });

  const indiaNoIdCount = indiaStaging.filter(c => !(c.disciplinary_actions || []).some(da => da.respondent_id)).length;

  const indiaFiltered = indiaStaging.filter(c => {
    if (indiaSearch) {
      const search = indiaSearch.toLowerCase();
      const matchCase = c.case_number?.toLowerCase().includes(search);
      const matchPerson = (c.disciplinary_actions || []).some(da =>
        (da.respondent_id || '').toLowerCase().includes(search) ||
        (da.respondent_name || '').toLowerCase().includes(search)
      );
      if (!matchCase && !matchPerson) return false;
    }
    if (indiaMatchFilter === 'matched' && !indiaDuplicateMap.has(c.case_number)) return false;
    if (indiaMatchFilter === 'unmatched' && indiaDuplicateMap.has(c.case_number)) return false;
    return true;
  });

  const handlePromoteCase = async (caseNum) => {
    const { error } = await supabase.from('cases').update({
      promoted: true, modified_by_email: userEmail, last_modified: new Date().toISOString()
    }).eq('case_number', caseNum);
    if (error) alert('Error promoting case: ' + error.message);
    else fetchCases(true);
  };

  const handleDeleteStagingCase = async (caseNum) => {
    if (!window.confirm(`Delete staging case ${caseNum}?\n\nThis removes the case and its respondent records permanently.`)) return;
    await supabase.from('disciplinary_actions').delete().eq('case_number', caseNum);
    await supabase.from('wip_actions').delete().eq('case_number', caseNum);
    const { error } = await supabase.from('cases').delete().eq('case_number', caseNum);
    if (error) alert('Error deleting: ' + error.message);
    else fetchCases(true);
  };
  const handleBulkDeleteNoId = async () => {
    const noIdCases = indiaStaging.filter(c => !(c.disciplinary_actions || []).some(da => da.respondent_id));
    if (noIdCases.length === 0) { alert('No cases without ID# to delete.'); return; }
    if (!window.confirm(`Delete ${noIdCases.length} cases without ID#?\n\nThese cannot be matched to any person.`)) return;
    for (const c of noIdCases) {
      await supabase.from('disciplinary_actions').delete().eq('case_number', c.case_number);
      await supabase.from('cases').delete().eq('case_number', c.case_number);
    }
    fetchCases(true);
    alert(`Deleted ${noIdCases.length} cases without ID#.`);
  };

  const [indiaSelectedCases, setIndiaSelectedCases] = useState({});
  const [indiaSortConfig, setIndiaSortConfig] = useState({ key: '', direction: 'ascending' });

  const requestIndiaSort = (key) => {
    let direction = 'ascending';
    if (indiaSortConfig.key === key && indiaSortConfig.direction === 'ascending') direction = 'descending';
    setIndiaSortConfig({ key, direction });
  };

  const handleToggleIndiaCase = (caseNum) => {
    setIndiaSelectedCases(prev => ({ ...prev, [caseNum]: !prev[caseNum] }));
  };

  const handleSelectAllIndia = () => {
    const allSelected = indiaFiltered.length > 0 && indiaFiltered.every(c => indiaSelectedCases[c.case_number]);
    if (allSelected) {
      setIndiaSelectedCases({});
    } else {
      const newSel = {};
      indiaFiltered.forEach(c => { newSel[c.case_number] = true; });
      setIndiaSelectedCases(newSel);
    }
  };

  const handleBatchPromote = async () => {
    const selected = Object.keys(indiaSelectedCases).filter(k => indiaSelectedCases[k]);
    if (selected.length === 0) { alert('No cases selected — tick the checkboxes first.'); return; }
    if (!window.confirm(`Add ${selected.length} cases to the Cases tab?`)) return;
    for (const caseNum of selected) {
      await supabase.from('cases').update({
        promoted: true, modified_by_email: userEmail, last_modified: new Date().toISOString()
      }).eq('case_number', caseNum);
    }
    setIndiaSelectedCases({});
    fetchCases(true);
    alert(`✅ Added ${selected.length} cases to the Cases tab.`);
  };

  const handleBatchDelete = async () => {
    const selected = Object.keys(indiaSelectedCases).filter(k => indiaSelectedCases[k]);
    if (selected.length === 0) { alert('No cases selected — tick the checkboxes first.'); return; }
    if (!window.confirm(`Delete ${selected.length} staging cases permanently?\n\nThis cannot be undone.`)) return;
    for (const caseNum of selected) {
      await supabase.from('disciplinary_actions').delete().eq('case_number', caseNum);
      await supabase.from('wip_actions').delete().eq('case_number', caseNum);
      await supabase.from('cases').delete().eq('case_number', caseNum);
    }
    setIndiaSelectedCases({});
    fetchCases(true);
    alert(`🗑 Deleted ${selected.length} cases.`);
  };

  const indiaSelectedCount = Object.keys(indiaSelectedCases).filter(k => indiaSelectedCases[k]).length;

  const indiaSorted = [...indiaFiltered];
  if (indiaSortConfig.key) {
    indiaSorted.sort((a, b) => {
      let aVal, bVal;
      if (indiaSortConfig.key === 'person_id') {
        const aDa = (a.disciplinary_actions || [])[0] || {};
        const bDa = (b.disciplinary_actions || [])[0] || {};
        aVal = aDa.respondent_id || aDa.complainant_id || '';
        bVal = bDa.respondent_id || bDa.complainant_id || '';
      } else if (indiaSortConfig.key === 'person_name') {
        const aDa = (a.disciplinary_actions || [])[0] || {};
        const bDa = (b.disciplinary_actions || [])[0] || {};
        aVal = aDa.respondent_name || aDa.complainant_name || '';
        bVal = bDa.respondent_name || bDa.complainant_name || '';
      } else if (indiaSortConfig.key === 'role') {
        const aDa = (a.disciplinary_actions || [])[0] || {};
        const bDa = (b.disciplinary_actions || [])[0] || {};
        aVal = aDa.respondent_name ? 'Respondent' : 'Complainant';
        bVal = bDa.respondent_name ? 'Respondent' : 'Complainant';
      } else {
        aVal = a[indiaSortConfig.key] || '';
        bVal = b[indiaSortConfig.key] || '';
      }
      if (String(aVal) < String(bVal)) return indiaSortConfig.direction === 'ascending' ? -1 : 1;
      if (String(aVal) > String(bVal)) return indiaSortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });
  }

  const indiaPageSize = 25;
  const indiaTotalPages = Math.ceil(indiaSorted.length / indiaPageSize);
  const indiaCurrentPage = indiaSorted.slice((indiaPage - 1) * indiaPageSize, indiaPage * indiaPageSize);
  const parseComplainants = (raw) => {
    if (!raw || typeof raw !== 'string') return [{ name: raw || null, id: null, cust: null }];
    const looksLikeId = (s) => /^[A-Za-z]{1,3}[0-9]{3,12}$/.test(String(s).trim());
    const chunks = raw.split(/\s*[\/&,]\s*(?=[^)]*(?:\(|$))/).map(c => c.trim()).filter(Boolean);
    const useChunks = chunks.length > 1 ? chunks : [raw.trim()];
    const out = [];
    useChunks.forEach(chunk => {
      let name = chunk;
      let mains = [];
      let custs = [];
      const br = chunk.match(/^(.*?)[\(\[]([^\)\]]*)[\)\]]\s*$/);
      if (br) {
        const inside = br[2].trim();
        const parts = inside.split(/[\/,]/).map(p => p.trim()).filter(Boolean);
        if (parts.length > 0 && parts.every(looksLikeId)) {
          name = br[1].trim() || chunk;
          parts.forEach(p => {
            const up = p.toUpperCase();
            if (up.startsWith('CU') || up.startsWith('CE')) custs.push(up);
            else mains.push(up);
          });
        }
      } else {
        const words = chunk.split(/\s+/);
        const last = words[words.length - 1];
        if (words.length > 1 && looksLikeId(last)) {
          mains.push(last.toUpperCase());
          name = words.slice(0, -1).join(' ').trim();
        }
      }
      if (mains.length === 0 && custs.length > 0) mains.push(custs.shift());
      out.push({
        name: name || null,
        id: mains.length ? mains.join('/') : null,
        cust: custs.length ? custs.join('/') : null
      });
    });
    return out.length ? out : [{ name: raw, id: null, cust: null }];
  };
  const [respRows, setRespRows] = React.useState([]);
  const [respLoading, setRespLoading] = React.useState(false);
  const [respSearchInput, setRespSearchInput] = React.useState('');
  const [respSearch, setRespSearch] = React.useState('');
  const [respCountry, setRespCountry] = React.useState('');
  const [respViolation, setRespViolation] = React.useState('');
  const [respAction, setRespAction] = React.useState('');
  const [respStatus, setRespStatus] = React.useState('');
  const [respRepeatOnly, setRespRepeatOnly] = React.useState(false);
  const [respPage, setRespPage] = React.useState(1);
  const [respDetail, setRespDetail] = React.useState(null);

  React.useEffect(() => {
    const t = setTimeout(() => { setRespSearch(respSearchInput); setRespPage(1); }, 250);
    return () => clearTimeout(t);
  }, [respSearchInput]);

  const fetchRespondents = React.useCallback(async () => {
    setRespLoading(true);
    let all = [];
    let from = 0;
    const size = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('disciplinary_actions')
        .select('*, cases(pic, case_status, country)')
        .order('case_number', { ascending: false })
        .range(from, from + size - 1);
      if (error || !data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < size) break;
      from += size;
    }
    setRespRows(all);
    setRespLoading(false);
  }, []);

  React.useEffect(() => {
    if (activeTab === 'respondents' && respRows.length === 0 && !respLoading) fetchRespondents();
  }, [activeTab]);

  const respCaseCountById = React.useMemo(() => {
    const m = new Map();
    respRows.forEach(r => {
      const key = (r.respondent_id || '').trim().toUpperCase();
      if (!key || key === 'UNIDENTIFIED ID') return;
      const hasViolation = (Array.isArray(r.violations) && r.violations.length > 0) || !!r.violation_category;
      const hasAction = !!r.current_action;
      if (!hasViolation || !hasAction) return;
      if (!m.has(key)) m.set(key, new Set());
      m.get(key).add(r.case_number);
    });
    return m;
  }, [respRows]);

  const respRepeatCount = (r) => {
    const key = (r.respondent_id || '').trim().toUpperCase();
    if (!key) return 1;
    const s = respCaseCountById.get(key);
    return s ? s.size : 1;
  };

  const respUniqueVals = React.useMemo(() => {
    const c = new Set(), v = new Set(), a = new Set(), s = new Set();
    respRows.forEach(r => {
      if (r.respondent_country) c.add(r.respondent_country);
      if (r.violation_category) v.add(r.violation_category);
      if (r.current_action) a.add(r.current_action);
      if (r.cases && r.cases.case_status) s.add(r.cases.case_status);
    });
    const srt = (x) => Array.from(x).sort();
    return { countries: srt(c), violations: srt(v), actions: srt(a), statuses: srt(s) };
  }, [respRows]);

  const respFiltered = React.useMemo(() => {
    const q = respSearch.trim().toLowerCase();
    return respRows.filter(r => {
      if (respCountry && r.respondent_country !== respCountry) return false;
      if (respViolation && r.violation_category !== respViolation) return false;
      if (respAction && r.current_action !== respAction) return false;
      if (respStatus && (!r.cases || r.cases.case_status !== respStatus)) return false;
      if (respRepeatOnly && respRepeatCount(r) < 2) return false;
      if (!q) return true;
      const hay = [r.case_number, r.complainant_name, r.complainant_id, r.complainant_cust_id,
                   r.respondent_name, r.respondent_id].map(x => String(x || '').toLowerCase()).join(' | ');
      return hay.includes(q);
    });
  }, [respRows, respSearch, respCountry, respViolation, respAction, respStatus, respRepeatOnly, respCaseCountById]);

  const respPageSize = 25;
  const respTotalPages = Math.max(1, Math.ceil(respFiltered.length / respPageSize));
  const respCurrentPage = respFiltered.slice((respPage - 1) * respPageSize, respPage * respPageSize);

  const respOtherCases = (r) => {
    const key = (r.respondent_id || '').trim().toUpperCase();
    if (!key) return [];
    const seen = new Map();
    respRows.forEach(x => {
      if ((x.respondent_id || '').trim().toUpperCase() !== key) return;
      if (x.case_number === r.case_number) return;
      if (!seen.has(x.case_number)) seen.set(x.case_number, x);
    });
    return Array.from(seen.values());
  };

  const respMissingInfo = (r) => !r.respondent_name || !r.respondent_id || !r.complainant_name;
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'cases', label: 'Cases', icon: '📁' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'india', label: 'India Tracker', icon: '🇮🇳' },
    { id: 'respondents', label: 'Respondents', icon: '👥' },
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
        .sidebar.hovered { width: 260px; }
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
        .main-content { flex: 1; min-width: 0; padding: 24px; overflow-y: auto; }
        .page-header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
        .page-header-text h2 { font-size: 22px; font-weight: 600; margin: 0 0 5px 0; color: #0f172a; }
        .page-header-text p { color: #64748b; margin: 0; font-size: 13px; }
        .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; margin-bottom: 24px; }
        .card-header { margin-top: 0; margin-bottom: 8px; font-size: 16px; font-weight: 600; }
        .card-subtitle { color: #64748b; font-size: 13px; margin-bottom: 16px; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; }
        @media (min-width: 768px) { .stats-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; } }
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
        @media (min-width: 768px) { .form-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: end; } }
        .table-container { overflow-x: auto; border-radius: 12px; border: 1px solid #e2e8f0; background: white; }
        .table { width: 100%; border-collapse: collapse; text-align: left; }
        .table thead tr { border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; }
        .table th { padding: 10px 12px; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; cursor: pointer; }
        .table th:hover { background-color: #f1f5f9; }
        .table td { padding: 10px 12px; font-size: 12.5px; color: #475569; white-space: normal; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
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
        @media (min-width: 768px) { .wip-form { grid-template-columns: minmax(0,2fr) minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) auto; align-items: end; } .wip-notes-row { grid-column: 1 / -1; } }
        .wip-input-group label { font-size: 10px; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px; }
        .wip-input-group { min-width: 0; }
        .wip-input-group select, .wip-input-group input, .wip-input-group textarea { width: 100%; padding: 6px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; }
        .wip-input-group textarea { resize: vertical; min-height: 38px; }
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
        @media (min-width: 768px) { .person-form { grid-template-columns: minmax(0,2fr) minmax(0,2fr) minmax(0,2fr) auto; align-items: end; } }
        .sub-action-form { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
        @media (max-width: 768px) { .sidebar { position: fixed; left: 0; top: 0; bottom: 0; z-index: 100; box-shadow: 2px 0 10px rgba(0,0,0,0.1); } .sidebar.collapsed { transform: translateX(-100%); width: 260px; } .main-content { padding: 16px; } }
        /* ==== ADMIN edit styles ==== */
        .btn-admin { padding: 6px 10px; background-color: #8b5cf6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; white-space: nowrap; margin-right: 4px; }
        .btn-admin:hover { background-color: #7c3aed; }
        .admin-edit-form { background: #f5f3ff; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #c4b5fd; flex-basis: 100%; }
        .admin-edit-form .form-title { margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #6d28d9; }
        .admin-edit-form .form-sub { font-size: 11px; color: #94a3b8; margin: 0 0 12px 0; }
        .admin-form-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        @media (min-width: 768px) { .admin-form-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        .admin-form-grid .full-width { grid-column: 1 / -1; }
        .admin-form-actions { display: flex; gap: 8px; margin-top: 12px; }
        .btn-save-admin { padding: 8px 16px; background-color: #7c3aed; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
        .btn-cancel-admin { padding: 8px 16px; background-color: white; color: #64748b; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 13px; }
        /* ==== ADMIN respondent editor ==== */
.respondent-admin-strip { background: #f5f3ff; border: 1px solid #c4b5fd; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
.respondent-admin-label { margin: 0 0 6px 0; font-size: 11px; font-weight: 600; color: #6d28d9; text-transform: uppercase; letter-spacing: 0.04em; }
.respondent-admin-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px dashed #ddd6fe; flex-wrap: wrap; }
.respondent-admin-row:last-child { border-bottom: none; }
.respondent-admin-name { font-size: 13px; color: #0f172a; }
.respondent-admin-form { padding: 4px 0 8px 0; }
.btn-admin-danger { padding: 6px 10px; background-color: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; white-space: nowrap; }
.btn-admin-danger:hover { background-color: #dc2626; }
.complainant-line { display: inline-flex; align-items: center; flex-wrap: wrap; }
.complainant-name { font-weight: 600; color: #0f172a; }
.close-case-panel { flex-basis: 100%; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.close-case-label { font-size: 13px; font-weight: 600; color: #0f172a; }
.btn-cancel-status { background-color: #64748b; color: white; border: none; }
/* ===== HORIZONTAL TOP NAV ===== */
.app-container { display: block; }

.topbar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 20px;
  height: 60px;
  background: #0f172a;
  position: sticky;
  top: 0;
  z-index: 200;
}
.topbar-brand { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.topbar-logo { font-size: 20px; }
.topbar-brand h1 {
  font-size: 16px; font-weight: 600; color: #fff;
  margin: 0; white-space: nowrap;
}

.topnav { display: flex; gap: 4px; flex: 1; overflow-x: auto; }
.topnav-item {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border: none; border-radius: 8px;
  background: transparent; color: #94a3b8;
  font-size: 14px; font-weight: 500; cursor: pointer;
  white-space: nowrap; transition: background .15s, color .15s;
}
.topnav-item:hover { background: #1e293b; color: #e2e8f0; }
.topnav-item.active { background: #3b82f6; color: #fff; }
.topnav-item .icon { font-size: 16px; }

.topbar-user {
  display: flex; align-items: center; gap: 10px;
  flex-shrink: 0; margin-left: auto;
}
.topbar-user .user-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: #3b82f6; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 600; font-size: 14px; flex-shrink: 0;
}
.topbar-user .user-details { line-height: 1.2; }
.topbar-user .user-details .email {
  font-size: 12px; color: #e2e8f0; font-weight: 500;
  max-width: 170px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.topbar-user .user-details .role { font-size: 10px; color: #64748b; }
.topbar-user .btn-signout {
  padding: 6px 12px; border: 1px solid #334155; border-radius: 6px;
  background: transparent; color: #94a3b8;
  font-size: 12px; cursor: pointer; white-space: nowrap;
}
.topbar-user .btn-signout:hover { background: #1e293b; color: #fff; }

.main-content {
  margin-left: 0 !important;
  width: 100%;
  padding: 24px;
}

/* On narrow screens: hide tab words and the email, keep icons */
@media (max-width: 900px) {
  .topbar { gap: 12px; padding: 0 12px; }
  .topbar-brand h1 { display: none; }
  .topnav-item .label { display: none; }
  .topnav-item { padding: 8px 12px; }
  .topbar-user .user-details { display: none; }
}
/* ===== RESPONDENTS TAB ===== */
        .resp-filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
        .resp-filters select,
        .resp-search { padding: 7px 10px; border: 1px solid #dde3ea; border-radius: 6px; font-size: 13px; background: #fff; }
        .resp-search { flex: 1; min-width: 260px; }
        .resp-toggle { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #334155; white-space: nowrap; }
        .resp-count { font-size: 13px; color: #64748b; margin-bottom: 8px; }
        .resp-hint { margin-left: 12px; color: #94a3b8; font-style: italic; }
        .resp-table-wrap { overflow-x: auto; border: 1px solid #dde3ea; border-radius: 8px; background: #fff; }
        .resp-table { width: 100%; border-collapse: collapse; font-size: 12.5px; white-space: nowrap; }
        .resp-table th { position: sticky; top: 0; background: #f1f5f9; text-align: left; padding: 9px 10px; border-bottom: 1px solid #dde3ea; font-weight: 600; color: #334155; }
        .resp-table td { padding: 8px 10px; border-bottom: 1px solid #eef2f6; color: #1f2937; }
        .resp-table tbody tr:hover { background: #f8fafc; cursor: pointer; }
        .resp-badge { display: inline-block; margin-left: 4px; background: #dc2626; color: #fff; border-radius: 10px; padding: 1px 7px; font-size: 11px; font-weight: 700; }
        .resp-empty { padding: 26px; text-align: center; color: #94a3b8; font-size: 13px; }
        .resp-pager { display: flex; align-items: center; gap: 12px; justify-content: center; margin: 12px 0; font-size: 13px; color: #475569; }
        .resp-host { position: fixed; inset: 0; z-index: 900; }
        .resp-overlay { position: absolute; inset: 0; background: rgba(15,23,42,0.45); }
        .resp-panel { position: absolute; top: 0; right: 0; height: 100%; width: 90vw; max-width: 1100px; background: #fff; box-shadow: -6px 0 26px rgba(15,23,42,0.22); display: flex; flex-direction: column; }
        .resp-topbar { display: flex; align-items: center; justify-content: space-between; padding: 13px 18px; border-bottom: 1px solid #dde3ea; background: #f8fafc; font-size: 15px; }
        .resp-close { border: none; background: transparent; font-size: 19px; cursor: pointer; color: #475569; line-height: 1; }
        .resp-panel-body { padding: 18px; overflow-y: auto; flex: 1; }
        .resp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: 11px; }
        .resp-grid div { border: 1px solid #eef2f6; border-radius: 6px; padding: 8px 10px; background: #fbfdff; }
        .resp-grid span { display: block; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .4px; }
        .resp-grid b { font-size: 13px; color: #1f2937; font-weight: 600; word-break: break-word; }
        .resp-h4 { margin: 20px 0 8px; font-size: 14px; color: #334155; display: flex; align-items: center; gap: 10px; }
        .resp-note { font-size: 13px; color: #475569; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 6px; padding: 10px 12px; white-space: pre-wrap; }
        .resp-mini { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .resp-mini th { background: #f1f5f9; text-align: left; padding: 7px 9px; border-bottom: 1px solid #dde3ea; color: #334155; }
        .resp-mini td { padding: 7px 9px; border-bottom: 1px solid #eef2f6; }
        .resp-badge-big { background: #dc2626; color: #fff; border-radius: 11px; padding: 2px 10px; font-size: 11px; font-weight: 700; }
        .resp-ok { background: #dcfce7; color: #166534; border-radius: 11px; padding: 2px 10px; font-size: 11px; font-weight: 600; }
        .resp-warn { background: #fddddd; border: 1px solid #fbb; color: #991b1b; border-radius: 6px; padding: 9px 12px; font-size: 12.5px; margin-bottom: 9px; }
/* ===== CASE DRAWER ===== */
.drawer-host td { padding: 0 !important; }

.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 900;
}

.drawer-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 90vw;
  background: #f8fafc;
  z-index: 901;
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 24px rgba(15, 23, 42, 0.18);
  text-align: left;
}

.drawer-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: #ffffff;
  border-bottom: 1px solid #dde3ea;
  flex-shrink: 0;
}

.drawer-topbar-title {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.drawer-close {
  width: 32px;
  height: 32px;
  border: 1px solid #dde3ea;
  border-radius: 8px;
  background: #ffffff;
  color: #64748b;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
}

.drawer-close:hover {
  background: #fddddd;
  color: #dc2626;
  border-color: #fecaca;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

@media (max-width: 900px) {
  .drawer-panel { width: 100vw; }
}
      `}</style>

<div className="app-container">
        <header className="topbar">
          <div className="topbar-brand">
            <span className="topbar-logo">📋</span>
            <h1>SLA Tracker</h1>
          </div>

          <nav className="topnav">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`topnav-item ${activeTab === item.id ? 'active' : ''}`}
                title={item.label}
              >
                <span className="icon">{item.icon}</span>
                <span className="label">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="topbar-user">
            <div className="user-avatar" title={userEmail}>
              {userEmail?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <div className="email">{userEmail}</div>
              <div className="role">{isAdmin ? 'Administrator' : 'Standard User'}</div>
            </div>
            <button onClick={onSignOut} className="btn-signout">Sign Out</button>
          </div>
        </header>

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
                <div className="stat-card"><div className="stat-title">Cancelled</div><div className="stat-value"><span className="stat-number" style={{color: '#64748b'}}>{cancelled}</span><span className="stat-badge badge-grey">cases</span></div></div>
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
                  <p>Search, filter, and manage all disciplinary cases.</p>
                </div>
                <button onClick={() => setShowCaseForm(!showCaseForm)} className="btn-add-case">{showCaseForm ? 'Close Form' : '+ Add New Case'}</button>
              </div>

              {showCaseForm && (
                <form onSubmit={handleAddCase} className="add-case-form">
                  <div className="form-grid">
                    <div className="wip-input-group"><label>Case Number</label><input type="text" value={newCaseNum} onChange={(e) => setNewCaseNum(e.target.value)} required /></div>
                    <div className="wip-input-group"><label>PIC</label><input type="text" value={newPic} onChange={(e) => setNewPic(e.target.value)} /></div>
                    <div className="wip-input-group"><label>Country</label><input type="text" value={newCountry} onChange={(e) => setNewCountry(e.target.value)} required /></div>
                    <div className="wip-input-group"><label>SLA Days (auto-calculates due date)</label><input type="number" min="1" max="100" value={newSlaDays} onChange={(e) => setNewSlaDays(parseInt(e.target.value) || 30)} required /></div>
                    <button type="submit" className="btn-log" style={{ backgroundColor: '#10b981' }}>Save Case</button>
                  </div>
                </form>
              )}

              <div className="table-container">
                <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="text" placeholder="Search cases, PICs, respondents, complainants..." value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setCurrentPage(1); }} style={{ flex: 1, minWidth: '200px', padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }} />
                  <select value={filters.pic} onChange={(e) => setFilters(f => ({ ...f, pic: e.target.value }))} style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}>
                    <option value="">All PICs</option>
                    {[...new Set(cases.map(c => c.pic).filter(Boolean))].map(pic => <option key={pic} value={pic}>{pic}</option>)}
                  </select>
                  <select value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))} style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}>
                    <option value="">All Status</option>
                    <option value="IN PROGRESS">IN PROGRESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                  <select value={filters.da_in_force} onChange={(e) => setFilters(f => ({ ...f, da_in_force: e.target.value }))} style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}>
  <option value="">All DA Status</option>
  <option value="yes">DA In Force</option>
  <option value="no">No DA In Force</option>
</select>
<button onClick={() => { setShowMyCases(!showMyCases); setCurrentPage(1); }} style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', backgroundColor: showMyCases ? '#3b82f6' : 'white', color: showMyCases ? 'white' : '#334155', whiteSpace: 'nowrap' }}>
                    👤 My Cases
                  </button>
<button onClick={() => { setSearchInput(''); setSearchTerm(''); setFilters({ pic: '', status: '', da_in_force: '' }); setSortConfig({ key: 'sla_due_date', direction: 'ascending' }); setCurrentPage(1); setShowMyCases(false); }}>✕ Clear</button>
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
                          <th style={{ cursor: 'default' }}>SLA Status</th>
                          <th style={{ cursor: 'default' }}>Closure SLA</th>
                          <th onClick={() => requestSort('active_wip')}>Active WIP <SortIndicator column="active_wip" /></th>
                          <th style={{ width: '80px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentCases.map((c, index) => {
                          const slaDays = calculateBusinessDays(c.sla_due_date);
                          const daInForce = c.disciplinary_actions?.filter(isDAInForce).length || 0;
                          const activeWip = (c.wip_actions?.filter(w => w.status === 'Pending').length || 0) +
                          (c.disciplinary_actions?.reduce((sum, da) =>
                            sum + (da.action_history || []).reduce((s, h) =>
                              s + (h.sub_actions || []).filter(sa => sa.status !== 'Done').length, 0), 0) || 0);
                          const isBreached = slaDays < 0 && c.case_status === 'IN PROGRESS';
                          return (
                            <React.Fragment key={index}>
                              <tr className={selectedCase === c.case_number ? 'selected' : ''}>
                              <td style={{ fontWeight: 600, color: '#0f172a', cursor: 'pointer' }} onClick={() => handleCaseClick(c.case_number)} title="Click to open case details">{c.case_number}</td>
  <td>{c.pic || '—'}</td>
  <td><span className={`badge ${c.case_status === 'IN PROGRESS' ? 'badge-blue' : c.case_status === 'CANCELLED' ? 'badge-grey' : 'badge-green'}`}>{c.case_status}</span></td>
  <td style={{ color: isBreached ? '#dc2626' : '#059669', fontWeight: 600 }}>{c.sla_due_date || '—'}</td>
  <td style={{ textAlign: 'center', fontWeight: 600, color: daInForce > 0 ? '#dc2626' : '#94a3b8' }}>{daInForce}</td>
  <td>{c.case_status !== 'IN PROGRESS' ? <span style={{ color: '#94a3b8' }}>—</span> : (slaDays < 0 ? <span style={{ color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' }}>🔴 {Math.abs(slaDays)}d lapsed</span> : <span style={{ color: '#059669', fontWeight: 600, whiteSpace: 'nowrap' }}>🟢 {slaDays}d left</span>)}</td>
  <td>
                                  {c.case_status !== 'IN PROGRESS' && c.date_completed && c.sla_due_date ? (
                                    new Date(c.date_completed) <= new Date(c.sla_due_date) ? (
                                      <span className="badge badge-green" style={{ whiteSpace: 'nowrap' }}>✓ Within SLA</span>
                                    ) : (
                                      <span className="badge badge-red" style={{ whiteSpace: 'nowrap' }}>✗ Out of SLA</span>
                                    )
                                  ) : (
                                    <span style={{ color: '#94a3b8' }}>—</span>
                                  )}
                                </td>
  <td style={{ textAlign: 'center', fontWeight: 600, color: activeWip > 0 ? '#8b5cf6' : '#94a3b8' }}>{activeWip}</td>
  <td><button onClick={() => handleCaseClick(c.case_number)} className="btn-action">{selectedCase === c.case_number ? 'Back' : 'View'}</button></td>
</tr>

{selectedCase === c.case_number && (
                                <tr className="drawer-host">
                                  <td colSpan="9" style={{ padding: 0, border: 'none' }}>
                                    <div className="drawer-overlay" onClick={() => handleCaseClick(c.case_number)} />
                                    <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
                                      <div className="drawer-topbar">
                                        <div className="drawer-topbar-title">
                                          📁 {c.case_number}
                                        </div>
                                        <button
                                          className="drawer-close"
                                          onClick={() => handleCaseClick(c.case_number)}
                                          title="Close (Esc)"
                                        >✕</button>
                                      </div>
                                      <div className="drawer-body">
                                    <div className="expanded-card">
                                      <div className="expanded-header">
                                        <div>
                                          <span className="expanded-label">CASE DETAILS</span>
                                          <div className="expanded-value">{c.case_number}</div>
                                          {(() => {
  const fromTable = (caseComplainants || []).map(x => ({
    complainant_name: x.complainant_name,
    complainant_id: x.complainant_id,
    complainant_country: x.complainant_country,
    is_anchor: x.is_anchor
  }));
  const fromRows = [...new Map(c.disciplinary_actions?.filter(da => da.complainant_name).map(da => [da.complainant_name, da])).values()];
  const complainants = fromTable.length > 0 ? fromTable : fromRows;
  if (complainants.length > 0) {
    return (
      <div className="expanded-sub" style={{ marginTop: '4px', fontWeight: '600', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
        Complainant(s):
        {complainants.map((comp, i) => (
          <span key={i} className="complainant-line">
            <span className="complainant-name">{comp.complainant_name}{comp.is_anchor ? ' ⚓' : ''}</span>
            <span className="badge badge-purple" style={{ marginLeft: '4px' }}>QNET ID#: {comp.complainant_id || '—'}</span>
            {comp.complainant_country && <span className="badge badge-grey" style={{ marginLeft: '4px' }}>{comp.complainant_country}</span>}
          </span>
        ))}
      </div>
    );
  }
  return null;
})()}
                                          <div className="expanded-sub">Priority: {c.priority || '—'} | Stage: {c.stage || '—'}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                          <span className="expanded-label">SLA DUE DATE</span>
                                          <div className="expanded-value">{c.sla_due_date || '—'}</div>
                                          <div className="expanded-sub">Created: {c.created_on || '—'}</div>
{renderClosureInfo(c)}
{renderModifiedInfo(c)}
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                      {c.case_status === 'IN PROGRESS' && !showCloseOptions && <button onClick={() => setShowCloseOptions(true)} className="btn-action btn-success">Complete Case</button>}
{(c.case_status === 'COMPLETED' || c.case_status === 'CANCELLED') && <button onClick={() => handleReactivateCase(c.case_number)} className="btn-action btn-warning">Reactivate Case</button>}
{showCloseOptions && c.case_status === 'IN PROGRESS' && (
  <div className="close-case-panel">
    <span className="close-case-label">Close this case as:</span>
    <button onClick={() => handleCompleteCase(c.case_number, 'COMPLETED')} className="btn-action btn-success">✅ Completed</button>
    <button onClick={() => handleCompleteCase(c.case_number, 'CANCELLED')} className="btn-action btn-cancel-status">🚫 Cancelled</button>
    <button onClick={() => setShowCloseOptions(false)} className="btn-action">↩ Back</button>
  </div>
)}
{isAdmin && !editingCase && (
  <button className="btn-admin" onClick={openCaseEdit}>✏️ Edit Case</button>
)}
{editingCase && (
  <form className="admin-edit-form" onSubmit={handleUpdateCase}>
    <p className="form-title">✏️ Edit Case — {selectedCase}</p>
    <p className="form-sub">Admin only. Changing the case number moves all respondents &amp; WIP actions to the new number.</p>
    <div className="admin-form-grid">
      <div className="wip-input-group"><label>Case Number *</label><input type="text" value={caseForm.case_number} onChange={(e) => setCaseForm({ ...caseForm, case_number: e.target.value })} required /></div>
      <div className="wip-input-group"><label>PIC</label><input type="text" value={caseForm.pic} onChange={(e) => setCaseForm({ ...caseForm, pic: e.target.value })} /></div>
      <div className="wip-input-group"><label>Country</label><input type="text" value={caseForm.country} onChange={(e) => setCaseForm({ ...caseForm, country: e.target.value })} /></div>
      <div className="wip-input-group"><label>SLA Days (working days)</label><input type="number" placeholder="auto from Created On" value={caseForm.sla_days} onChange={(e) => { const days = parseInt(e.target.value, 10); const base = caseForm.created_on || (cases.find(x => x.case_number === selectedCase) || {}).created_on; if (!isNaN(days) && days > 0 && base) { setCaseForm({ ...caseForm, sla_days: days, sla_due_date: addBusinessDays(base, days) }); } else { setCaseForm({ ...caseForm, sla_days: e.target.value }); } }} /></div>
      <div className="wip-input-group"><label>SLA Due Date</label><input type="date" value={caseForm.sla_due_date} onChange={(e) => setCaseForm({ ...caseForm, sla_due_date: e.target.value })} /></div>
      <div className="wip-input-group"><label>Created On</label><input type="date" value={caseForm.created_on} onChange={(e) => setCaseForm({ ...caseForm, created_on: e.target.value })} /></div>
      <div className="wip-input-group"><label>Priority</label>
        <select value={caseForm.priority} onChange={(e) => setCaseForm({ ...caseForm, priority: e.target.value })}>
          <option>High</option><option>Medium</option><option>Low</option>
        </select>
      </div>
      <div className="wip-input-group"><label>Stage</label><input type="text" placeholder="e.g. Stage 3" value={caseForm.stage} onChange={(e) => setCaseForm({ ...caseForm, stage: e.target.value })} /></div>
      <div className="wip-input-group"><label>Case Status</label>
        <select value={caseForm.case_status} onChange={(e) => setCaseForm({ ...caseForm, case_status: e.target.value })}>
        <option>IN PROGRESS</option><option>COMPLETED</option><option>CANCELLED</option>
        </select>
      </div>
      {(caseForm.case_status === 'COMPLETED' || caseForm.case_status === 'CANCELLED') && (
        <div className="wip-input-group">
          <label>{caseForm.case_status === 'CANCELLED' ? 'Closed (Cancelled) Date' : 'Completed Date'}</label>
          <input type="date" value={caseForm.date_completed} onChange={(e) => setCaseForm({ ...caseForm, date_completed: e.target.value })} />
        </div>
      )}
      <div className="wip-input-group full-width"><label>Remarks</label><textarea value={caseForm.remarks} onChange={(e) => setCaseForm({ ...caseForm, remarks: e.target.value })} /></div>
    </div>
    <p className="form-title" style={{ marginTop: '16px' }}>👤 Complainant Details</p>
    <p className="form-sub">Applies to this case (saved on all respondent rows).</p>
    <div className="admin-form-grid">
      <div className="wip-input-group"><label>Complainant Name</label><input type="text" value={caseForm.complainant_name} onChange={(e) => setCaseForm({ ...caseForm, complainant_name: e.target.value })} /></div>
      <div className="wip-input-group"><label>Complainant ID</label><input type="text" value={caseForm.complainant_id} onChange={(e) => setCaseForm({ ...caseForm, complainant_id: e.target.value })} /></div>
      <div className="wip-input-group"><label>Complainant Country</label><input type="text" value={caseForm.complainant_country} onChange={(e) => setCaseForm({ ...caseForm, complainant_country: e.target.value })} /></div>
    </div>
    <div className="admin-form-actions">
      <button type="submit" className="btn-save-admin">💾 Save Changes</button>
      <button type="button" className="btn-cancel-admin" onClick={() => setEditingCase(false)}>Cancel</button>
    </div>
  </form>
)}
                                        {!showAddPersonForm && <button onClick={() => setShowAddPersonForm('complainant')} className="btn-action">+ Add Complainant</button>}
                                        {!showAddPersonForm && <button onClick={() => setShowAddPersonForm('respondent')} className="btn-action">+ Add Respondent</button>}
                                      </div>

                                      {showAddPersonForm && (
                                        <form onSubmit={handleAddPerson} className="person-form">
                                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', width: '100%', marginBottom: '6px' }}>
                                            <input type="checkbox" checked={bulkMode} onChange={(e) => { setBulkMode(e.target.checked); setBulkPreview(null); }} />
                                            Add multiple — paste a list
                                          </label>
                                          {!bulkMode && <div className="wip-input-group"><label>{showAddPersonForm === 'complainant' ? 'Complainant Name' : 'Respondent Name'}</label><input type="text" value={newPersonName} onChange={(e) => setNewPersonName(e.target.value)} required /></div>}
                                          {!bulkMode && <div className="wip-input-group"><label>Qnet ID#</label><input type="text" value={newPersonId} onChange={(e) => setNewPersonId(e.target.value)} /></div>}
                                          {bulkMode && (
                                            <div className="wip-input-group" style={{ width: '100%' }}>
                                              <label>Paste list — one per line: Name (ID) or Name (ID/CU...) or ID Name</label>
                                              <textarea value={bulkText} maxLength={8000} rows={6} onChange={(e) => { setBulkText(e.target.value); setBulkPreview(null); }} style={{ width: '100%', padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px' }} />
                                              <div style={{ fontSize: '10px', color: '#94a3b8' }}>{bulkText.length} / 8000 characters</div>
                                            </div>
                                          )}
                                          <div className="wip-input-group"><label>Country</label><input type="text" value={newPersonCountry} onChange={(e) => setNewPersonCountry(e.target.value)} /></div>
                                          {bulkMode && bulkPreview && (
                                            <div style={{ width: '100%', marginTop: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px' }}>
                                              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Preview — untick any row you don't want to add:</div>
                                              {bulkPreview.map((p, pi) => {
                                                const dupName = daList.some(d => (showAddPersonForm === 'complainant' ? d.complainant_name : d.respondent_name)?.toUpperCase().trim() === p.name.toUpperCase().trim());
                                                const dupId = p.id && daList.some(d => (showAddPersonForm === 'complainant' ? d.complainant_id : d.respondent_id)?.toUpperCase().trim() === p.id.toUpperCase().trim());
                                                const dupInList = bulkPreview.some((q, qi) => qi !== pi && (q.name.toUpperCase().trim() === p.name.toUpperCase().trim() || (p.id && q.id.toUpperCase().trim() === p.id.toUpperCase().trim())));
                                                const warn = dupName || dupId ? 'already on this case' : (dupInList ? 'appears twice in your list' : (!p.id ? 'no ID found' : ''));
                                                return (
                                                  <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '2px 0' }}>
                                                    <input type="checkbox" checked={p.include} onChange={(e) => setBulkPreview(prev => prev.map((q, qi) => qi === pi ? { ...q, include: e.target.checked } : q))} />
                                                    <span style={{ color: '#94a3b8', minWidth: '16px' }}>{p.row}</span>
                                                    <span style={{ flex: 1 }}>{p.name || <em style={{ color: '#dc2626' }}>no name</em>}</span>
                                                    <span style={{ minWidth: '90px', color: p.id ? '#0f172a' : '#dc2626' }}>{p.id || '—'}</span>
                                                    <span style={{ minWidth: '110px', color: '#64748b' }}>{p.cust || ''}</span>
                                                    {warn && <span className="badge badge-yellow" style={{ fontSize: '10px' }}>⚠ {warn}</span>}
                                                  </div>
                                                );
                                              })}
                                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{bulkPreview.filter(p => p.include).length} will be added{!newPersonCountry ? ' — country is blank, remember to fill it in later' : ''}</div>
                                            </div>
                                          )}
                                          <div style={{ display: 'flex', gap: '4px', alignItems: 'end' }}>
                                            {bulkMode && !bulkPreview && <button type="button" onClick={() => setBulkPreview(parseBulkPeople(bulkText))} className="btn-log" style={{ backgroundColor: '#6366f1' }}>Preview</button>}
                                            {(!bulkMode || bulkPreview) && <button type="submit" className="btn-log" style={{ backgroundColor: '#10b981' }}>Add</button>}
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
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                              <button type="submit" className="btn-log">{editingWipId ? 'Update' : 'Log'}</button>
                                              <button type="button" onClick={resetWipForm} className="btn-action">Cancel</button>
                                            </div>
                                            <div className="wip-input-group wip-notes-row" style={{ gridColumn: '1 / -1' }}>
                                              <label>Notes / Replies</label>
                                              <textarea value={wipNotes} onChange={(e) => setWipNotes(e.target.value)} rows="2" placeholder="e.g., Reply 1 (Date)..."></textarea>
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
                                        <div className="section-title" style={{ cursor: 'pointer' }} onClick={() => setHideRespondents(!hideRespondents)}>
                                          <span>⚖️ Disciplinary Actions (Respondents) {daList.length > 3 && (hideRespondents ? '▼ Show' : '▲ Hide')}</span>
                                        </div>
                                        {daList.length === 0 ? (
                                          <div style={{ padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#94a3b8' }}>No respondents linked to this case. Use "+ Add Respondent" above.</div>
                                        ) : (
                                          <div>
                                            {isAdmin && daList.length > 0 && (
  <div className="respondent-admin-strip">
    <p className="respondent-admin-label">Admin — Respondent Details</p>
    {daList.map(da => (
      editingRespondentId === da.id ? (
        <form key={da.id} className="respondent-admin-form" onSubmit={(e) => handleUpdateRespondent(e, da.id)}>
          <div className="admin-form-grid">
            <div className="wip-input-group"><label>Respondent Name</label><input type="text" value={(respondentEdits[da.id] || {}).name || ''} onChange={(e) => setRespondentEdits(prev => ({ ...prev, [da.id]: { ...(prev[da.id] || {}), name: e.target.value } }))} /></div>
            <div className="wip-input-group"><label>Respondent ID</label><input type="text" value={(respondentEdits[da.id] || {}).id || ''} onChange={(e) => setRespondentEdits(prev => ({ ...prev, [da.id]: { ...(prev[da.id] || {}), id: e.target.value } }))} /></div>
            <div className="wip-input-group"><label>Respondent Country</label><input type="text" value={(respondentEdits[da.id] || {}).country || ''} onChange={(e) => setRespondentEdits(prev => ({ ...prev, [da.id]: { ...(prev[da.id] || {}), country: e.target.value } }))} /></div>
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="btn-save-admin">💾 Save Respondent</button>
            <button type="button" className="btn-cancel-admin" onClick={() => setEditingRespondentId(null)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div key={da.id} className="respondent-admin-row">
        <span className="respondent-admin-name">{da.respondent_name || '(unnamed)'}{da.respondent_id ? ` · ${da.respondent_id}` : ''}{da.respondent_country ? ` · ${da.respondent_country}` : ''}</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button type="button" className="btn-admin" onClick={() => startRespondentEdit(da)}>✏️ Edit</button>
          <button type="button" className="btn-admin-danger" onClick={() => handleDeleteRespondent(da.id)}>🗑 Delete</button>
        </div>
        {(da.action_history || []).length > 0 && (
          <div style={{ width: '100%', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Timeline steps — delete a wrongly recorded action:</div>
            {(da.action_history || []).map((h, hIdx) => (
              <div key={hIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '2px 0' }}>
                <span style={{ color: '#94a3b8', minWidth: '16px' }}>{hIdx + 1}</span>
                <span style={{ flex: 1 }}>{h.action || '—'}<span style={{ color: '#94a3b8', marginLeft: '6px' }}>{h.date || 'no date'}</span>{h.confirmed_by ? <span style={{ color: '#059669', marginLeft: '6px' }}>✓</span> : null}</span>
                <button type="button" className="btn-admin-danger" onClick={() => handleDeleteDaStep(da.id, hIdx)}>🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>
      )
    ))}
  </div>
)}
                                            {(hideRespondents && daList.length > 3 ? daList.slice(0, 3) : daList).map((da, i) => {
                                              const colors = getActionColor(da.current_action);
                                              const isExpanded = expandedDAs[da.id];
                                              return (
                                                <div key={da.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                                                    <div><span className="expanded-label">Respondent: </span><span className="item-title">{da.respondent_name || '—'}</span><span className="item-sub" style={{ marginLeft: '8px' }}>({da.respondent_id || '—'})</span>{da.respondent_country && <span className="badge badge-grey" style={{ marginLeft: '6px' }}>{da.respondent_country}</span>}</div>
                                                  </div> <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                                                      <span className="expanded-label" style={{ margin: 0 }}>Linked complainant:</span>
                                                      <select
                                                        value=""
                                                        onChange={(ev) => handleRelinkComplainant(da.id, ev.target.value)}
                                                        style={{ padding: '4px 8px', border: '1px solid #dde3ea', borderRadius: '6px', fontSize: '12px' }}
                                                      >
                                                        <option value="">
                                                          {da.complainant_name ? `${da.complainant_name}${da.complainant_id ? ' · ' + da.complainant_id : ''}` : '(none linked)'}
                                                        </option>
                                                        {caseComplainants.map(c => (
                                                          <option key={c.id} value={c.id}>
                                                            {c.complainant_name}{c.complainant_id ? ' · ' + c.complainant_id : ''}{c.is_anchor ? ' (anchor)' : ''}
                                                          </option>
                                                        ))}
                                                      </select>
                                                    </div>

                                                  <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
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

                                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px' }} onClick={() => toggleExpandDA(da.id)}>
                                                    <span className="expanded-label" style={{ margin: 0 }}>Action Timeline ({da.action_history?.length || 0})</span>
                                                    <span style={{ fontSize: '12px', color: '#64748b' }}>{isExpanded ? '▲ Hide' : '▼ Show'}</span>
                                                  </div>

                                                  {isExpanded && (
                                                    <div style={{ marginTop: '8px' }}>
                                                      {da.action_history && da.action_history.map((h, idx) => {
                                                        const hColors = getActionColor(h.action);
                                                        return (
                                                          <div key={idx} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                                            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                                                              <div className="step-circle">{h.step}</div>
                                                              <div className="item-content">
                                                                <span className="badge" style={{ backgroundColor: hColors.bg, color: hColors.text }}>{h.action || '—'}</span>
                                                                <div className="item-sub" style={{ marginTop: '4px' }}>Date DA in force: {h.date || 'No date'}</div>
                                                                {h.added_by && <div className="item-sub" style={{ fontSize: '10px' }}>Added by: {h.added_by?.split('@')[0]} on {formatDateTime(h.added_at)}</div>}                                                            {h.modified_by && <div className="item-sub" style={{ fontSize: '10px', color: '#94a3b8' }}>Modified by: {h.modified_by?.split('@')[0]} on {formatDateTime(h.modified_at)}</div>}
                                                                {h.cleared_by && <div className="item-sub" style={{ fontSize: '10px', color: '#b45309' }}>✗ Cleared by {h.cleared_by.split('@')[0]} on {formatDateTime(h.cleared_at)}{h.was_in_force_from ? ` — was in force from ${h.was_in_force_from}` : ''}</div>}
                                                              </div>
                                                              <button onClick={() => { setEditingDaAction({ daId: da.id, step: idx }); setEditDaActionName(h.action); setEditDaActionDate(h.date); }} className="btn-action">Edit</button>
                                                              {idx === da.action_history.length - 1 ? (
                                                                <>
                                                                  {da.da_confirmed !== true && <button onClick={() => handleConfirmDA(da.id, h.action)} className="btn-action btn-success" style={{ marginTop: '4px' }}>✓ Confirm DA</button>}
                                                                  {da.da_confirmed === true && <div style={{ marginTop: '4px' }}><span className="badge badge-green">✓ DA Confirmed</span>{da.da_confirmed_by && <span style={{ fontSize: '10px', color: '#059669', marginLeft: '4px' }}>by {da.da_confirmed_by.split('@')[0]} on {formatDateTime(da.da_confirmed_at)}</span>}</div>}
                                                                                                                                    {isAdmin && (da.da_confirmed === true || (da.da_confirmed == null && (da.current_action?.toLowerCase().includes('suspend') || da.current_action?.toLowerCase().includes('terminat')))) && <button onClick={() => handleClearDA(da.id)} className="btn-action btn-danger" style={{ marginTop: '4px', marginLeft: '4px' }}>✗ Clear DA Count</button>}
                                                                  {da.da_confirmed === false && <div style={{ marginTop: '4px' }}><span className="badge badge-grey">✗ Not In Force — cleared by admin</span></div>}
                                                                  {da.da_confirmed !== true && da.da_confirmed !== false && (h.action?.toLowerCase().includes('release') || h.action?.toLowerCase().includes('terminat')) && <div style={{ marginTop: '4px' }}><span className="badge badge-yellow">⏳ Awaiting approval — previous action still in force</span></div>}
                                                                </>
                                                              ) : (
                                                                h.confirmed_by ? <div style={{ marginTop: '4px' }}><span className="badge badge-green">✓ Confirmed</span><span style={{ fontSize: '10px', color: '#059669', marginLeft: '4px' }}>by {h.confirmed_by.split('@')[0]} on {formatDateTime(h.confirmed_at)}</span></div> : null
                                                              )}
                                                                                                                    </div>

                                                            {editingDaAction && editingDaAction.daId === da.id && editingDaAction.step === idx && (
                                                              <form onSubmit={(e) => handleEditDaAction(e, da.id, idx)} style={{ width: '100%', display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                                                <input type="text" value={editDaActionName} onChange={(e) => setEditDaActionName(e.target.value)} required style={{ flex: 1, minWidth: '150px', padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px' }} />
                                                                <input type="date" value={editDaActionDate} onChange={(e) => setEditDaActionDate(e.target.value)} style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px' }} />
                                                                <button type="submit" className="btn-log" style={{ backgroundColor: '#10b981' }}>Update</button>
                                                                <button type="button" onClick={() => setEditingDaAction(null)} className="btn-action">Cancel</button>
                                                              </form>
                                                            )}

                                                            <div style={{ width: '100%', marginTop: '8px', paddingLeft: '32px', borderLeft: '2px solid #e2e8f0' }}>
                                                              <div className="expanded-label">Journal / Sub-Actions</div>
                                                              {h.sub_actions && h.sub_actions.map((sa, saIdx) => (
                                                                <div key={saIdx} style={{ fontSize: '12px', color: '#475569', marginBottom: '4px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                  <span>{sa.date}</span> - <span>{sa.desc}</span>
                                                                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>(by {sa.added_by?.split('@')[0]})</span>
                                                                  {sa.status === 'Done' ? (
                                                                    <span className="badge badge-green" style={{ fontSize: '10px' }}>✓ Done</span>
                                                                  ) : (
                                                                    <span className="badge badge-yellow" style={{ fontSize: '10px' }}>⏳ Pending</span>
                                                                  )}
                                                                  {sa.status !== 'Done' && <button onClick={() => handleCompleteSubAction(da.id, idx, saIdx)} className="btn-action btn-success" style={{ fontSize: '10px', padding: '2px 6px' }}>✓ Complete</button>}
                                                                  {sa.completed_by && <span style={{ fontSize: '10px', color: '#94a3b8' }}>✓ by {sa.completed_by?.split('@')[0]}</span>}
                                                                  <button onClick={() => { setEditingSubActionEntry({ daId: da.id, step: idx, saIdx }); setEditSubActionDesc(sa.desc); setEditSubActionDate(sa.date); }} className="btn-action" style={{ fontSize: '10px', padding: '2px 6px' }}>✏️</button>
                                                                  {sa.modified_by && <span style={{ fontSize: '10px', color: '#94a3b8' }}>modified by {sa.modified_by?.split('@')[0]} on {formatDateTime(sa.modified_at)}</span>}
                                                                  {editingSubActionEntry && editingSubActionEntry.daId === da.id && editingSubActionEntry.step === idx && editingSubActionEntry.saIdx === saIdx && (
                                                                    <form onSubmit={(e) => handleEditSubAction(e, da.id, idx, saIdx)} style={{ width: '100%', display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                                      <input type="text" value={editSubActionDesc} onChange={(e) => setEditSubActionDesc(e.target.value)} required style={{ flex: 1, minWidth: '200px', padding: '4px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }} />
                                                                      <input type="date" value={editSubActionDate} onChange={(e) => setEditSubActionDate(e.target.value)} style={{ padding: '4px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }} />
                                                                      <button type="submit" className="btn-log" style={{ backgroundColor: '#10b981', fontSize: '11px', padding: '4px 8px' }}>Update</button>
                                                                      <button type="button" onClick={() => setEditingSubActionEntry(null)} className="btn-action" style={{ fontSize: '11px', padding: '4px 8px' }}>Cancel</button>
                                                                    </form>
                                                                  )}
                                                                </div>
                                                              ))}

                                                              {addingSubAction && addingSubAction.daId === da.id && addingSubAction.step === idx ? (
                                                                <form onSubmit={(e) => handleAddSubAction(e, da.id, idx)} className="sub-action-form">
                                                                  <input type="text" placeholder="Journal entry (e.g., Sent for approval)" value={newSubActionDesc} onChange={(e) => setNewSubActionDesc(e.target.value)} required style={{ flex: 1, minWidth: '150px', padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px' }} />
                                                                  <input type="date" value={newSubActionDate} onChange={(e) => setNewSubActionDate(e.target.value)} style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px' }} />
                                                                  <button type="submit" className="btn-log" style={{ backgroundColor: '#10b981' }}>Add</button>
                                                                  <button type="button" onClick={() => setAddingSubAction(null)} className="btn-action">Cancel</button>
                                                                </form>
                                                              ) : (
                                                                <button onClick={() => setAddingSubAction({ daId: da.id, step: idx })} className="btn-action" style={{ marginTop: '4px', fontSize: '10px' }}>+ Add Journal Entry</button>
                                                              )}
                                                            </div>
                                                          </div>
                                                        );
                                                      })}

                                                      {addingDaFor === da.id ? (
                                                        <form onSubmit={(e) => handleAddDaAction(e, da.id)} style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                          <input type="text" placeholder="Action Name" value={newDaAction} onChange={(e) => setNewDaAction(e.target.value)} required style={{ flex: 1, minWidth: '150px', padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px' }} />
                                                          {daList.length > 1 && (
                                                            <div style={{ width: '100%', marginTop: '6px' }}>
                                                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                                                <input type="checkbox" checked={bulkActionMode} onChange={(e) => { setBulkActionMode(e.target.checked); setBulkActionTargets({}); setBulkJournalText(''); }} />
                                                                Apply to other respondents
                                                              </label>
                                                              {bulkActionMode && (
                                                                <div style={{ marginTop: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px' }}>
                                                                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Tick the respondents who should also get "{newDaAction || '(action name)'}":</div>
                                                                  {daList.filter(d => d.id !== da.id).map(d => {
                                                                    const hist = d.action_history || [];
                                                                    const lastAct = hist.length ? (hist[hist.length - 1].action || '') : '';
                                                                    const same = newDaAction && lastAct.toLowerCase().trim() === newDaAction.toLowerCase().trim();
                                                                    return (
                                                                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '2px 0' }}>
                                                                        <input type="checkbox" checked={!!bulkActionTargets[d.id]} onChange={(e) => setBulkActionTargets(prev => ({ ...prev, [d.id]: e.target.checked }))} />
                                                                        <span style={{ flex: 1 }}>{d.respondent_name || '(unnamed)'}</span>
                                                                        <span style={{ minWidth: '90px', color: '#64748b' }}>{d.respondent_id || '—'}</span>
                                                                        {same && <span className="badge badge-yellow" style={{ fontSize: '10px' }}>⚠ already at "{lastAct}"</span>}
                                                                      </div>
                                                                    );
                                                                  })}
                                                                  <div className="wip-input-group" style={{ width: '100%', marginTop: '6px' }}>
                                                                    <label style={{ fontSize: '11px' }}>Journal entry (optional) — copied to everyone selected, and to this respondent</label>
                                                                    <textarea value={bulkJournalText} rows={3} onChange={(e) => setBulkJournalText(e.target.value)} style={{ width: '100%', padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }} />
                                                                  </div>
                                                                </div>
                                                              )}
                                                            </div>
                                                          )}
                                                                                                        <button type="submit" className="btn-log" style={{ backgroundColor: '#10b981' }}>Add</button>
                                                          <button type="button" onClick={() => setAddingDaFor(null)} className="btn-action">Cancel</button>
                                                        </form>
                                                      ) : (
                                                        <button onClick={() => setAddingDaFor(da.id)} className="btn-action" style={{ marginTop: '8px' }}>+ Add Action</button>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                            {hideRespondents && daList.length > 3 && (
                                              <div style={{ textAlign: 'center', padding: '8px', color: '#3b82f6', cursor: 'pointer', fontSize: '13px' }} onClick={() => setHideRespondents(false)}>
                                                Show {daList.length - 3} more respondents...
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      </div>
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
{activeTab === 'respondents' && (
            <>
              <div className="page-header">
                <div className="page-header-text">
                  <h2>Respondents</h2>
                  <p>View-only register of every complainant-respondent pair. Edit records from the case drawer.</p>
                </div>
                <button className="btn-secondary" onClick={fetchRespondents} disabled={respLoading}>
                  {respLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              <div className="resp-filters">
                <input
                  className="resp-search"
                  placeholder="Search case no, complainant or respondent name / ID..."
                  value={respSearchInput}
                  onChange={(ev) => setRespSearchInput(ev.target.value)}
                />
                <select value={respCountry} onChange={(ev) => { setRespCountry(ev.target.value); setRespPage(1); }}>
                  <option value="">All countries</option>
                  {respUniqueVals.countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={respViolation} onChange={(ev) => { setRespViolation(ev.target.value); setRespPage(1); }}>
                  <option value="">All violations</option>
                  {respUniqueVals.violations.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={respAction} onChange={(ev) => { setRespAction(ev.target.value); setRespPage(1); }}>
                  <option value="">All actions</option>
                  {respUniqueVals.actions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={respStatus} onChange={(ev) => { setRespStatus(ev.target.value); setRespPage(1); }}>
                  <option value="">All case status</option>
                  {respUniqueVals.statuses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="resp-toggle">
                  <input type="checkbox" checked={respRepeatOnly}
                    onChange={(ev) => { setRespRepeatOnly(ev.target.checked); setRespPage(1); }} />
                  Repeat offenders only
                </label>
                <button className="btn-secondary" onClick={() => {
                  setRespSearchInput(''); setRespCountry(''); setRespViolation('');
                  setRespAction(''); setRespStatus(''); setRespRepeatOnly(false); setRespPage(1);
                }}>Clear</button>
              </div>

              <div className="resp-count">
                {respLoading ? 'Loading records...' :
                  `Showing ${respFiltered.length === 0 ? 0 : (respPage - 1) * respPageSize + 1}-${Math.min(respPage * respPageSize, respFiltered.length)} of ${respFiltered.length} records`}
                {respRows.length > 0 && respFiltered.length !== respRows.length ? ` (filtered from ${respRows.length})` : ''}
                <span className="resp-hint">Double-click a row for full details</span>
              </div>

              <div className="resp-table-wrap">
                <table className="resp-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Case No</th>
                      <th>Complainant Name</th>
                      <th>Complainant ID</th>
                      <th>Cust Purchase ID</th>
                      <th>Respondent Name</th>
                      <th>Respondent ID</th>
                      <th>Country</th>
                      <th>Violation Category</th>
                      <th>Current Action</th>
                      <th>Execution Date</th>
                      <th>PIC</th>
                      <th>Team</th>
                      <th>VA Upline</th>
                      <th>Case Status</th>
                      <th>Modified By</th>
                      <th>Last Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {respCurrentPage.map((r) => {
                      const rc = respRepeatCount(r);
                      return (
                        <tr key={r.id} onDoubleClick={() => setRespDetail(r)}>
                          <td>
                            {respMissingInfo(r) ? <span title="Missing complainant or respondent details">⚠️</span> : ''}
                            {rc > 1 ? <span className="resp-badge" title={`Appears in ${rc} cases`}>{rc}</span> : ''}
                          </td>
                          <td>{r.case_number}</td>
                          <td>{r.complainant_name}</td>
                          <td>{r.complainant_id}</td>
                          <td>{r.complainant_cust_id}</td>
                          <td>{r.respondent_name}</td>
                          <td>{r.respondent_id}</td>
                          <td>{r.respondent_country}</td>
                          <td>{r.violation_category}</td>
                          <td>{r.current_action}</td>
                          <td>{r.execution_date}</td>
                          <td>{r.cases ? r.cases.pic : ''}</td>
                          <td>{r.team_name}</td>
                          <td>{r.upline_name}</td>
                          <td>{r.cases ? r.cases.case_status : ''}</td>
                          <td>{r.modified_by_email}</td>
                          <td>{r.last_modified ? formatDateTime(r.last_modified) : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!respLoading && respFiltered.length === 0 ? <div className="resp-empty">No records match your filters.</div> : null}
              </div>

              <div className="resp-pager">
                <button className="btn-secondary" disabled={respPage <= 1} onClick={() => setRespPage(respPage - 1)}>Previous</button>
                <span>Page {respPage} of {respTotalPages}</span>
                <button className="btn-secondary" disabled={respPage >= respTotalPages} onClick={() => setRespPage(respPage + 1)}>Next</button>
              </div>

              {respDetail ? (
                <div className="resp-host">
                  <div className="resp-overlay" onClick={() => setRespDetail(null)}></div>
                  <div className="resp-panel">
                    <div className="resp-topbar">
                      <strong>{respDetail.respondent_name || 'Respondent'} — {respDetail.case_number}</strong>
                      <button className="resp-close" onClick={() => setRespDetail(null)}>✕</button>
                    </div>
                    <div className="resp-panel-body">
                      <div className="resp-grid">
                        <div><span>Case No</span><b>{respDetail.case_number}</b></div>
                        <div><span>NID Case No</span><b>{respDetail.nid_case_no || '—'}</b></div>
                        <div><span>Date Received</span><b>{respDetail.date_received || '—'}</b></div>
                        <div><span>Sent By</span><b>{respDetail.sent_by || '—'}</b></div>
                        <div><span>Complainant</span><b>{respDetail.complainant_name || '—'}</b></div>
                        <div><span>Complainant ID</span><b>{respDetail.complainant_id || '—'}</b></div>
                        <div><span>Cust Purchase ID</span><b>{respDetail.complainant_cust_id || '—'}</b></div>
                        <div><span>Respondent</span><b>{respDetail.respondent_name || '—'}</b></div>
                        <div><span>Respondent ID</span><b>{respDetail.respondent_id || '—'}</b></div>
                        <div><span>Country</span><b>{respDetail.respondent_country || '—'}</b></div>
                        <div><span>Team</span><b>{respDetail.team_name || '—'}</b></div>
                        <div><span>Referrer</span><b>{respDetail.referrer_name || '—'}</b></div>
                        <div><span>Referrer ID</span><b>{respDetail.referrer_id || '—'}</b></div>
                        <div><span>VA Upline</span><b>{respDetail.upline_name || '—'}</b></div>
                        <div><span>VA Upline ID</span><b>{respDetail.upline_id || '—'}</b></div>
                        <div><span>Violation Category</span><b>{respDetail.violation_category || '—'}</b></div>
                        <div><span>Current Action</span><b>{respDetail.current_action || '—'}</b></div>
                        <div><span>Execution Date</span><b>{respDetail.execution_date || '—'}</b></div>
                        <div><span>DA Confirmed</span><b>{respDetail.da_confirmed ? 'Yes' : 'No'}</b></div>
                        <div><span>Modified By</span><b>{respDetail.modified_by_email || '—'}</b></div>
                      </div>

                      <h4 className="resp-h4">Remarks</h4>
                      <div className="resp-note">{respDetail.remarks || 'No remarks recorded.'}</div>

                      <h4 className="resp-h4">Action History</h4>
                      {Array.isArray(respDetail.action_history) && respDetail.action_history.length > 0 ? (
                        <table className="resp-mini">
                          <thead><tr><th>Step</th><th>Action</th><th>Date</th></tr></thead>
                          <tbody>
                            {respDetail.action_history.map((h, i) => (
                              <tr key={i}><td>{h.step}</td><td>{h.action}</td><td>{h.date || '—'}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      ) : <div className="resp-note">No action history recorded.</div>}

                      <h4 className="resp-h4">
                        Repeat Offender Check
                        {respRepeatCount(respDetail) > 1
                          ? <span className="resp-badge-big">Appears in {respRepeatCount(respDetail)} cases</span>
                          : <span className="resp-ok">Only this case</span>}
                      </h4>
                      {respOtherCases(respDetail).length > 0 ? (
                        <>
                          <div className="resp-warn">Review these before treating as a repeat offender — a reactivated case may carry a new case number.</div>
                          <table className="resp-mini">
                            <thead><tr><th>Case No</th><th>Complainant</th><th>Violation</th><th>Action</th><th>Date</th></tr></thead>
                            <tbody>
                              {respOtherCases(respDetail).map((o) => (
                                <tr key={o.id}>
                                  <td>{o.case_number}</td>
                                  <td>{o.complainant_name || '—'}</td>
                                  <td>{o.violation_category || '—'}</td>
                                  <td>{o.current_action || '—'}</td>
                                  <td>{o.execution_date || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      ) : <div className="resp-note">No other cases found for this respondent ID.</div>}
                    </div>
                  </div>
                </div>
              ) : null}
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
                              {activeTab === 'india' && (
            <>
              <div className="page-header">
                <div className="page-header-text">
                  <h2>India Tracker (Staging)</h2>
                  <p>{indiaStaging.length} cases · {indiaDuplicateMap.size} possible duplicates · {indiaNoIdCount} without ID#</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={handleBatchPromote} className="btn-action btn-success" disabled={indiaSelectedCount === 0}>
                    ✓ Add Selected ({indiaSelectedCount})
                  </button>
                  <button onClick={handleBatchDelete} className="btn-action btn-danger" disabled={indiaSelectedCount === 0}>
                    🗑 Delete Selected ({indiaSelectedCount})
                  </button>
                  <button onClick={handleBulkDeleteNoId} className="btn-action btn-warning" disabled={indiaNoIdCount === 0}>
                    🗑 Delete {indiaNoIdCount} No ID
                  </button>
                </div>
              </div>

              <div className="table-container">
                <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="text" placeholder="Search case #, person, ID..." value={indiaSearch} onChange={(e) => { setIndiaSearch(e.target.value); setIndiaPage(1); }} style={{ flex: 1, minWidth: '200px', padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#334155' }} />
                  <select value={indiaMatchFilter} onChange={(e) => setIndiaMatchFilter(e.target.value)} style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', color: '#334155' }}>
                    <option value="">All Cases</option>
                    <option value="matched">⚠ Possible Duplicates Only</option>
                    <option value="unmatched">No Match Found</option>
                  </select>
                </div>

                <table className="table">
                  <thead>
                  <tr>
                      <th style={{ width: '30px' }}>
                        <input type="checkbox" checked={indiaFiltered.length > 0 && indiaFiltered.every(c => indiaSelectedCases[c.case_number])} onChange={handleSelectAllIndia} />
                      </th>
                      <th onClick={() => requestIndiaSort('case_number')} style={{ cursor: 'pointer' }}>Case Number {indiaSortConfig.key === 'case_number' ? (indiaSortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}</th>
                      <th onClick={() => requestIndiaSort('role')} style={{ cursor: 'pointer' }}>Role {indiaSortConfig.key === 'role' ? (indiaSortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}</th>
                      <th onClick={() => requestIndiaSort('person_name')} style={{ cursor: 'pointer' }}>Person {indiaSortConfig.key === 'person_name' ? (indiaSortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}</th>
                      <th onClick={() => requestIndiaSort('person_id')} style={{ cursor: 'pointer' }}>ID# {indiaSortConfig.key === 'person_id' ? (indiaSortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}</th>
                      <th onClick={() => requestIndiaSort('case_status')} style={{ cursor: 'pointer' }}>Status {indiaSortConfig.key === 'case_status' ? (indiaSortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}</th>
                      <th>Notice Type</th>
                      <th onClick={() => requestIndiaSort('pic')} style={{ cursor: 'pointer' }}>PIC {indiaSortConfig.key === 'pic' ? (indiaSortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}</th>
                      <th onClick={() => requestIndiaSort('created_on')} style={{ cursor: 'pointer' }}>Created {indiaSortConfig.key === 'created_on' ? (indiaSortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}</th>
                      <th>Possible Match</th>
                      <th style={{ width: '100px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                  {indiaCurrentPage.length === 0 ? (
                      <tr><td colSpan="11" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                        {indiaStaging.length === 0 ? '🎉 India tab is empty — all cases reviewed!' : 'No cases match your filter.'}
                      </td></tr>
                    ) : (
                      indiaCurrentPage.map(c => {
                        const da = (c.disciplinary_actions || [])[0] || {};
                        const isRespondent = da.respondent_name || da.respondent_id;
                        const personName = isRespondent ? da.respondent_name : da.complainant_name;
                        const personId = isRespondent ? da.respondent_id : da.complainant_id;
                        const fullCustomer = personId ? `IR:${personId} ${personName || ''}` : (personName || '—');
                        const noticeType = (c.remarks || '').replace(/^\[|\]$/g, '');
                        const matchCaseNum = indiaDuplicateMap.get(c.case_number);
                        const matchCaseData = matchCaseNum ? cases.find(x => x.case_number === matchCaseNum) : null;
                        return (
                          <tr key={c.case_number} style={indiaSelectedCases[c.case_number] ? { backgroundColor: '#f0fdf4' } : {}}>
                            <td><input type="checkbox" checked={!!indiaSelectedCases[c.case_number]} onChange={() => handleToggleIndiaCase(c.case_number)} /></td>
                            <td style={{ fontWeight: 600, color: '#0f172a' }}>{c.case_number}</td>
                            <td>{isRespondent ? <span className="badge badge-red">Respondent</span> : <span className="badge badge-blue">Complainant</span>}</td>
                            <td style={{ fontWeight: 500, fontSize: '12px' }}>{fullCustomer}</td>
                            <td style={{ fontSize: '11px', color: '#64748b' }}>{personId || 'no ID'}</td>
                            <td><span className={`badge ${c.case_status === 'IN PROGRESS' ? 'badge-blue' : c.case_status === 'CANCELLED' ? 'badge-grey' : c.case_status === 'COMPLETED' ? 'badge-green' : 'badge-yellow'}`}>{c.case_status}</span></td>
                            <td style={{ fontSize: '11px' }}>{noticeType || '—'}</td>
                            <td style={{ fontSize: '11px' }}>{c.pic || '—'}</td>
                            <td style={{ fontSize: '11px' }}>{c.created_on || '—'}</td>
                            <td>
                              {matchCaseNum ? (
                                <div>
                                  <span className="badge badge-red">⚠ {matchCaseNum}</span>
                                  {matchCaseData && (
                                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                      {matchCaseData.case_status} | {matchCaseData.pic || '—'}
                                    </div>
                                  )}
                                </div>
                              ) : (<span style={{ color: '#94a3b8' }}>—</span>)}
                            </td>
                            <td>
                              <button onClick={() => handlePromoteCase(c.case_number)} className="btn-action btn-success">✓</button>
                              <button onClick={() => handleDeleteStagingCase(c.case_number)} className="btn-action btn-danger">🗑</button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                <div className="pagination">
                  <button onClick={() => setIndiaPage(prev => Math.max(1, prev - 1))} disabled={indiaPage === 1} className="btn-page">← Previous</button>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>
                    Page {indiaPage} of {indiaTotalPages || 1} · {indiaSorted.length} cases
                    {indiaSelectedCount > 0 && <span style={{ color: '#059669', fontWeight: 600 }}> · {indiaSelectedCount} selected (all pages)</span>}
                  </span>
                  <button onClick={() => setIndiaPage(prev => Math.min(indiaTotalPages, prev + 1))} disabled={indiaPage === indiaTotalPages || indiaTotalPages === 0} className="btn-page">Next →</button>
                </div>
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