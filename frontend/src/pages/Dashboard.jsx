import { useState, useEffect } from 'react';
import { Users, Building2, Copy, FileCheck, X, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// ── Table Modal ───────────────────────────────────────────────────────────────
function TableModal({ title, columns, rows, loading, onClose, searchValue, onSearch, searchPlaceholder }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        zIndex: 200, backdropFilter: 'blur(4px)',
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(90vw, 780px)', maxHeight: '80vh',
        background: 'var(--bg2)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border2)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        animation: 'popIn 0.18s ease',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            <input
              className="input"
              style={{ paddingLeft: 34, fontSize: '0.875rem' }}
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={e => onSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }} className="pulse">Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)', fontSize: '0.875rem' }}>No records found</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col.key + col.label} style={{
                      background: '#E8C547', color: '#000', fontWeight: 700,
                      fontSize: '0.82rem', padding: '10px 16px', textAlign: 'left',
                      position: 'sticky', top: 0,
                      borderRight: '1px solid rgba(0,0,0,0.15)', whiteSpace: 'nowrap',
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id || i}
                    style={{ borderBottom: '1px solid var(--border)', cursor: row._onClick ? 'pointer' : 'default' }}
                    onClick={row._onClick}
                    onMouseEnter={e => { if (row._onClick) e.currentTarget.style.background = 'var(--bg3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                  >
                    {columns.map(col => (
                      <td key={col.key + col.label} style={{
                        padding: '10px 16px', fontSize: '0.875rem',
                        color: row[col.key] ? 'var(--text)' : 'var(--text3)',
                        borderRight: '1px solid var(--border)', whiteSpace: 'nowrap',
                      }}>
                        {row[col.key] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const { data } = await api.get('/customers/stats/summary');
      setStats(data);
    } catch { setStats(null); }
    finally { setStatsLoading(false); }
  };

  useEffect(() => { fetchStats(); }, []);

  // ── Open Customers modal ─────────────────────────────────────────────────
  const openCustomers = async () => {
    setSearch('');
    setModal({ type: 'customers', list: [], loading: true });
    try {
      const { data } = await api.get('/customers', { params: { page: 1, limit: 500 } });
      setModal(m => ({ ...m, list: data.data || [], loading: false }));
    } catch (err) {
      console.error('customers modal error:', err);
      setModal(m => ({ ...m, loading: false }));
    }
  };

  // ── Open Properties modal ────────────────────────────────────────────────
  const openProperties = async () => {
    setSearch('');
    setModal({ type: 'properties', list: [], loading: true });
    try {
      const { data } = await api.get('/customers/properties/recent', { params: { limit: 500 } });
      setModal(m => ({ ...m, list: Array.isArray(data) ? data : [], loading: false }));
    } catch (err) {
      console.error('properties modal error:', err);
      setModal(m => ({ ...m, loading: false }));
    }
  };

  const closeModal = () => { setModal(null); setSearch(''); };

  const q = search.toLowerCase();
  const filteredRows = (modal?.list || []).filter(row => {
    if (!q) return true;
    if (modal?.type === 'customers') {
      return (row.name || '').toLowerCase().includes(q) ||
        (row.phone || '').includes(q) ||
        (row.mobile || '').includes(q) ||
        (row.email || '').toLowerCase().includes(q) ||
        (row.customer_id || '').toLowerCase().includes(q);
    } else {
      return (row.project || '').toLowerCase().includes(q) ||
        (row.area || '').toLowerCase().includes(q) ||
        (row.land_number || '').toLowerCase().includes(q) ||
        (row.emirate || '').toLowerCase().includes(q);
    }
  }).map(row => ({
    ...row,
    _onClick: modal?.type === 'customers'
      ? () => { closeModal(); navigate(`/customers/${encodeURIComponent(row.customer_id)}`); }
      : undefined,
  }));

  const CUSTOMER_COLS = [
    { key: 'name', label: 'Name' },
    { key: 'mobile', label: 'Mobile No' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email ID' },
  ];
  const PROPERTY_COLS = [
    { key: 'project', label: 'Project' },
    { key: 'unit', label: 'Unit' },
    { key: 'property_type', label: 'Type' },
    { key: 'emirate', label: 'Emirate' },
  ];

  const statCards = [
    { label: 'Total Customers', value: stats?.totalCustomers, iconBg: 'rgba(232,197,71,0.12)', iconColor: 'var(--accent)', Icon: Users, color: 'yellow', onClick: openCustomers, clickable: true },
    { label: 'Properties', value: stats?.totalProperties, iconBg: 'rgba(62,207,142,0.12)', iconColor: 'var(--success)', Icon: Building2, color: 'green', onClick: openProperties, clickable: true },
    { label: 'Duplicates Found', value: stats?.totalDuplicates, iconBg: 'rgba(255,77,77,0.12)', iconColor: 'var(--danger)', Icon: Copy, color: 'red', clickable: false },
    { label: 'Files Processed', value: stats?.processedFiles, iconBg: 'rgba(92,124,250,0.12)', iconColor: 'var(--info)', Icon: FileCheck, color: 'blue', clickable: false },
  ];

  return (
    <div className="fade-in">

      {/* ── Table Modal ── */}
      {modal && (
        <TableModal
          title={modal.type === 'customers' ? 'Customer' : 'Properties'}
          columns={modal.type === 'customers' ? CUSTOMER_COLS : PROPERTY_COLS}
          rows={filteredRows}
          loading={modal.loading}
          onClose={closeModal}
          searchValue={search}
          onSearch={setSearch}
          searchPlaceholder={
            modal.type === 'customers'
              ? 'Search by name, phone, email…'
              : 'Search by area, community, project…'
          }
        />
      )}

      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your BI</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => navigate('/upload')}>
            + Upload Files
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="stats-grid">
        {statCards.map(s => (
          <div
            key={s.label}
            className={`stat-card ${s.color}`}
            onClick={s.clickable ? s.onClick : undefined}
            style={s.clickable ? { cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' } : {}}
            onMouseEnter={s.clickable ? e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
            } : undefined}
            onMouseLeave={s.clickable ? e => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '';
            } : undefined}
          >
            <div className="stat-icon" style={{ background: s.iconBg }}>
              <s.Icon size={20} style={{ color: s.iconColor }} />
            </div>
            <div className="stat-value">
              {statsLoading
                ? <span style={{ opacity: 0.4 }}>—</span>
                : typeof s.value === 'number' ? s.value.toLocaleString() : '—'}
            </div>
            <div className="stat-label">
              {s.label}
              {s.clickable && <span style={{ fontSize: '0.65rem', color: 'var(--text3)', marginLeft: 6 }}>↗</span>}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes popIn {
          from { transform: translate(-50%, -48%) scale(0.97); opacity: 0; }
          to   { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
