import { useState, useRef } from 'react'

// ── API base — reads from env or defaults to same-origin (Cloud Run) ──────────
const API = import.meta.env.VITE_API_URL || ''

// ── Severity config ────────────────────────────────────────────────────────────
const SEV = {
  critical: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)', label: 'Critical' },
  high:     { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  label: 'High'     },
  medium:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.3)',  label: 'Medium'   },
  low:      { color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)',  label: 'Low'      },
}

// ── Small components ───────────────────────────────────────────────────────────
function Badge({ sev }) {
  const s = SEV[sev]
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 20, padding: '2px 9px', fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {s.label}
    </span>
  )
}

function Bar({ value, max = 1, color, animate = true }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div style={{ background: 'var(--bg-4)', borderRadius: 3, height: 6, width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: animate ? 'width 0.6s cubic-bezier(0.4,0,0.2,1)' : 'none' }} />
    </div>
  )
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6, fontFamily: 'var(--mono)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: color || 'var(--text)', lineHeight: 1, fontFamily: 'var(--mono)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: color || 'var(--text-3)', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

// ── Overview chart ─────────────────────────────────────────────────────────────
function DIChart({ metrics }) {
  const nonPriv = metrics.filter(m => !m.is_privileged)
  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginBottom: 16, letterSpacing: '0.04em' }}>
        DISPARATE IMPACT RATIO — threshold 0.8 (4/5ths rule)
      </div>
      {nonPriv.map((m, i) => {
        const color = m.disparate_impact < 0.6 ? '#f87171' : m.disparate_impact < 0.8 ? '#fbbf24' : '#4ade80'
        return (
          <div key={i} className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, animationDelay: `${i * 50}ms` }}>
            <div style={{ width: 110, fontSize: 12, color: 'var(--text-2)', textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 500, color: 'var(--text)' }}>{m.group}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{m.attribute}</div>
            </div>
            <div style={{ flex: 1, position: 'relative', height: 28 }}>
              <div style={{ background: 'var(--bg-3)', borderRadius: 4, height: '100%', overflow: 'hidden', position: 'relative' }}>
                <div style={{ width: `${Math.min((m.disparate_impact / 1.2) * 100, 100)}%`, height: '100%', background: color, opacity: 0.85, borderRadius: 4, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)', display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
                  <span style={{ fontSize: 11, color: '#000', fontFamily: 'var(--mono)', fontWeight: 500 }}>{m.disparate_impact.toFixed(2)}</span>
                </div>
                {/* 0.8 threshold line */}
                <div style={{ position: 'absolute', left: `${(0.8 / 1.2) * 100}%`, top: 0, bottom: 0, width: 1, background: 'rgba(251,191,36,0.5)' }} />
              </div>
            </div>
            <div style={{ width: 60, textAlign: 'right', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
              {(m.pos_rate * 100).toFixed(1)}%
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 16, marginTop: 20, paddingTop: 16, borderTop: '0.5px solid var(--border)', flexWrap: 'wrap' }}>
        {[{ c: '#f87171', l: 'Critical < 0.6' }, { c: '#fbbf24', l: 'High 0.6–0.8' }, { c: '#4ade80', l: 'Acceptable ≥ 0.8' }, { c: 'rgba(251,191,36,0.5)', l: '0.8 threshold' }].map(x => (
          <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
            <div style={{ width: 10, height: 10, borderRadius: x.l.includes('threshold') ? 1 : 2, background: x.c }} />
            {x.l}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Groups table ───────────────────────────────────────────────────────────────
function GroupsTable({ metrics }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
            {['Group', 'Attribute', 'N', 'Severity', 'Pos. Rate', 'Disp. Impact', 'FPR', 'DP Gap'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, i) => (
            <tr key={i} className="fade-in" style={{ borderBottom: '0.5px solid var(--border)', animationDelay: `${i * 30}ms` }}>
              <td style={{ padding: '12px 14px', fontWeight: 500 }}>{m.group}</td>
              <td style={{ padding: '12px 14px', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>{m.attribute}</td>
              <td style={{ padding: '12px 14px', color: 'var(--text-2)', fontFamily: 'var(--mono)', fontSize: 12 }}>{m.n.toLocaleString()}</td>
              <td style={{ padding: '12px 14px' }}>
                {m.is_privileged
                  ? <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>reference</span>
                  : <Badge sev={m.severity} />}
              </td>
              <td style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{(m.pos_rate * 100).toFixed(1)}%</span>
                  <Bar value={m.pos_rate} max={0.8} color={m.is_privileged ? '#4ade80' : SEV[m.severity]?.color || '#60a5fa'} />
                </div>
              </td>
              <td style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: !m.is_privileged && m.disparate_impact < 0.8 ? '#f87171' : 'var(--text)' }}>
                    {m.is_privileged ? '1.00' : m.disparate_impact.toFixed(2)}
                  </span>
                  <Bar value={m.is_privileged ? 1 : m.disparate_impact} max={1.2} color={m.disparate_impact < 0.8 ? '#f87171' : '#4ade80'} />
                </div>
              </td>
              <td style={{ padding: '12px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)' }}>{(m.fpr * 100).toFixed(1)}%</td>
              <td style={{ padding: '12px 14px', fontFamily: 'var(--mono)', fontSize: 12 }}>
                {!m.is_privileged && (
                  <span style={{ color: m.demographic_parity_diff > 0.1 ? '#f87171' : '#60a5fa' }}>
                    {(m.demographic_parity_diff * 100).toFixed(1)}%
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Gemini AI panel ────────────────────────────────────────────────────────────
function GeminiPanel({ metrics, datasetName }) {
  const [mode, setMode] = useState(null)
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [custom, setCustom] = useState('')

  const biasSummary = metrics
    .filter(m => m.severity === 'critical' || m.severity === 'high')
    .map(m => `${m.group} (${m.attribute}): DI=${m.disparate_impact.toFixed(2)}, pos_rate=${(m.pos_rate * 100).toFixed(1)}%`)
    .join('; ')

  const analyze = async (type) => {
    setMode(type)
    setLoading(true)
    setText('')
    try {
      const res = await fetch(`${API}/api/gemini/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_type: type,
          dataset_name: datasetName,
          bias_summary: biasSummary,
          custom_question: type === 'custom' ? custom : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setText(`Error: ${err.detail}`)
      } else {
        const data = await res.json()
        setText(data.text)
      }
    } catch (e) {
      setText(`Network error: ${e.message}`)
    }
    setLoading(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, #4285f4, #0f9d58, #f4b400, #db4437)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>G</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Powered by Google Gemini 1.5 Flash</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>gemini-1.5-flash via Google AI Studio API</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { key: 'explain', label: 'Explain the bias' },
          { key: 'fix',     label: 'Remediation steps' },
          { key: 'sdg',     label: 'SDG 10 impact' },
        ].map(b => (
          <button key={b.key} onClick={() => analyze(b.key)} style={{
            padding: '8px 14px', borderRadius: 'var(--radius)', fontSize: 12, fontFamily: 'var(--mono)',
            border: mode === b.key ? '1px solid var(--teal)' : '0.5px solid var(--border-2)',
            background: mode === b.key ? 'rgba(45,212,191,0.1)' : 'var(--bg-3)',
            color: mode === b.key ? 'var(--teal)' : 'var(--text-2)',
          }}>{b.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          type="text"
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && custom && analyze('custom')}
          placeholder="Ask Gemini a custom question about this bias audit..."
          style={{ flex: 1, background: 'var(--bg-3)', border: '0.5px solid var(--border-2)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font)', outline: 'none' }}
        />
        <button onClick={() => custom && analyze('custom')} style={{ padding: '8px 16px', borderRadius: 'var(--radius)', background: 'var(--teal)', color: '#000', border: 'none', fontSize: 12, fontWeight: 500 }}>Ask</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', fontSize: 13, padding: '20px 0' }}>
          <div className="spinner" />
          Gemini is analyzing bias patterns...
        </div>
      )}

      {text && !loading && (
        <div className="fade-in" style={{ background: 'var(--bg-3)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingBottom: 12, borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)' }} />
            <span style={{ fontSize: 11, color: 'var(--teal)', fontFamily: 'var(--mono)' }}>GEMINI 1.5 FLASH — {mode?.toUpperCase()}</span>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{text}</div>
        </div>
      )}

      {!text && !loading && (
        <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
          Click a button above or ask a custom question to get Gemini's analysis
        </div>
      )}
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [datasets, setDatasets] = useState([
    { key: 'compas', name: 'COMPAS Criminal Justice', description: 'Recidivism prediction by race & gender', rows: 6172 },
    { key: 'adult',  name: 'Adult Income Census',     description: 'Income >$50K prediction by gender & race', rows: 48842 },
    { key: 'hiring', name: 'Hiring / Recruitment',    description: 'Callback rate by gender & age', rows: 4870 },
  ])
  const [active, setActive] = useState(null)
  const [auditData, setAuditData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('overview')
  const [uploadMsg, setUploadMsg] = useState(null)
  const fileRef = useRef()

  const loadDataset = async (key) => {
    setLoading(true)
    setActive(key)
    setAuditData(null)
    setTab('overview')
    try {
      const res = await fetch(`${API}/api/audit/${key}`)
      const data = await res.json()
      setAuditData(data)
    } catch (e) {
      setAuditData({ error: `Could not reach API: ${e.message}. Make sure the backend is running.` })
    }
    setLoading(false)
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadMsg({ status: 'loading', name: file.name })
    setLoading(true)
    setActive('upload')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`${API}/api/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setAuditData(data)
      setUploadMsg({ status: 'done', name: file.name })
    } catch (err) {
      setUploadMsg({ status: 'error', msg: err.message })
    }
    setLoading(false)
    setTab('overview')
  }

  const summary = auditData?.summary
  const metrics = auditData?.metrics || []
  const ds = auditData?.dataset

  const biasColor = !summary ? 'var(--text)' : summary.bias_score > 30 ? '#f87171' : summary.bias_score > 15 ? '#fbbf24' : '#4ade80'
  const biasSub = !summary ? '' : summary.bias_score > 30 ? 'high bias' : summary.bias_score > 15 ? 'moderate' : 'low bias'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Top bar */}
      <div style={{ borderBottom: '0.5px solid var(--border)', padding: '0 32px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(13,13,13,0.9)', backdropFilter: 'blur(8px)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)', boxShadow: '0 0 8px var(--teal)' }} />
          <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em' }}>Bias Audit Dashboard</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>· SDG 10 · Google GDP Solution Challenge</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4285f4' }} />
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Gemini 1.5 Flash</span>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(45,212,191,0.08)', border: '0.5px solid rgba(45,212,191,0.2)', borderRadius: 20, padding: '4px 12px', marginBottom: 14 }}>
            <span style={{ fontSize: 10, color: 'var(--teal)', fontFamily: 'var(--mono)', letterSpacing: '0.06em' }}>SDG 10 · REDUCED INEQUALITIES</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 8 }}>AI Bias Detection &amp; Audit</h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', maxWidth: 560 }}>
            Upload a dataset or select a demo — automatically detects bias across demographic groups using fairness metrics, explained by Google Gemini.
          </p>
        </div>

        {/* Dataset selector */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)', letterSpacing: '0.06em', marginBottom: 12 }}>SELECT DATASET</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {datasets.map(d => (
              <button key={d.key} onClick={() => loadDataset(d.key)} style={{
                padding: '12px 16px', borderRadius: 'var(--radius-lg)', textAlign: 'left',
                border: active === d.key ? '1px solid var(--teal)' : '0.5px solid var(--border)',
                background: active === d.key ? 'rgba(45,212,191,0.06)' : 'var(--bg-2)',
                color: 'var(--text)', minWidth: 180,
              }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{d.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{d.rows.toLocaleString()} rows</div>
              </button>
            ))}
            <button onClick={() => fileRef.current?.click()} style={{
              padding: '12px 16px', borderRadius: 'var(--radius-lg)', textAlign: 'left',
              border: active === 'upload' ? '1px solid var(--amber)' : '0.5px dashed var(--border-2)',
              background: active === 'upload' ? 'rgba(251,191,36,0.06)' : 'transparent',
              color: 'var(--text-2)', minWidth: 140,
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>Upload CSV</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>your own dataset</div>
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleUpload} />
          </div>
          {uploadMsg && (
            <div style={{ marginTop: 8, fontSize: 12, color: uploadMsg.status === 'error' ? '#f87171' : uploadMsg.status === 'done' ? '#4ade80' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {uploadMsg.status === 'loading' && <><div className="spinner" /> Processing {uploadMsg.name}...</>}
              {uploadMsg.status === 'done' && <>{uploadMsg.name} analyzed successfully</>}
              {uploadMsg.status === 'error' && <>Upload failed: {uploadMsg.msg}</>}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '48px 0', color: 'var(--text-3)', fontSize: 13 }}>
            <div className="spinner" style={{ width: 18, height: 18 }} />
            Running bias audit...
          </div>
        )}

        {/* Error */}
        {auditData?.error && !loading && (
          <div style={{ background: 'var(--red-bg)', border: '0.5px solid rgba(248,113,113,0.3)', borderRadius: 'var(--radius-lg)', padding: 20, color: '#f87171', fontSize: 13 }}>
            {auditData.error}
          </div>
        )}

        {/* Results */}
        {auditData && !auditData.error && !loading && (
          <div className="fade-in">
            {/* Dataset info */}
            <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{ds.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{ds.description}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{ds.rows.toLocaleString()} rows · accuracy {(ds.accuracy * 100).toFixed(0)}%</div>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
              <MetricCard label="Bias Score" value={`${summary.bias_score}%`} sub={biasSub} color={biasColor} />
              <MetricCard label="Critical" value={summary.critical} color={summary.critical > 0 ? '#f87171' : '#4ade80'} />
              <MetricCard label="High" value={summary.high} color={summary.high > 0 ? '#fbbf24' : '#4ade80'} />
              <MetricCard label="Groups Audited" value={summary.total_groups} />
              <MetricCard label="Model Accuracy" value={`${(ds.accuracy * 100).toFixed(0)}%`} />
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid var(--border)', marginBottom: 24 }}>
              {[
                { key: 'overview', label: 'Bias Overview' },
                { key: 'groups',   label: 'Group Details' },
                { key: 'gemini',   label: '✦ Gemini Analysis' },
                { key: 'fixes',    label: 'Remediation' },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  padding: '10px 18px', fontSize: 13, border: 'none',
                  borderBottom: tab === t.key ? '2px solid var(--teal)' : '2px solid transparent',
                  background: 'transparent', cursor: 'pointer', marginBottom: -1,
                  color: tab === t.key ? 'var(--teal)' : 'var(--text-3)',
                  fontWeight: tab === t.key ? 500 : 400,
                }}>{t.label}</button>
              ))}
            </div>

            {/* Tab content */}
            {tab === 'overview' && (
              <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 20px', borderBottom: '0.5px solid var(--border)', fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-3)', letterSpacing: '0.04em' }}>DISPARATE IMPACT ANALYSIS</div>
                <DIChart metrics={metrics} />
              </div>
            )}

            {tab === 'groups' && (
              <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 20px', borderBottom: '0.5px solid var(--border)', fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>DEMOGRAPHIC GROUP BREAKDOWN</div>
                <GroupsTable metrics={metrics} />
              </div>
            )}

            {tab === 'gemini' && (
              <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
                <GeminiPanel metrics={metrics} datasetName={ds.name} />
              </div>
            )}

            {tab === 'fixes' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                {[
                  { icon: '⚖', title: 'Sample Reweighting', severity: 'critical', desc: 'Increase sample weights for underrepresented groups during training to balance their influence on model parameters.', impl: 'Pass sample_weight to sklearn estimators or use Fairlearn\'s ExponentiatedGradient.' },
                  { icon: '🎯', title: 'Threshold Calibration', severity: 'high', desc: 'Set group-specific decision thresholds to achieve equal true positive rates (Equalized Odds) across demographics.', impl: 'Use Fairlearn\'s ThresholdOptimizer with equalized_odds constraint.' },
                  { icon: '📊', title: 'SMOTE Oversampling', severity: 'high', desc: 'Synthesize new examples for minority demographic groups using SMOTE to reduce training data imbalance.', impl: 'pip install imbalanced-learn → SMOTE(sampling_strategy="minority")' },
                  { icon: '🛡', title: 'Adversarial Debiasing', severity: 'medium', desc: 'Add an adversarial classifier that predicts the sensitive attribute; penalize the main model for leaking it.', impl: 'IBM AIF360\'s AdversarialDebiasing or custom two-head network in TensorFlow.' },
                  { icon: '🔄', title: 'Disparate Impact Remover', severity: 'medium', desc: 'Pre-process features to remove correlation with the sensitive attribute while preserving rank ordering.', impl: 'AIF360\'s DisparateImpactRemover(repair_level=0.8)' },
                ].map(r => (
                  <div key={r.title} style={{ background: 'var(--bg-2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <span style={{ fontSize: 22 }}>{r.icon}</span>
                      <Badge sev={r.severity} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{r.title}</div>
                    <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 10 }}>{r.desc}</p>
                    <div style={{ background: 'var(--bg-3)', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: 'var(--teal)', fontFamily: 'var(--mono)', lineHeight: 1.5 }}>{r.impl}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!active && (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 13, fontFamily: 'var(--mono)', marginBottom: 8 }}>SELECT A DATASET ABOVE TO BEGIN</div>
            <p style={{ fontSize: 13, maxWidth: 400, margin: '0 auto', lineHeight: 1.7 }}>
              The audit engine computes Disparate Impact, Demographic Parity, and Equalized Odds across demographic groups — then calls Google Gemini for plain-language explanations.
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 60, paddingTop: 24, borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Bias Audit Dashboard · SDG 10 · Google GDP Solution Challenge 2025</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>FastAPI + Google Gemini 1.5 Flash · Cloud Run</span>
        </div>
      </div>
    </div>
  )
}
