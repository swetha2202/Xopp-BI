import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, CheckCircle, AlertCircle, RefreshCw, PenLine } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

// All fields in display order — type 'map' = maps to a file column, 'fixed' = fixed dropdown, 'manual' = free text
const ALL_FIELDS = [
  {
    key: 'emirate', label: 'Emirate', type: 'fixed',
    options: ['Dubai', 'Abudhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Umm Al Quein', 'Fujeirah']
  },
  {
    key: 'property_type', label: 'Property Type', type: 'fixed',
    options: ['Plot', 'Villa & TH', 'Apartment', 'Commercial', 'Labourcamp', 'Warehouse']
  },
  { key: 'area', label: 'Area', type: 'map' },
  { key: 'community', label: 'Community', type: 'map' },
  { key: 'land_number', label: 'Plot Number', type: 'map' },
  { key: 'project', label: 'Project Name', type: 'mapOrManual' },
  { key: 'unit', label: 'Unit No', type: 'map' },
  { key: 'name', label: 'Customer Name', type: 'map' },
  { key: 'mobile', label: 'Mobile No', type: 'map' },
  { key: 'phone', label: 'Phone', type: 'map' },
  { key: 'email', label: 'Email ID', type: 'map' },
  { key: 'internal_area', label: 'Internal Area', type: 'map' },
  { key: 'ext_area', label: 'Ext Area', type: 'map' },
  { key: 'total_area', label: 'Total Area', type: 'map' },
  { key: 'selling_price', label: 'Selling Price', type: 'map' },
  { key: 'registration_date', label: 'Reg Date', type: 'map' },
];

