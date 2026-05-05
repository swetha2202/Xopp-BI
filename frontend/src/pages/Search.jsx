import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Phone, Mail, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const selectAllRef = useRef(null);

  // Read role directly from localStorage — no useAuth needed
  const isAdmin = (() => {
    try { return JSON.parse(localStorage.getItem('pmdb_user'))?.role === 'admin'; }
    catch { return false; }
  })();

  const doSearch = useCallback(async (q, p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/customers', { params: { q, page: p, limit: 20 } });
      setResults(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setSelected([]);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { doSearch(query, page); }, [query, page]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selected.length > 0 && selected.length < results.length;
    }
  }, [selected.length, results.length]);

  const handleSearch = (e) => { setQuery(e.target.value); setPage(1); };

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setSelected(selected.length === results.length ? [] : results.map(c => c.id));
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.length} customer(s)?\n\nThis will also remove all their property records. This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const { data } = await api.post('/customers/delete-multiple', { ids: selected });
      toast.success(`Deleted ${data.deletedCount} customer(s)`);
      setSelected([]);
      doSearch(query, page);
    } catch (err) {
      toast.error('Delete failed: ' + (err.response?.data?.error || err.message));
    }
    setDeleting(false);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Search</h1>
          <p className="page-subtitle">Find customers by name, phone, email, or ID</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAdmin && selected.length > 0 && (
            <button className="btn btn-danger" onClick={handleBulkDelete} disabled={deleting}>
              <Trash2 size={14} />
              {deleting ? 'Deleting…' : `Delete ${selected.length} selected`}
            </button>
          )}
          <div style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>{total.toLocaleString()} total records</div>
        </div>
      </div>

      <div className="card mb-24">
        <div className="search-bar" style={{ maxWidth: '100%' }}>
          <Search size={16} />
          <input
            className="input"
            style={{ paddingLeft: 40, fontSize: '1rem' }}
            placeholder="Search by name, phone, email, Customer ID…"
            value={query}
            onChange={handleSearch}
            autoFocus
          />
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="pulse text-muted">Searching…</div>
        </div>
      ) : results.length === 0 ? (
        <div className="card empty-state">
          <Search size={40} />
          <h3>No results found</h3>
          <p>{query ? `No customers match "${query}"` : 'Start typing to search customers'}</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {isAdmin && (
                    <th style={{ width: 40 }}>
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={results.length > 0 && selected.length === results.length}
                        onChange={toggleAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                  )}
                  <th>Customer ID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Nationality</th>
                  <th>Properties</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {results.map(c => (
                  <tr
                    key={c.id}
                    style={{ cursor: 'pointer', background: selected.includes(c.id) ? 'var(--accent-dim)' : undefined }}
                    onClick={() => navigate(`/customers/${c.id}`)}
                  >
                    {isAdmin && (
                      <td onClick={e => toggleSelect(c.id, e)} style={{ cursor: 'default' }}>
                        <input
                          type="checkbox"
                          checked={selected.includes(c.id)}
                          onChange={e => toggleSelect(c.id, e)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                    )}
                    <td><code style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>{c.customer_id}</code></td>
                    <td className="highlight">
                      <div className="flex items-center gap-8">
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                          {(c.name || '?')[0]}
                        </div>
                        {c.name || <span className="text-muted">Unknown</span>}
                      </div>
                    </td>
                    <td>{c.phone ? <div className="flex items-center gap-8"><Phone size={12} />{c.phone}</div> : <span className="text-muted">—</span>}</td>
                    <td>{c.email ? <div className="flex items-center gap-8"><Mail size={12} />{c.email}</div> : <span className="text-muted">—</span>}</td>
                    <td>{c.nationality || <span className="text-muted">—</span>}</td>
                    <td>
                      <span className="badge badge-yellow">{c.property_count} {c.property_count === 1 ? 'unit' : 'units'}</span>
                    </td>
                    <td><span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>View →</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-16" style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div className="text-sm text-muted">Page {page} of {totalPages}</div>
              <div className="pagination">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const p = Math.max(1, page - 2) + i;
                  if (p > totalPages) return null;
                  return <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>;
                })}
                <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>→</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
