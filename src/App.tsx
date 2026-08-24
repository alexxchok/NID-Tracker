// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';

const supabaseUrl = 'https://yymvagbwxdaxrldrhmtm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bXZhZ2J3eGRheHJsZHJobXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTEyMjcsImV4cCI6MjEwMjI2NzIyN30.W6WFGXzR7gMU0ln-vfMIJlsxwctWqnCv5Cb7qW8UXXY';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#1f2937' }}>🔐 SLA Tracker Login</h2>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#4b5563' }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#4b5563' }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }} />
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '15px' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%', backgroundColor: '#3b82f6', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ userEmail, onSignOut }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [uploadingDA, setUploadingDA] = useState(false);
  const [uploadMessageDA, setUploadMessageDA] = useState('');

  // NEW: SLA Tracker Upload State
  const [uploadingSLA, setUploadingSLA] = useState(false);
  const [uploadMessageSLA, setUploadMessageSLA] = useState('');

  const [selectedCase, setSelectedCase] = useState(null);
  const [daList, setDaList] = useState([]);

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

  useEffect(() => { fetchCases(); }, []);

  const formatDateString = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const cleanStr = dateStr.replace(/-/g, '/');
    const parts = cleanStr.split('/');
    if (parts.length === 3) {
      let [p1, p2, p3] = parts.map(p => parseInt(p, 10));
      if (p3 < 100) p3 = 2000 + p3;
      let dateObj = new Date(p3, p2 - 1, p1);
      if (p2 > 12 && p1 <= 12) dateObj = new Date(p3, p1 - 1, p2);
      if (!isNaN(dateObj.getTime())) {
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      }
    }
    const fallbackDate = new Date(dateStr);
    if (!isNaN(fallbackDate.getTime())) return fallbackDate.toISOString().split('T')[0];
    return null;
  };

  const chunkArray = (array, size) => {
    const result = [];
    for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
    return result;
  };

  const cleanVal = (val) => {
    if (val === undefined || val === null) return null;
    const str = String(val).trim();
    return str === '' ? null : str;
  };

  // --- DA Uploader (Same as before) ---
  const handleFileUploadDA = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingDA(true);
    setUploadMessageDA('1/4 Reading file...');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          setUploadMessageDA('2/4 Formatting & sanitizing data...');
          const rawData = results.data;
          let daDataToInsert = rawData.map(row => {
            const getVal = (searchStrings) => {
              for (let key in row) {
                const cleanKey = key.trim().toLowerCase();
                for (let search of searchStrings) {
                  if (cleanKey === search.toLowerCase()) return row[key];
                }
              }
              return null;
            };
            const caseNum = cleanVal(getVal(["CXN No"]));
            const respId = cleanVal(getVal(["Respondents' IR ID No"])); 
            const rawExecDate = cleanVal(getVal(["Date of execution 1"])); 
            const execDate = formatDateString(rawExecDate);
            let actionDays = null;
            if (execDate) {
              const today = new Date();
              const exec = new Date(execDate);
              if (!isNaN(exec.getTime())) actionDays = Math.floor((today - exec) / (1000 * 60 * 60 * 24));
            }
            return {
              case_number: caseNum,
              complainant_name: cleanVal(getVal(["Complainant's Name and IR ID No"])),
              respondent_name: cleanVal(getVal(["Respondent's Name"])),
              respondent_id: respId,
              current_action: cleanVal(getVal(["Action Taken 1"])), 
              execution_date: execDate,
              remarks: cleanVal(getVal(["Remarks"])),
              action_days: actionDays,
              unique_key: caseNum && respId ? `${caseNum}|${respId}` : null
            };
          }).filter(item => item.case_number && item.unique_key); 

          const uniqueMap = new Map();
          daDataToInsert.forEach(item => uniqueMap.set(item.unique_key, item));
          const finalDataToInsert = Array.from(uniqueMap.values());

          if (finalDataToInsert.length === 0) {
            setUploadMessageDA('❌ Error: Found 0 valid rows.');
            setUploadingDA(false);
            return;
          }

          setUploadMessageDA('3/4 Fetching existing cases...');
          const { data: existingCases, error: fetchErr } = await supabase.from('cases').select('case_number');
          if (fetchErr) throw new Error(fetchErr.message);
          const existingSet = new Set(existingCases.map(c => c.case_number));
          const uniqueCaseNumbers = [...new Set(finalDataToInsert.map(item => item.case_number))];
          const missingCases = uniqueCaseNumbers.filter(cn => !existingSet.has(cn)).map(cn => {
            const today = new Date();
            const slaDate = new Date(today.setDate(today.getDate() + 30)).toISOString().split('T')[0];
            return { case_number: cn, case_status: 'IN PROGRESS', sla_due_date: slaDate, created_on: new Date().toISOString().split('T')[0], priority: 'Medium', stage: 'Stage 1' };
          });

          if (missingCases.length > 0) {
            const missingChunks = chunkArray(missingCases, 100);
            for (let chunk of missingChunks) {
              const { error: insertErr } = await supabase.from('cases').insert(chunk);
              if (insertErr) {
                setUploadMessageDA(`❌ CRITICAL ERROR creating cases: ${insertErr.message}`);
                setUploadingDA(false);
                return;
              }
            }
          }

          setUploadMessageDA('4/4 Uploading respondents (batch mode)...');
          const daChunks = chunkArray(finalDataToInsert, 100);
          let errorCount = 0;
          let firstError = null;
          for (let chunk of daChunks) {
            const { error } = await supabase.from('disciplinary_actions').upsert(chunk, { onConflict: 'unique_key' });
            if (error) {
              errorCount++;
              if (!firstError) firstError = error.message;
            }
          }

          if (errorCount > 0) setUploadMessageDA(`⚠️ Completed with ${errorCount} chunk errors. First error: ${firstError}`);
          else setUploadMessageDA(`✅ Success! Processed ${finalDataToInsert.length} actions & auto-created ${missingCases.length} missing cases.`);
          fetchCases(); 
          setUploadingDA(false);
        } catch (err) {
          setUploadMessageDA(`❌ Unexpected Error: ${err.message}`);
          setUploadingDA(false);
        }
      },
      error: (err) => {
        setUploadMessageDA(`❌ File Read Error: ${err.message}`);
        setUploadingDA(false);
      }
    });
  };

  // --- NEW: SLA Tracker Uploader ---
  const handleFileUploadSLA = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingSLA(true);
    setUploadMessageSLA('1/3 Reading file...');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          setUploadMessageSLA('2/3 Formatting data...');
          const rawData = results.data;
          
          let casesToUpsert = rawData.map(row => {
            const getVal = (searchStrings) => {
              for (let key in row) {
                const cleanKey = key.trim().toLowerCase();
                for (let search of searchStrings) {
                  if (cleanKey === search.toLowerCase()) return row[key];
                }
              }
              return null;
            };

            const caseNum = cleanVal(getVal(["CASE NUMBER", "Case Number", "CXN No"]));
            if (!caseNum) return null;

            return {
              case_number: caseNum,
              created_on: formatDateString(cleanVal(getVal(["CREATED ON", "Created On"]))),
              sla_due_date: formatDateString(cleanVal(getVal(["CASE DUE DATE / SLA DATE", "SLA Date", "Due Date"]))),
              country: cleanVal(getVal(["COUNTRY", "Country"])),
              pic: cleanVal(getVal(["PIC"])),
              priority: cleanVal(getVal(["PRIORITY", "Priority"])),
              case_status: cleanVal(getVal(["CASE STATUS", "Status"])) || 'IN PROGRESS',
              stage: cleanVal(getVal(["STAGE OF CASE", "Stage"])),
              date_completed: formatDateString(cleanVal(getVal(["DATE COMPLETED / CANCELLED", "Date Completed"]))),
              remarks: cleanVal(getVal(["REMARKS", "Remarks"]))
            };
          }).filter(item => item && item.case_number); 

          if (casesToUpsert.length === 0) {
            setUploadMessageSLA('❌ Error: Found 0 valid rows. Check column headers.');
            setUploadingSLA(false);
            return;
          }

          setUploadMessageSLA(`3/3 Updating ${casesToUpsert.length} cases in database...`);
          
          const chunks = chunkArray(casesToUpsert, 100);
          let errorCount = 0;
          let firstError = null;

          for (let chunk of chunks) {
            const { error } = await supabase.from('cases').upsert(chunk, { onConflict: 'case_number' });
            if (error) {
              errorCount++;
              if (!firstError) firstError = error.message;
            }
          }

          if (errorCount > 0) {
            setUploadMessageSLA(`⚠️ Completed with ${errorCount} chunk errors. First error: ${firstError}`);
          } else {
            setUploadMessageSLA(`✅ Success! Updated ${casesToUpsert.length} SLA cases.`);
          }
          fetchCases(); 
          setUploadingSLA(false);
        } catch (err) {
          setUploadMessageSLA(`❌ Unexpected Error: ${err.message}`);
          setUploadingSLA(false);
        }
      },
      error: (err) => {
        setUploadMessageSLA(`❌ File Read Error: ${err.message}`);
        setUploadingSLA(false);
      }
    });
  };

  const handleCaseClick = async (caseNum) => {
    if (selectedCase === caseNum) { setSelectedCase(null); return; }
    setSelectedCase(caseNum);
    const { data: daData } = await supabase.from('disciplinary_actions').select('*').eq('case_number', caseNum);
    setDaList(daData || []);
  };

  const handleUpdateStatus = async (caseNum, newStatus) => {
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
    const matchRespondent = c.disciplinary_actions?.some(da => 
      da.respondent_name?.toLowerCase().includes(search) || 
      da.respondent_id?.toLowerCase().includes(search)
    );
    return matchCase || matchPic || matchCountry || matchRespondent;
  });

  const totalPages = Math.ceil(filteredCases.length / pageSize);
  const currentCases = filteredCases.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalCases = cases.length;
  const inProgress = cases.filter(c => c.case_status === 'IN PROGRESS').length;
  const completed = cases.filter(c => c.case_status === 'COMPLETED').length;
  const outOfSla = cases.filter(c => calculateSlaDays(c.sla_due_date) < 0 && c.case_status === 'IN PROGRESS').length;

  return (
    <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif', backgroundColor: '#f3f4f6', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#1f2937', margin: 0 }}>📊 SLA TRACKER DASHBOARD</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '14px', color: '#4b5563' }}>👤 {userEmail}</span>
          <button onClick={onSignOut} style={{ backgroundColor: '#ef4444', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>Logout</button>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '16px', marginBottom: '30px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', flex: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}><h3 style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>TOTAL CASES</h3><p style={{ fontSize: '28px', fontWeight: 'bold', margin: '5px 0 0 0' }}>{totalCases}</p></div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', flex: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}><h3 style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>IN PROGRESS</h3><p style={{ fontSize: '28px', fontWeight: 'bold', margin: '5px 0 0 0', color: '#f59e0b' }}>{inProgress}</p></div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', flex: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}><h3 style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>COMPLETED</h3><p style={{ fontSize: '28px', fontWeight: 'bold', margin: '5px 0 0 0', color: '#10b981' }}>{completed}</p></div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', flex: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}><h3 style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>OUT OF SLA</h3><p style={{ fontSize: '28px', fontWeight: 'bold', margin: '5px 0 0 0', color: '#ef4444' }}>{outOfSla}</p></div>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        {/* DA Uploader */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flex: 1 }}>
          <h2 style={{ marginTop: 0, color: '#1f2937', fontSize: '18px' }}>📤 Upload Disciplinary Actions (D365)</h2>
          <p style={{ color: '#6b7280', fontSize: '13px' }}>Uploads respondents & auto-creates missing cases.</p>
          <input type="file" accept=".csv" onChange={handleFileUploadDA} disabled={uploadingDA} style={{ marginBottom: '10px', fontSize: '12px' }} />
          {uploadMessageDA && <p style={{ fontWeight: 'bold', fontSize: '12px', color: uploadMessageDA.includes('Error') || uploadMessageDA.includes('errors') ? '#ef4444' : '#10b981' }}>{uploadMessageDA}</p>}
        </div>

        {/* NEW: SLA Tracker Uploader */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flex: 1 }}>
          <h2 style={{ marginTop: 0, color: '#1f2937', fontSize: '18px' }}>📋 Upload SLA Tracker (Main Cases)</h2>
          <p style={{ color: '#6b7280', fontSize: '13px' }}>Updates PICs, SLA Dates, Priorities & Stages.</p>
          <input type="file" accept=".csv" onChange={handleFileUploadSLA} disabled={uploadingSLA} style={{ marginBottom: '10px', fontSize: '12px' }} />
          {uploadMessageSLA && <p style={{ fontWeight: 'bold', fontSize: '12px', color: uploadMessageSLA.includes('Error') || uploadMessageSLA.includes('errors') ? '#ef4444' : '#10b981' }}>{uploadMessageSLA}</p>}
        </div>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginTop: 0, color: '#1f2937' }}>📋 SLA Case Tracker</h2>
        
        <input 
          type="text" 
          placeholder="Search by Case#, PIC, Country, Respondent Name, or ID..." 
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          style={{ width: '100%', padding: '10px', marginBottom: '20px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
        />
        
        {loading ? <p>Loading data...</p> : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '12px' }}>Case Number</th><th style={{ padding: '12px' }}>PIC</th><th style={{ padding: '12px' }}>Priority</th><th style={{ padding: '12px' }}>Status</th><th style={{ padding: '12px' }}>Stage</th><th style={{ padding: '12px' }}>SLA Due</th><th style={{ padding: '12px' }}>SLA Status</th><th style={{ padding: '12px' }}># Resp</th><th style={{ padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentCases.map((c, index) => {
                    const slaDays = calculateSlaDays(c.sla_due_date);
                    const respondentCount = c.disciplinary_actions?.length || 0;
                    return (
                      <React.Fragment key={index}>
                        <tr style={{ borderBottom: selectedCase === c.case_number ? 'none' : '1px solid #e5e7eb', cursor: 'pointer', backgroundColor: selectedCase === c.case_number ? '#eff6ff' : 'white' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{c.case_number}</td>
                          <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{c.pic || '—'}</td>
                          <td style={{ padding: '12px', fontWeight: 'bold', color: c.priority === 'High' ? '#ef4444' : c.priority === 'Medium' ? '#f59e0b' : '#6b7280' }}>{c.priority || '—'}</td>
                          <td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: c.case_status === 'IN PROGRESS' ? '#fef3c7' : '#d1fae5', color: c.case_status === 'IN PROGRESS' ? '#92400e' : '#065f46' }}>{c.case_status}</span></td>
                          <td style={{ padding: '12px' }}>{c.stage || '—'}</td>
                          <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{c.sla_due_date}</td>
                          <td style={{ padding: '12px', fontWeight: 'bold', color: slaDays < 0 ? '#ef4444' : '#10b981', whiteSpace: 'nowrap' }}>{c.case_status !== 'IN PROGRESS' ? '—' : slaDays < 0 ? `🔴 ${Math.abs(slaDays)}d` : `🟢 ${slaDays}d`}</td>
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: respondentCount > 0 ? '#3b82f6' : '#d1d5db' }}>{respondentCount}</td>
                          <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                            <button onClick={() => handleCaseClick(c.case_number)} style={{ backgroundColor: '#6b7280', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>{selectedCase === c.case_number ? 'Hide' : 'Expand'}</button>
                            {c.case_status === 'IN PROGRESS' && <button onClick={() => handleUpdateStatus(c.case_number, 'COMPLETED')} style={{ backgroundColor: '#10b981', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✓</button>}
                          </td>
                        </tr>
                        
                        {selectedCase === c.case_number && (
                          <tr>
                            <td colSpan="9" style={{ padding: '20px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '15px', backgroundColor: 'white' }}>
                                <h3 style={{ marginTop: 0, color: '#1f2937' }}>⚖️ Disciplinary Actions (Respondents)</h3>
                                {daList.length === 0 ? <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No respondents linked.</p> : (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead><tr style={{ borderBottom: '2px solid #e5e7eb' }}><th style={{ padding: '8px' }}>Name</th><th style={{ padding: '8px' }}>Action</th><th style={{ padding: '8px' }}>Days</th><th style={{ padding: '8px' }}>Remarks</th></tr></thead>
                                    <tbody>
                                      {daList.map((da, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                          <td style={{ padding: '8px' }}>{da.respondent_name}</td>
                                          <td style={{ padding: '8px' }}><span style={{ fontWeight: 'bold', color: da.current_action === 'Terminated' ? '#ef4444' : da.current_action === 'Suspended' ? '#f59e0b' : '#10b981' }}>{da.current_action}</span></td>
                                          <td style={{ padding: '8px', fontWeight: 'bold' }}>{da.action_days ? `${da.action_days}d` : '—'}</td>
                                          <td style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>{da.remarks || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                disabled={currentPage === 1}
                style={{ backgroundColor: '#3b82f6', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                ← Previous
              </button>
              <span style={{ color: '#4b5563' }}>
                Page {currentPage} of {totalPages || 1} ({filteredCases.length} cases)
              </span>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                disabled={currentPage === totalPages || totalPages === 0}
                style={{ backgroundColor: '#3b82f6', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', opacity: (currentPage === totalPages || totalPages === 0) ? 0.5 : 1 }}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}