export default function UploadCenter() {
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [fileData, setFileData] = useState(null);
  const [mapping, setMapping] = useState({});       // key → file column (for 'map' fields)
  const [fixedValues, setFixedValues] = useState({});       // key → chosen preset value
  const [customValues, setCustomValues] = useState({});     // key → typed custom value
  const [useCustom, setUseCustom] = useState({});       // key → true when typing own value
  const [processing, setProcessing] = useState(false);
  const [fileStatus, setFileStatus] = useState(null);

  const onDrop = useCallback(async (accepted) => {
    if (!accepted.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', accepted[0]);
      const { data } = await api.post('/files/upload', form);
      setFileData(data);

      // Auto-map columns
      const autoMap = {};
      ALL_FIELDS.filter(f => f.type === 'map' || f.type === 'mapOrManual').forEach(field => {
        const match = (data.headers || []).find(h => {
          const hl = h.toLowerCase().replace(/[\s_]/g, '');
          const kl = field.key.toLowerCase().replace(/[\s_]/g, '');
          const ll = field.label.toLowerCase().replace(/[\s_]/g, '');
          return hl === kl || hl === ll;
        });
        if (match) autoMap[field.key] = match;
      });
      setMapping(autoMap);
      setStep(2);
      toast.success(`Loaded ${data.totalRows} rows — review column mapping`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    noClick: true,
  });

  const handleProcess = async () => {
    setProcessing(true);
    try {
      // Build column→field mapping
      const finalMapping = {};
      Object.entries(mapping).forEach(([fieldKey, fileCol]) => {
        if (fileCol) finalMapping[fileCol] = fieldKey;
      });

      // Build fixed values — custom typed value wins over dropdown selection
      const combinedFixed = {};
      ALL_FIELDS.filter(f => f.type === 'fixed' || f.type === 'mapOrManual').forEach(f => {
        const custom = customValues[f.key]?.trim();
        const preset = fixedValues[f.key];
        if (useCustom[f.key] && custom) {
          combinedFixed[f.key] = custom;
        } else if (!useCustom[f.key] && preset) {
          combinedFixed[f.key] = preset;
        }
      });

      await api.post(`/files/${fileData.file.id}/process`, {
        mapping: finalMapping,
        fixedValues: combinedFixed,
      });

      setStep(3);
      pollStatus(fileData.file.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Processing failed');
      setProcessing(false);
    }
  };

  const pollStatus = async (fileId) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/files/${fileId}/status`);
        setFileStatus(data);
        if (data.status === 'completed' || data.status === 'error') {
          clearInterval(interval);
          setStep(4);
          setProcessing(false);
          if (data.status === 'completed') toast.success('File processed successfully!');
          else toast.error('Processing error: ' + data.error_message);
        }
      } catch { clearInterval(interval); }
    }, 2000);
  };

  const reset = () => {
    setStep(1); setFileData(null); setMapping({});
    setFixedValues({}); setCustomValues({}); setUseCustom({});
    setFileStatus(null); setProcessing(false);
  };

  const steps = ['Upload', 'Map Columns', 'Processing', 'Done'];
  const columnOptions = fileData?.headers || [];

  const colLabel = {
    fontSize: '0.7rem', fontWeight: 700,
    color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em',
  };
  const fieldBox = {
    padding: '9px 14px', borderRadius: 'var(--radius-sm)',
    background: 'var(--bg3)', border: '1px solid var(--border)',
    fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)',
  };

  // ── Renders the right-side control for a field ──────────────────────────
  const renderControl = (field) => {
    // 'map' — just a column picker
    if (field.type === 'map') {
      return (
        <select
          className="input"
          value={mapping[field.key] || ''}
          onChange={e => setMapping({ ...mapping, [field.key]: e.target.value || null })}
        >
          <option value="">— Skip —</option>
          {columnOptions.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
      );
    }

    // 'fixed' — preset dropdown + optional "Add own" text input
    if (field.type === 'fixed') {
      const isCustom = useCustom[field.key];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {isCustom ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="input"
                placeholder={`Type custom ${field.label}…`}
                value={customValues[field.key] || ''}
                onChange={e => setCustomValues({ ...customValues, [field.key]: e.target.value })}
                style={{ flex: 1 }}
                autoFocus
              />
              <button
                title="Back to list"
                onClick={() => setUseCustom({ ...useCustom, [field.key]: false })}
                style={{
                  padding: '0 10px', background: 'var(--bg3)',
                  border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text3)', cursor: 'pointer', fontSize: '0.8rem',
                }}
              >✕</button>
            </div>
          ) : (
            <select
              className="input"
              value={fixedValues[field.key] || ''}
              onChange={e => {
                const val = e.target.value;
                if (val === '__custom__') {
                  setUseCustom({ ...useCustom, [field.key]: true });
                  setFixedValues({ ...fixedValues, [field.key]: null });
                } else {
                  setFixedValues({ ...fixedValues, [field.key]: val || null });
                }
              }}
            >
              <option value="">— Select {field.label} —</option>
              {field.options.map(o => <option key={o} value={o}>{o}</option>)}
              <option value="__custom__">＋ Add your {field.label}…</option>
            </select>
          )}
          {/* show typed value confirmation */}
          {isCustom && customValues[field.key]?.trim() && (
            <div style={{
              fontSize: '0.75rem', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <PenLine size={11} /> Custom: "{customValues[field.key].trim()}"
            </div>
          )}
        </div>
      );
    }

    // 'mapOrManual' — column picker OR type manually; toggle between
    if (field.type === 'mapOrManual') {
      const isCustom = useCustom[field.key];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {isCustom ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="input"
                placeholder={`Type ${field.label} for all rows…`}
                value={customValues[field.key] || ''}
                onChange={e => setCustomValues({ ...customValues, [field.key]: e.target.value })}
                style={{ flex: 1 }}
                autoFocus
              />
              <button
                title="Back to column mapping"
                onClick={() => setUseCustom({ ...useCustom, [field.key]: false })}
                style={{
                  padding: '0 10px', background: 'var(--bg3)',
                  border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text3)', cursor: 'pointer', fontSize: '0.8rem',
                }}
              >✕</button>
            </div>
          ) : (
            <select
              className="input"
              value={mapping[field.key] || ''}
              onChange={e => {
                const val = e.target.value;
                if (val === '__custom__') {
                  setUseCustom({ ...useCustom, [field.key]: true });
                  setMapping({ ...mapping, [field.key]: null });
                } else {
                  setMapping({ ...mapping, [field.key]: val || null });
                }
              }}
            >
              <option value="">— Skip —</option>
              {columnOptions.map(col => <option key={col} value={col}>{col}</option>)}
              <option value="__custom__">＋ Type your project name…</option>
            </select>
          )}
          {isCustom && customValues[field.key]?.trim() && (
            <div style={{
              fontSize: '0.75rem', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <PenLine size={11} /> All {fileData?.totalRows?.toLocaleString()} rows → "{customValues[field.key].trim()}"
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload Center</h1>
          <p className="page-subtitle">Import Excel or CSV files to build master data</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="steps mb-24">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center gap-8" style={{ flex: i < steps.length - 1 ? 1 : 'initial' }}>
            <div className={`step ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}>
              <div className="step-num">{step > i + 1 ? '✓' : i + 1}</div>
              <div className="step-label">{label}</div>
            </div>
            {i < steps.length - 1 && <div className="step-connector" style={{ flex: 1 }} />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <div className="card">
          <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📊</div>
            <div className="dropzone-title">
              {uploading ? 'Uploading…' : isDragActive ? 'Drop it here!' : 'Drop your Excel file here'}
            </div>
            <div className="dropzone-sub" style={{ marginTop: 6 }}>
              {uploading ? <span className="pulse">Parsing file…</span> : 'Supports .xlsx, .xls, .csv — up to 50MB'}
            </div>
            {!uploading && (
              <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={e => { e.stopPropagation(); open(); }}>
                <Upload size={16} /> Browse Files
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2: Mapping ── */}
      {step === 2 && fileData && (
        <div>
          <div className="card mb-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-20">
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Column Mapping</h2>
                <p className="text-muted text-sm mt-8">
                  Match each field to a column in your file. All fields are optional.
                </p>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
                {fileData.totalRows} rows · {fileData.headers.length} columns
              </div>
            </div>

            {/* Column headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '0 24px', marginBottom: 8, padding: '0 4px',
            }}>
              <div style={colLabel}>Field</div>
              <div style={colLabel}>Map to Column / Set Value</div>
            </div>

            {/* All rows */}
            <div style={{ display: 'grid', gap: 6 }}>
              {ALL_FIELDS.map(field => (
                <div key={field.key} style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: '0 16px', alignItems: 'start',
                }}>
                  <div style={{ ...fieldBox, alignSelf: 'center' }}>{field.label}</div>
                  <div>{renderControl(field)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="card mb-24">
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 16, fontSize: '0.95rem' }}>
              Data Preview (first 5 rows)
            </h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>{fileData.headers.map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {fileData.preview.map((row, i) => (
                    <tr key={i}>
                      {fileData.headers.map(h => <td key={h}>{String(row[h] ?? '')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-12">
            <button className="btn btn-ghost" onClick={reset}>← Back</button>
            <button className="btn btn-primary" onClick={handleProcess} disabled={processing}>
              {processing ? <><RefreshCw size={14} className="pulse" /> Starting…</> : 'Confirm & Process →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Processing ── */}
      {step === 3 && (
        <div className="card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚙️</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 8 }}>Processing your file…</h2>
          <p className="text-muted text-sm">Normalizing data, matching customers, detecting duplicates</p>
          <div className="progress-bar" style={{ marginTop: 24, maxWidth: 300, margin: '24px auto 0' }}>
            <div className="progress-fill pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* ── Step 4: Done ── */}
      {step === 4 && fileStatus && (
        <div className="card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          {fileStatus.status === 'completed' ? (
            <>
              <CheckCircle size={56} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 8 }}>Processing Complete!</h2>
              <div className="stats-grid" style={{ maxWidth: 500, margin: '24px auto', textAlign: 'left' }}>
                {[
                  { label: 'Rows Processed', value: fileStatus.processed_count },
                  { label: 'Duplicates Skipped', value: fileStatus.duplicate_count },
                ].map(s => (
                  <div className="stat-card yellow" key={s.label} style={{ textAlign: 'center' }}>
                    <div className="stat-value">{s.value}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <AlertCircle size={56} style={{ color: 'var(--danger)', margin: '0 auto 16px' }} />
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 8 }}>Processing Error</h2>
              <p className="text-muted text-sm">{fileStatus.error_message}</p>
            </>
          )}
          <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={reset}>Upload Another File</button>
        </div>
      )}
    </div>
  );
}
