// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';

const supabaseUrl = 'https://yymvagbwxdaxrldrhmtm.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bXZhZ2J3eGRheHJsZHJobXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTEyMjcsImV4cCI6MjEwMjI2NzIyN30.W6WFGXzR7gMU0ln-vfMIJlsxwctWqnCv5Cb7qW8UXXY';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  const [selectedCase, setSelectedCase] = useState(null);
  const [daList, setDaList] = useState([]);

  const fetchCases = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cases')
      .select('*, disciplinary_actions(count)')
      .order('sla_due_date', { ascending: true });
    if (error) console.error('Error fetching cases:', error);
    else setCases(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const formatDateString = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const cleanStr = dateStr.replace(/-/g, '/');
    const parts = cleanStr.split('/');
    if (parts.length === 3) {
      let [p1, p2, p3] = parts.map((p) => parseInt(p, 10));
      if (p3 < 100) p3 = 2000 + p3;
      let dateObj = new Date(p3, p2 - 1, p1);
      if (p2 > 12 && p1 <= 12) dateObj = new Date(p3, p1 - 1, p2);
      if (!isNaN(dateObj.getTime())) {
        return `${dateObj.getFullYear()}-${String(
          dateObj.getMonth() + 1
        ).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      }
    }
    const fallbackDate = new Date(dateStr);
    if (!isNaN(fallbackDate.getTime()))
      return fallbackDate.toISOString().split('T')[0];
    return null;
  };

  const chunkArray = (array, size) => {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  };

  const cleanVal = (val) => {
    if (val === undefined || val === null) return null;
    const str = String(val).trim();
    return str === '' ? null : str;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadMessage('1/4 Reading file...');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          setUploadMessage('2/4 Formatting & sanitizing data...');
          const rawData = results.data;

          let daDataToInsert = rawData
            .map((row) => {
              const getVal = (searchStrings) => {
                for (let key in row) {
                  const cleanKey = key.trim().toLowerCase();
                  for (let search of searchStrings) {
                    if (cleanKey === search.toLowerCase()) return row[key];
                  }
                }
                return null;
              };

              const caseNum = cleanVal(getVal(['CXN No']));
              const respId = cleanVal(getVal(["Respondents' IR ID No"]));

              const rawExecDate = cleanVal(getVal(['Date of execution 1']));
              const execDate = formatDateString(rawExecDate);

              let actionDays = null;
              if (execDate) {
                const today = new Date();
                const exec = new Date(execDate);
                if (!isNaN(exec.getTime()))
                  actionDays = Math.floor(
                    (today - exec) / (1000 * 60 * 60 * 24)
                  );
              }

              return {
                case_number: caseNum,
                complainant_name: cleanVal(
                  getVal(["Complainant's Name and IR ID No"])
                ),
                respondent_name: cleanVal(getVal(["Respondent's Name"])),
                respondent_id: respId,
                current_action: cleanVal(getVal(['Action Taken 1'])),
                execution_date: execDate,
                remarks: cleanVal(getVal(['Remarks'])),
                action_days: actionDays,
                unique_key: caseNum && respId ? `${caseNum}|${respId}` : null,
              };
            })
            .filter((item) => item.case_number && item.unique_key);

          const uniqueMap = new Map();
          daDataToInsert.forEach((item) =>
            uniqueMap.set(item.unique_key, item)
          );
          const finalDataToInsert = Array.from(uniqueMap.values());

          if (finalDataToInsert.length === 0) {
            setUploadMessage('❌ Error: Found 0 valid rows.');
            setUploading(false);
            return;
          }

          setUploadMessage('3/4 Fetching existing cases...');

          const { data: existingCases, error: fetchErr } = await supabase
            .from('cases')
            .select('case_number');
          if (fetchErr) throw new Error(fetchErr.message);

          const existingSet = new Set(existingCases.map((c) => c.case_number));

          const uniqueCaseNumbers = [
            ...new Set(finalDataToInsert.map((item) => item.case_number)),
          ];

          const missingCases = uniqueCaseNumbers
            .filter((cn) => !existingSet.has(cn))
            .map((cn) => {
              const today = new Date();
              const slaDate = new Date(today.setDate(today.getDate() + 30))
                .toISOString()
                .split('T')[0];
              return {
                case_number: cn,
                case_status: 'IN PROGRESS',
                sla_due_date: slaDate,
                created_on: new Date().toISOString().split('T')[0],
                priority: 'Medium',
                stage: 'Stage 1',
              };
            });

          if (missingCases.length > 0) {
            const missingChunks = chunkArray(missingCases, 100);
            for (let chunk of missingChunks) {
              const { error: insertErr } = await supabase
                .from('cases')
                .insert(chunk);
              if (insertErr) {
                setUploadMessage(
                  `❌ CRITICAL ERROR creating cases: ${insertErr.message}`
                );
                setUploading(false);
                return;
              }
            }
          }

          setUploadMessage('4/4 Uploading respondents (batch mode)...');

          const daChunks = chunkArray(finalDataToInsert, 100);
          let errorCount = 0;
          let firstError = null;

          for (let chunk of daChunks) {
            const { error } = await supabase
              .from('disciplinary_actions')
              .upsert(chunk, { onConflict: 'unique_key' });

            if (error) {
              errorCount++;
              if (!firstError) firstError = error.message;
            }
          }

          if (errorCount > 0) {
            setUploadMessage(
              `⚠️ Completed with ${errorCount} chunk errors. First error: ${firstError}`
            );
          } else {
            setUploadMessage(
              `✅ Success! Processed ${finalDataToInsert.length} actions & auto-created ${missingCases.length} missing cases.`
            );
          }
          fetchCases();
          setUploading(false);
        } catch (err) {
          setUploadMessage(`❌ Unexpected Error: ${err.message}`);
          setUploading(false);
        }
      },
      error: (err) => {
        setUploadMessage(`❌ File Read Error: ${err.message}`);
        setUploading(false);
      },
    });
  };

  const handleCaseClick = async (caseNum) => {
    if (selectedCase === caseNum) {
      setSelectedCase(null);
      return;
    }
    setSelectedCase(caseNum);
    const { data: daData } = await supabase
      .from('disciplinary_actions')
      .select('*')
      .eq('case_number', caseNum);
    setDaList(daData || []);
  };

  const calculateSlaDays = (dueDate) => {
    if (!dueDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((new Date(dueDate) - today) / (1000 * 60 * 60 * 24));
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const totalCases = cases.length;
  const inProgress = cases.filter(
    (c) => c.case_status === 'IN PROGRESS'
  ).length;
  const completed = cases.filter((c) => c.case_status === 'COMPLETED').length;
  const outOfSla = cases.filter(
    (c) =>
      calculateSlaDays(c.sla_due_date) < 0 && c.case_status === 'IN PROGRESS'
  ).length;

  return (
    <div
      style={{
        padding: '24px',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#f3f4f6',
        minHeight: '100vh',
      }}
    >
      <h1 style={{ color: '#1f2937', marginBottom: '20px' }}>
        📊 SLA TRACKER DASHBOARD
      </h1>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '30px' }}>
        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            flex: 1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <h3 style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            TOTAL CASES
          </h3>
          <p
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              margin: '5px 0 0 0',
            }}
          >
            {totalCases}
          </p>
        </div>
        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            flex: 1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <h3 style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            IN PROGRESS
          </h3>
          <p
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              margin: '5px 0 0 0',
              color: '#f59e0b',
            }}
          >
            {inProgress}
          </p>
        </div>
        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            flex: 1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <h3 style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            COMPLETED
          </h3>
          <p
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              margin: '5px 0 0 0',
              color: '#10b981',
            }}
          >
            {completed}
          </p>
        </div>
        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            flex: 1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <h3 style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            OUT OF SLA
          </h3>
          <p
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              margin: '5px 0 0 0',
              color: '#ef4444',
            }}
          >
            {outOfSla}
          </p>
        </div>
      </div>

      <div
        style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '30px',
        }}
      >
        <h2 style={{ marginTop: 0, color: '#1f2937' }}>
          📤 Upload Raw Data (D365 Export)
        </h2>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Upload your raw CSV export. The system will auto-create missing cases,
          calculate Action Days, and prevent duplicates.
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={uploading}
          style={{ marginBottom: '10px' }}
        />
        {uploadMessage && (
          <p
            style={{
              fontWeight: 'bold',
              color:
                uploadMessage.includes('Error') ||
                uploadMessage.includes('errors')
                  ? '#ef4444'
                  : '#10b981',
            }}
          >
            {uploadMessage}
          </p>
        )}
      </div>

      <div
        style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <h2 style={{ marginTop: 0, color: '#1f2937' }}>📋 SLA Case Tracker</h2>

        {loading ? (
          <p>Loading data...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '2px solid #e5e7eb',
                    backgroundColor: '#f9fafb',
                  }}
                >
                  <th style={{ padding: '12px' }}>Case Number</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px' }}>SLA Status</th>
                  <th style={{ padding: '12px' }}># Resp</th>
                  <th style={{ padding: '12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c, index) => {
                  const slaDays = calculateSlaDays(c.sla_due_date);
                  const respondentCount =
                    c.disciplinary_actions?.[0]?.count || 0;
                  return (
                    <React.Fragment key={index}>
                      <tr
                        style={{
                          borderBottom:
                            selectedCase === c.case_number
                              ? 'none'
                              : '1px solid #e5e7eb',
                          cursor: 'pointer',
                          backgroundColor:
                            selectedCase === c.case_number
                              ? '#eff6ff'
                              : 'white',
                        }}
                      >
                        <td
                          style={{
                            padding: '12px',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.case_number}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              backgroundColor:
                                c.case_status === 'IN PROGRESS'
                                  ? '#fef3c7'
                                  : '#d1fae5',
                              color:
                                c.case_status === 'IN PROGRESS'
                                  ? '#92400e'
                                  : '#065f46',
                            }}
                          >
                            {c.case_status}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            fontWeight: 'bold',
                            color: slaDays < 0 ? '#ef4444' : '#10b981',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.case_status !== 'IN PROGRESS'
                            ? '—'
                            : slaDays < 0
                            ? `🔴 ${Math.abs(slaDays)}d`
                            : `🟢 ${slaDays}d`}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            color: respondentCount > 0 ? '#3b82f6' : '#d1d5db',
                          }}
                        >
                          {respondentCount}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <button
                            onClick={() => handleCaseClick(c.case_number)}
                            style={{
                              backgroundColor: '#6b7280',
                              color: 'white',
                              padding: '6px 12px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            {selectedCase === c.case_number ? 'Hide' : 'Expand'}
                          </button>
                        </td>
                      </tr>

                      {selectedCase === c.case_number && (
                        <tr>
                          <td
                            colSpan="5"
                            style={{
                              padding: '20px',
                              backgroundColor: '#f9fafb',
                              borderBottom: '1px solid #e5e7eb',
                            }}
                          >
                            <div
                              style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '15px',
                                backgroundColor: 'white',
                              }}
                            >
                              <h3 style={{ marginTop: 0, color: '#1f2937' }}>
                                ⚖️ Disciplinary Actions (Respondents)
                              </h3>
                              {daList.length === 0 ? (
                                <p
                                  style={{
                                    color: '#6b7280',
                                    fontStyle: 'italic',
                                  }}
                                >
                                  No respondents linked.
                                </p>
                              ) : (
                                <table
                                  style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    textAlign: 'left',
                                  }}
                                >
                                  <thead>
                                    <tr
                                      style={{
                                        borderBottom: '2px solid #e5e7eb',
                                      }}
                                    >
                                      <th style={{ padding: '8px' }}>Name</th>
                                      <th style={{ padding: '8px' }}>Action</th>
                                      <th style={{ padding: '8px' }}>Days</th>
                                      <th style={{ padding: '8px' }}>
                                        Remarks
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {daList.map((da, i) => (
                                      <tr
                                        key={i}
                                        style={{
                                          borderBottom: '1px solid #f3f4f6',
                                        }}
                                      >
                                        <td style={{ padding: '8px' }}>
                                          {da.respondent_name}
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                          <span
                                            style={{
                                              fontWeight: 'bold',
                                              color:
                                                da.current_action ===
                                                'Terminated'
                                                  ? '#ef4444'
                                                  : da.current_action ===
                                                    'Suspended'
                                                  ? '#f59e0b'
                                                  : '#10b981',
                                            }}
                                          >
                                            {da.current_action}
                                          </span>
                                        </td>
                                        <td
                                          style={{
                                            padding: '8px',
                                            fontWeight: 'bold',
                                          }}
                                        >
                                          {da.action_days
                                            ? `${da.action_days}d`
                                            : '—'}
                                        </td>
                                        <td
                                          style={{
                                            padding: '8px',
                                            fontSize: '12px',
                                            color: '#6b7280',
                                          }}
                                        >
                                          {da.remarks || '—'}
                                        </td>
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
        )}
      </div>
    </div>
  );
}
