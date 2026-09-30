// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { downloadCaseSummaryWord } from './caseSummaryWord';

/* =========================================================
   CASE SUMMARY  —  multi-summary version (v2)
   - List of summaries per case (#1, #2, ...)
   - New summary: Start blank OR Copy from an existing one
   - Respondent picker from Disciplinary Actions
   - ACTIONS TAKEN built from DA action history
   - Screenshots (📎) and PDF = coming in next steps
   ========================================================= */

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 24 },
  panel: { background: '#fff', color: '#111', width: '100%', maxWidth: 980, borderRadius: 10, boxShadow: '0 10px 40px rgba(0,0,0,0.3)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff', zIndex: 2, borderRadius: '10px 10px 0 0', gap: 10, flexWrap: 'wrap' },
  body: { padding: 18 },
  section: { border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 14 },
  secHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, color: '#4c1d95', marginBottom: 10, fontSize: 14 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 },
  label: { fontSize: 12, color: '#555', display: 'block', marginBottom: 3 },
  input: { width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', background: '#fff', color: '#111' },
  inputRO: { background: '#f3f4f6', color: '#333' },
  btn: { padding: '7px 14px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', color: '#111', cursor: 'pointer', fontSize: 13 },
  btnPrimary: { padding: '7px 14px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnDanger: { padding: '4px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#b91c1c', cursor: 'pointer', fontSize: 12 },
  btnDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '6px 8px', background: '#f5f3ff', borderBottom: '1px solid #ddd', fontWeight: 600 },
  td: { padding: '6px 8px', borderBottom: '1px solid #eee', verticalAlign: 'top' },
  note: { fontSize: 12, color: '#666' },
  banner: { padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 },
};

const CHECKLIST = [
  ['complaint_form', 'Complaint Form'],
  ['selfie', 'Selfie holding ID'],
  ['evidence', 'Evidence'],
  ['verification_call', 'Verification Call'],
  ['consent', 'Consent to disclose name'],
];

/* ---------- helpers ---------- */
function picMatches(email, pic) {
  if (!email || !pic) return false;
  const local = String(email).split('@')[0].toLowerCase();
  const tokens = local.split(/[._\-\d]+/).filter((t) => t.length > 1);
  if (!tokens.length) return false;
  const p = String(pic).toLowerCase();
  return tokens.every((t) => p.includes(t));
}

function fmtDate(v) {
  if (!v) return '';
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function fmtDateTime(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function sortKey(v) {
  const s = String(v || '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + m[2] + m[3];
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m2) return m2[3] + m2[2] + m2[1];
  return '99999999';
}

const emptyRespondent = () => ({ da_id: null, name: '', irid: '', country: '', referrer: '', va_upline: '', sapphire_upline: '', team: '' });

function respondentFromDA(r) {
  const join = (n, i) => [n || '', i ? `(${i})` : ''].filter(Boolean).join(' ').trim();
  return {
    da_id: r.id,
    name: r.respondent_name || '',
    irid: r.respondent_id || '',
    country: r.respondent_country || '',
    referrer: join(r.referrer_name, r.referrer_id),
    va_upline: join(r.upline_name, r.upline_id),
    sapphire_upline: '',
    team: r.team_name || '',
  };
}

function actionsFromDA(rows) {
  const out = [];
  rows.forEach((r) => {
    const who = `${r.respondent_name || 'Unknown'}${r.respondent_id ? ' (' + r.respondent_id + ')' : ''}`;
    let hist = Array.isArray(r.action_history) ? r.action_history : [];
    if (!hist.length && r.current_action) {
      hist = [{ action: r.current_action, date: r.execution_date, confirmed_by: r.da_confirmed ? r.da_confirmed_by : null, confirmed_at: r.da_confirmed_at }];
    }
    hist.forEach((h) => {
      const bits = [];
      if (h.confirmed_by) bits.push(`Confirmed by ${h.confirmed_by}${h.confirmed_at ? ' on ' + fmtDate(h.confirmed_at) : ''}`);
      (h.sub_actions || []).forEach((sa) => {
        if (sa && sa.desc) bits.push(`${sa.desc}${sa.date ? ' (' + fmtDate(sa.date) + ')' : ''}${sa.status ? ' – ' + sa.status : ''}`);
      });
      out.push({ date: h.date ? fmtDate(h.date) : 'Pending', type: `${h.action || '(no action)'} – ${who}`, remarks: bits.join('; '), _k: sortKey(h.date) });
    });
  });
  out.sort((a, b) => a._k.localeCompare(b._k));
  return out.map(({ _k, ...x }) => x);
}

function blankData(caseRow, comp) {
  return {
    pic_name: caseRow?.pic || '',
    receipt_date: fmtDate(caseRow?.created_on),
    cxn_no: caseRow?.case_number || '',
    complainant: {
      name: comp?.complainant_name || '',
      irid: [comp?.complainant_id, comp?.complainant_cust_id].filter(Boolean).join(' / '),
      country: comp?.complainant_country || '',
      team: '',
    },
    checklist: { complaint_form: '', selfie: '', evidence: '', verification_call: '', consent: '' },
    allegations: '',
    facts: { what: '', when: '', where: '', how: '', others: '' },
    respondents: [],
    evidence: '',
    analysis: '',
    actions: [],
    history: [],
  };
}

function normalize(d, base) {
  const x = d || {};
  return {
    ...base,
    ...x,
    complainant: { ...base.complainant, ...(x.complainant || {}) },
    checklist: { ...base.checklist, ...(x.checklist || {}) },
    facts: { ...base.facts, ...(x.facts || {}) },
    respondents: Array.isArray(x.respondents) ? x.respondents.map((r) => ({ ...emptyRespondent(), ...r })) : [],
    actions: Array.isArray(x.actions) ? x.actions : [],
    history: Array.isArray(x.history) ? x.history : [],
  };
}

/* =========================================================
   MAIN MODAL
   ========================================================= */
export default function CaseSummary({ supabase, caseRow, userEmail, isAdmin, onClose }) {
  const caseNo = caseRow?.case_number;
  const mayEdit = !!isAdmin || picMatches(userEmail, caseRow?.pic);

  const [view, setView] = useState('list');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [list, setList] = useState([]);
  const [daRows, setDaRows] = useState([]);
  const [comps, setComps] = useState([]);

  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [copyFrom, setCopyFrom] = useState('');

  const [rec, setRec] = useState(null);
  const [data, setData] = useState(null);
  const [selIds, setSelIds] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setErr('');
    try {
      const [sumRes, daRes, compRes] = await Promise.all([
        supabase.from('case_summaries').select('id, summary_no, title, status, created_by, created_at, modified_by, modified_at, pdf_version').eq('case_number', caseNo).order('summary_no', { ascending: true }),
        supabase.from('disciplinary_actions').select('*').eq('case_number', caseNo),
        supabase.from('case_complainants').select('*').eq('case_number', caseNo).order('is_anchor', { ascending: false }),
      ]);
      if (sumRes.error) throw sumRes.error;
      if (daRes.error) throw daRes.error;
      if (compRes.error) throw compRes.error;
      setList(sumRes.data || []);
      setDaRows((daRes.data || []).filter((r) => r.respondent_name || r.respondent_id));
      setComps(compRes.data || []);
    } catch (e) {
      setErr('Could not load: ' + (e?.message || e));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [caseNo]);

  const openSummary = async (id) => {
    setMsg('');
    const { data: row, error } = await supabase.from('case_summaries').select('*').eq('id', id).single();
    if (error) { alert('Could not open: ' + error.message); return; }
    setRec({ id: row.id, summary_no: row.summary_no, title: row.title || '', status: row.status || 'Draft', pdf_version: row.pdf_version || 0 });
    setData(normalize(row.data, blankData(caseRow, comps[0])));
    setSelIds(Array.isArray(row.respondent_ids) ? row.respondent_ids : []);
    setDirty(false);
    setView('form');
  };

  const createNew = async () => {
    const t = newTitle.trim();
    if (!t) { alert('Please type a title first (e.g. "Initial DA" or "Update – new evidence").'); return; }
    const now = new Date().toISOString();
    let d = blankData(caseRow, comps[0]);
    let ids = [];
    if (copyFrom) {
      const { data: src, error } = await supabase.from('case_summaries').select('data, respondent_ids, summary_no').eq('id', copyFrom).single();
      if (error) { alert('Could not copy: ' + error.message); return; }
      d = normalize(JSON.parse(JSON.stringify(src.data || {})), d);
      ids = Array.isArray(src.respondent_ids) ? src.respondent_ids : [];
      d.history = [{ action: `Created (copied from #${src.summary_no})`, by: userEmail, at: now }];
    } else {
      d.history = [{ action: 'Created (blank)', by: userEmail, at: now }];
    }
    setRec({ id: null, summary_no: null, title: t, status: 'Draft', pdf_version: 0 });
    setData(d);
    setSelIds(ids);
    setDirty(true);
    setShowNew(false);
    setNewTitle('');
    setCopyFrom('');
    setMsg('');
    setView('form');
  };

  const confirmLeave = () => !(view === 'form' && dirty) || confirm('You have unsaved changes. Leave without saving?');
  const safeClose = () => { if (confirmLeave()) onClose(); };
  const backToList = () => { if (!confirmLeave()) return; setView('list'); setRec(null); setData(null); setDirty(false); loadAll(); };

  const saveDraft = async () => {
    if (!rec) return;
    if (!rec.title.trim()) { alert('Title cannot be empty.'); return; }
    setSaving(true);
    setMsg('');
    const now = new Date().toISOString();
    try {
      if (rec.id) {
        const { error } = await supabase.from('case_summaries').update({ title: rec.title.trim(), data, respondent_ids: selIds, modified_by: userEmail, modified_at: now }).eq('id', rec.id);
        if (error) throw error;
      } else {
        const { data: mx, error: e1 } = await supabase.from('case_summaries').select('summary_no').eq('case_number', caseNo).order('summary_no', { ascending: false, nullsFirst: false }).limit(1);
        if (e1) throw e1;
        const next = ((mx && mx[0] && mx[0].summary_no) || 0) + 1;
        const { data: ins, error } = await supabase.from('case_summaries').insert({
          case_number: caseNo, summary_no: next, title: rec.title.trim(), data, images: [], status: 'Draft',
          respondent_ids: selIds, pdf_version: 0, created_by: userEmail, created_at: now, modified_by: userEmail, modified_at: now,
        }).select().single();
        if (error) throw error;
        setRec((p) => ({ ...p, id: ins.id, summary_no: next }));
      }
      setDirty(false);
      setMsg('✅ Draft saved ' + fmtDateTime(now));
    } catch (e) {
      alert('Save failed: ' + (e?.message || e));
    }
    setSaving(false);
  };

  const unlock = async () => {
    if (!rec?.id) return;
    if (!confirm('Unlock this summary so it can be edited again? This will be recorded in the history.')) return;
    const now = new Date().toISOString();
    const nd = { ...data, history: [...(data.history || []), { action: 'Unlocked', by: userEmail, at: now }] };
    const { error } = await supabase.from('case_summaries').update({ status: 'Draft', data: nd, modified_by: userEmail, modified_at: now }).eq('id', rec.id);
    if (error) { alert('Unlock failed: ' + error.message); return; }
    setRec((p) => ({ ...p, status: 'Draft' }));
    setData(nd);
    setMsg('🔓 Unlocked — you can edit again.');
  };

  /* ---------- data updaters ---------- */
  const upd = (key, val) => { setData((p) => ({ ...p, [key]: val })); setDirty(true); };
  const updIn = (key, sub, val) => { setData((p) => ({ ...p, [key]: { ...p[key], [sub]: val } })); setDirty(true); };
  const updResp = (i, k, v) => { setData((p) => ({ ...p, respondents: p.respondents.map((r, j) => (j === i ? { ...r, [k]: v } : r)) })); setDirty(true); };
  const updAct = (i, k, v) => { setData((p) => ({ ...p, actions: p.actions.map((a, j) => (j === i ? { ...a, [k]: v } : a)) })); setDirty(true); };

  const toggleDA = (r) => {
    const on = selIds.includes(r.id);
    if (on) {
      setSelIds((p) => p.filter((x) => x !== r.id));
      setData((p) => ({ ...p, respondents: p.respondents.filter((x) => x.da_id !== r.id) }));
    } else {
      setSelIds((p) => [...p, r.id]);
      setData((p) => ({ ...p, respondents: [...p.respondents, respondentFromDA(r)] }));
    }
    setDirty(true);
  };

  const refreshActions = () => {
    const rows = daRows.filter((r) => selIds.includes(r.id));
    if (!rows.length) { alert('Tick at least one respondent in the "Pick respondents from DA" box first.'); return; }
    if (data.actions.length && !confirm('This will REPLACE the current Actions Taken rows with the latest DA history. Continue?')) return;
    upd('actions', actionsFromDA(rows));
  };

  /* ---------- small render helpers (plain functions, not components) ---------- */
  const ro = !mayEdit || rec?.status === 'Final';
  const inp = (label, value, onChange, opts = {}) => (
    <div style={opts.wide ? { gridColumn: '1 / -1' } : null}>
      <label style={S.label}>{label}</label>
      {opts.area ? (
        <textarea rows={opts.rows || 3} disabled={ro} value={value || ''} placeholder={opts.ph || ''} onChange={(e) => onChange(e.target.value)} style={{ ...S.input, ...(ro ? S.inputRO : {}), resize: 'vertical', fontFamily: 'inherit' }} />
      ) : (
        <input disabled={ro} value={value || ''} placeholder={opts.ph || ''} onChange={(e) => onChange(e.target.value)} style={{ ...S.input, ...(ro ? S.inputRO : {}) }} />
      )}
    </div>
  );
  const clip = () => null;
  const secHead = (title, extra) => (
    <div style={S.secHead}>
      <span>{title}</span>
      <span style={{ display: 'flex', gap: 6 }}>{extra}{clip()}</span>
    </div>
  );
  const badge = (status) => (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: status === 'Final' ? '#dcfce7' : '#fef3c7', color: status === 'Final' ? '#166534' : '#92400e' }}>
      {status === 'Final' ? '🔒 Final' : '✏️ Draft'}
    </span>
  );
  const BULLET_PH = 'One point per line — each line becomes a bullet in the PDF';

  /* =========================== RENDER =========================== */
  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) safeClose(); }}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div style={S.header}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>📝 NID Case Summary — {caseNo}</div>
            {view === 'form' && rec && (
              <div style={{ ...S.note, marginTop: 3, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>{rec.summary_no ? `#${rec.summary_no}` : '(new — not saved yet)'}</span>
                {badge(rec.status)}
                {!mayEdit && <span>👁️ View only (only the PIC or an admin can edit)</span>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {view === 'form' && <button style={S.btn} onClick={backToList}>← All summaries</button>}
            {view === 'form' && mayEdit && rec?.status !== 'Final' && (
              <button style={{ ...S.btnPrimary, ...(saving ? S.btnDisabled : {}) }} disabled={saving} onClick={saveDraft}>{saving ? 'Saving…' : '💾 Save Draft'}</button>
            )}
            {view === 'form' && mayEdit && rec?.status === 'Final' && <button style={S.btn} onClick={unlock}>🔓 Unlock</button>}
            {view === 'form' && (
              <button
                style={S.btn}
                title="Download this summary as a Word file"
                onClick={async () => {
                  try {
                    await downloadCaseSummaryWord(data, rec, userEmail);
                  } catch (e) {
                    alert('Could not create Word file: ' + (e?.message || e));
                  }
                }}
              >
                📄 Generate Word
              </button>
            )}
            <button style={S.btn} onClick={safeClose}>✕ Close</button>
          </div>
        </div>

        <div style={S.body}>
          {err && <div style={{ ...S.banner, background: '#fee2e2', color: '#991b1b' }}>{err}</div>}
          {loading && <div style={S.note}>Loading…</div>}

          {/* ===================== LIST VIEW ===================== */}
          {!loading && view === 'list' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 600 }}>Case summaries for this case ({list.length})</div>
                {mayEdit && !showNew && <button style={S.btnPrimary} onClick={() => setShowNew(true)}>+ New Case Summary</button>}
              </div>

              {showNew && (
                <div style={{ ...S.section, background: '#faf5ff' }}>
                  <div style={S.secHead}><span>New Case Summary</span></div>
                  <div style={S.grid}>
                    <div>
                      <label style={S.label}>Title (e.g. "Initial DA – Respondent A", "Update – new evidence")</label>
                      <input style={S.input} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus />
                    </div>
                    <div>
                      <label style={S.label}>Start from</label>
                      <select style={S.input} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                        <option value="">Start blank (auto-fill case & complainant)</option>
                        {list.map((s) => (
                          <option key={s.id} value={s.id}>Copy from #{s.summary_no} – {s.title || '(no title)'}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button style={S.btnPrimary} onClick={createNew}>Create</button>
                    <button style={S.btn} onClick={() => { setShowNew(false); setNewTitle(''); setCopyFrom(''); }}>Cancel</button>
                  </div>
                </div>
              )}

              {list.length === 0 ? (
                <div style={{ ...S.note, padding: 20, textAlign: 'center', border: '1px dashed #ccc', borderRadius: 8 }}>
                  No case summaries yet.{mayEdit ? ' Click "+ New Case Summary" to start one.' : ''}
                </div>
              ) : (
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>#</th><th style={S.th}>Title</th><th style={S.th}>Status</th>
                      <th style={S.th}>Last modified</th><th style={S.th}>PDF ver.</th><th style={S.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s) => (
                      <tr key={s.id}>
                        <td style={S.td}>{s.summary_no}</td>
                        <td style={S.td}>{s.title || '(no title)'}</td>
                        <td style={S.td}>{badge(s.status)}</td>
                        <td style={S.td}>{fmtDateTime(s.modified_at)}<div style={S.note}>{s.modified_by}</div></td>
                        <td style={S.td}>{s.pdf_version ? 'v' + s.pdf_version : '—'}</td>
                        <td style={S.td}><button style={S.btn} onClick={() => openSummary(s.id)}>Open</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* ===================== FORM VIEW ===================== */}
          {!loading && view === 'form' && data && (
            <>
              {msg && <div style={{ ...S.banner, background: '#ecfdf5', color: '#065f46' }}>{msg}</div>}
              {rec.status === 'Final' && (
                <div style={{ ...S.banner, background: '#f0fdf4', color: '#166534' }}>🔒 This summary is locked (PDF generated).{mayEdit ? ' Press 🔓 Unlock to edit.' : ''}</div>
              )}

              {/* TITLE + HEADER INFO */}
              <div style={S.section}>
                <div style={S.grid}>
                  <div>
                    <label style={S.label}>Summary title</label>
                    <input disabled={ro} value={rec.title} onChange={(e) => { setRec((p) => ({ ...p, title: e.target.value })); setDirty(true); }} style={{ ...S.input, ...(ro ? S.inputRO : {}) }} />
                  </div>
                  {inp('Name of PIC', data.pic_name, (v) => upd('pic_name', v))}
                  {inp('Complaint Receipt Date', data.receipt_date, (v) => upd('receipt_date', v), { ph: 'dd/mm/yyyy' })}
                  {inp('CXN No.', data.cxn_no, (v) => upd('cxn_no', v))}
                </div>
              </div>

              {/* COMPLAINANT */}
              <div style={S.section}>
                {secHead("COMPLAINANT'S DETAILS")}
                <div style={S.grid}>
                  {inp('Name', data.complainant.name, (v) => updIn('complainant', 'name', v))}
                  {inp('IRID', data.complainant.irid, (v) => updIn('complainant', 'irid', v))}
                  {inp('Country', data.complainant.country, (v) => updIn('complainant', 'country', v))}
                  {inp('Team Name', data.complainant.team, (v) => updIn('complainant', 'team', v))}
                </div>
                <div style={{ marginTop: 12, fontWeight: 600, fontSize: 13 }}>Checklist</div>
                <div style={{ ...S.grid, marginTop: 6 }}>
                  {CHECKLIST.map(([k, label]) => (
                    <div key={k}>
                      <label style={S.label}>{label}</label>
                      <select disabled={ro} value={data.checklist[k] || ''} onChange={(e) => updIn('checklist', k, e.target.value)} style={{ ...S.input, ...(ro ? S.inputRO : {}) }}>
                        <option value="">—</option><option value="Yes">Yes</option><option value="No">No</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* ALLEGATIONS */}
              <div style={S.section}>
                {secHead('ALLEGATIONS / VIOLATIONS')}
                {inp('', data.allegations, (v) => upd('allegations', v), { area: true, rows: 4, ph: BULLET_PH, wide: true })}
              </div>

              {/* FACTS */}
              <div style={S.section}>
                {secHead('SUMMARY OF FACTS')}
                <div style={S.grid}>
                  {inp('WHAT', data.facts.what, (v) => updIn('facts', 'what', v), { area: true, wide: true })}
                  {inp('WHEN', data.facts.when, (v) => updIn('facts', 'when', v), { area: true, rows: 2 })}
                  {inp('WHERE', data.facts.where, (v) => updIn('facts', 'where', v), { area: true, rows: 2 })}
                  {inp('HOW', data.facts.how, (v) => updIn('facts', 'how', v), { area: true, wide: true })}
                  {inp('Any other IRs involved', data.facts.others, (v) => updIn('facts', 'others', v), { area: true, rows: 2, wide: true })}
                </div>
              </div>

              {/* RESPONDENTS */}
              <div style={S.section}>
                {secHead("RESPONDENT(S)' DETAILS")}
                <div style={{ background: '#f9fafb', border: '1px solid #eee', borderRadius: 6, padding: 10, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Pick respondents from Disciplinary Actions ({daRows.length} found)</div>
                  {daRows.length === 0 ? (
                    <div style={S.note}>No DA respondents recorded for this case. Use "+ Add respondent" to type one in.</div>
                  ) : (
                    daRows.map((r) => (
                      <label key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, padding: '3px 0', cursor: ro ? 'default' : 'pointer' }}>
                        <input type="checkbox" disabled={ro} checked={selIds.includes(r.id)} onChange={() => toggleDA(r)} />
                        <span><b>{r.respondent_name || '(no name)'}</b> {r.respondent_id ? `(${r.respondent_id})` : ''} — {r.current_action || 'no action yet'}</span>
                      </label>
                    ))
                  )}
                  <div style={{ ...S.note, marginTop: 4 }}>Ticking fills in a respondent block below. "Nearest Sapphire upline" isn't stored in DA, so type it in yourself.</div>
                </div>

                {data.respondents.map((r, i) => (
                  <div key={i} style={{ border: '1px solid #e9d5ff', borderRadius: 6, padding: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <b style={{ fontSize: 13 }}>Respondent {i + 1}{r.da_id ? ' (from DA)' : ' (manual)'}</b>
                      {!ro && (
                        <button style={S.btnDanger} onClick={() => {
                          if (!confirm('Remove this respondent block?')) return;
                          if (r.da_id) setSelIds((p) => p.filter((x) => x !== r.da_id));
                          setData((p) => ({ ...p, respondents: p.respondents.filter((_, j) => j !== i) }));
                          setDirty(true);
                        }}>Remove</button>
                      )}
                    </div>
                    <div style={S.grid}>
                      {inp('Name', r.name, (v) => updResp(i, 'name', v))}
                      {inp('IRID', r.irid, (v) => updResp(i, 'irid', v))}
                      {inp('Country', r.country, (v) => updResp(i, 'country', v))}
                      {inp('Direct Referrer Name & IRID', r.referrer, (v) => updResp(i, 'referrer', v))}
                      {inp('Nearest VA upline', r.va_upline, (v) => updResp(i, 'va_upline', v))}
                      {inp('Nearest Sapphire upline', r.sapphire_upline, (v) => updResp(i, 'sapphire_upline', v))}
                      {inp('Team Name', r.team, (v) => updResp(i, 'team', v))}
                    </div>
                  </div>
                ))}
                {!ro && (
                  <button style={S.btn} onClick={() => { setData((p) => ({ ...p, respondents: [...p.respondents, emptyRespondent()] })); setDirty(true); }}>+ Add respondent (manual)</button>
                )}
              </div>

              {/* EVIDENCE */}
              <div style={S.section}>
                {secHead('EVIDENCE')}
                {inp('', data.evidence, (v) => upd('evidence', v), { area: true, rows: 4, ph: BULLET_PH, wide: true })}
              </div>

              {/* ANALYSIS */}
              <div style={S.section}>
                {secHead('NID CASE ANALYSIS & RECOMMENDATION')}
                {inp('', data.analysis, (v) => upd('analysis', v), { area: true, rows: 5, ph: BULLET_PH, wide: true })}
              </div>

              {/* ACTIONS TAKEN */}
              <div style={S.section}>
                {secHead('ACTIONS TAKEN & CASE UPDATES', !ro ? <button style={{ ...S.btn, padding: '3px 10px' }} onClick={refreshActions}>↻ Refresh from DA</button> : null)}
                <table style={S.table}>
                  <thead>
                    <tr><th style={{ ...S.th, width: 120 }}>Date</th><th style={S.th}>Type of Action Taken</th><th style={S.th}>Remarks</th>{!ro && <th style={{ ...S.th, width: 40 }}></th>}</tr>
                  </thead>
                  <tbody>
                    {data.actions.length === 0 && (
                      <tr><td style={{ ...S.td, ...S.note }} colSpan={4}>No rows yet. Tick respondents above, then press "↻ Refresh from DA" — or add a row manually.</td></tr>
                    )}
                    {data.actions.map((a, i) => (
                      <tr key={i}>
                        <td style={S.td}><input disabled={ro} value={a.date || ''} onChange={(e) => updAct(i, 'date', e.target.value)} style={{ ...S.input, ...(ro ? S.inputRO : {}) }} /></td>
                        <td style={S.td}><textarea rows={2} disabled={ro} value={a.type || ''} onChange={(e) => updAct(i, 'type', e.target.value)} style={{ ...S.input, ...(ro ? S.inputRO : {}), fontFamily: 'inherit' }} /></td>
                        <td style={S.td}><textarea rows={2} disabled={ro} value={a.remarks || ''} onChange={(e) => updAct(i, 'remarks', e.target.value)} style={{ ...S.input, ...(ro ? S.inputRO : {}), fontFamily: 'inherit' }} /></td>
                        {!ro && (
                          <td style={S.td}><button style={S.btnDanger} title="Remove row" onClick={() => { setData((p) => ({ ...p, actions: p.actions.filter((_, j) => j !== i) })); setDirty(true); }}>✕</button></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!ro && (
                  <button style={{ ...S.btn, marginTop: 8 }} onClick={() => { setData((p) => ({ ...p, actions: [...p.actions, { date: '', type: '', remarks: '' }] })); setDirty(true); }}>+ Add row</button>
                )}
              </div>

              {/* HISTORY */}
              {data.history.length > 0 && (
                <div style={{ ...S.note, marginTop: 4 }}>
                  <b>History:</b>{' '}
                  {data.history.map((h, i) => (
                    <span key={i}>{i > 0 ? ' · ' : ''}{h.action} by {h.by} ({fmtDateTime(h.at)})</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   BUTTON (used in App.tsx — do not rename)
   ========================================================= */
export function CaseSummaryButton({ supabase, caseRow, userEmail, isAdmin }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn-action"
        style={{ background: '#7c3aed', color: '#fff', border: 'none' }}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        📝 Case Summary
      </button>
      {open && createPortal(
        <CaseSummary supabase={supabase} caseRow={caseRow} userEmail={userEmail} isAdmin={isAdmin} onClose={() => setOpen(false)} />,
        document.body
      )}
    </>
  );
}