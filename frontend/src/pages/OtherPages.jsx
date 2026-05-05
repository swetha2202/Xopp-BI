import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Trash2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from "../context/AuthContext";

export function CustomersPage() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const selectAllRef = useRef(null);

  const isAdmin = (() => {
    try { return JSON.parse(localStorage.getItem('pmdb_user'))?.role === 'admin'; } catch { return false; }
  })();

  const fetchData = (query, p) => {
    api.get('/customers', { params: { q: query, page: p, limit: 25 } })
      .then(r => { setData(r.data.data); setTotal(r.data.total); setTotalPages(r.data.totalPages); setSelected([]); })
      .catch(() => { });
  };

  useEffect(() => { fetchData(q, page); }, [q, page]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selected.length > 0 && selected.length < data.length;
    }
  }, [selected.length, data.length]);

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => setSelected(selected.length === data.length ? [] : data.map(c => c.id));

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.length} customer(s)?\n\nThis will also remove all their property records. This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const { data: res } = await api.post('/customers/delete-multiple', { ids: selected });
      toast.success(`Deleted ${res.deletedCount} customer(s)`);
      fetchData(q, page);
    } catch (err) {
      toast.error('Delete failed: ' + (err.response?.data?.error || err.message));
    }
    setDeleting(false);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{total.toLocaleString()} unique customers in master data</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAdmin && selected.length > 0 && (
            <button className="btn btn-danger" onClick={handleBulkDelete} disabled={deleting}>
              <Trash2 size={14} />
              {deleting ? 'Deleting…' : `Delete ${selected.length} selected`}
            </button>
          )}
        </div>
      </div>
      <div className="card mb-16">
        <div className="search-bar" style={{ maxWidth: '100%' }}>
          <Search size={16} />
          <input
            className="input"
            style={{ paddingLeft: 40 }}
            placeholder="Search customers…"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
          />
        </div>
      </div>
      <div className="card">
        {data.length === 0 ? (
          <div className="empty-state">
            <Users size={40} />
            <h3>No customers yet</h3>
            <p>Upload files to populate master data</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {isAdmin && (
                    <th style={{ width: 40 }}>
                      <input ref={selectAllRef} type="checkbox"
                        checked={data.length > 0 && selected.length === data.length}
                        onChange={toggleAll} style={{ cursor: 'pointer' }} />
                    </th>
                  )}
                  <th>Customer ID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Nationality</th>
                  <th>Properties</th>
                </tr>
              </thead>
              <tbody>
                {data.map(c => (
                  <tr
                    key={c.id}
                    style={{ cursor: 'pointer', background: selected.includes(c.id) ? 'var(--accent-dim)' : undefined }}
                    onClick={() => navigate(`/customers/${encodeURIComponent(c.customer_id)}`)}
                  >
                    {isAdmin && (
                      <td onClick={e => toggleSelect(c.id, e)} style={{ cursor: 'default' }}>
                        <input type="checkbox" checked={selected.includes(c.id)}
                          onChange={e => toggleSelect(c.id, e)} style={{ cursor: 'pointer' }} />
                      </td>
                    )}
                    <td><code style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>{c.customer_id}</code></td>
                    <td className="highlight">{c.name || <span className="text-muted">Unknown</span>}</td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.email || '—'}</td>
                    <td>{c.nationality || '—'}</td>
                    <td><span className="badge badge-yellow">{c.property_count}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-16" style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div className="text-sm text-muted">Page {page} of {totalPages}</div>
            <div className="pagination">
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
              <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DuplicatesPage() {
  const [data, setData] = useState([]);
  useEffect(() => { api.get('/customers/duplicates/list').then(r => setData(r.data)).catch(() => { }); }, []);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Duplicate Review</h1>
          <p className="page-subtitle">Ownership records identified as duplicates during processing</p>
        </div>
        <span className="badge badge-red" style={{ fontSize: '0.85rem', padding: '6px 14px' }}>{data.length} duplicates</span>
      </div>
      <div className="card">
        {data.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <h3>No duplicates found</h3>
            <p>All records are unique</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer ID</th>
                  <th>Owner</th>
                  <th>Phone</th>
                  <th>Project</th>
                  <th>Unit</th>
                  <th>Source File</th>
                </tr>
              </thead>
              <tbody>
                {data.map(d => (
                  <tr key={d.id}>
                    <td><code style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>{d.customer_id}</code></td>
                    <td className="highlight">{d.customer_name || '—'}</td>
                    <td>{d.phone || '—'}</td>
                    <td>{d.project || '—'}</td>
                    <td>{d.unit || '—'}</td>
                    <td className="text-muted" style={{ maxWidth: 160 }}>
                      <span className="truncate" style={{ display: 'block' }}>{d.source_file_name || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function FilesPage() {
  const [files, setFiles] = useState([]);
  const { user } = useAuth();

  const fetchFiles = () => {
    api.get('/files').then(r => setFiles(r.data)).catch(() => { });
  };

  useEffect(() => { fetchFiles(); }, []);

  const handleDelete = async (fileId, fileName) => {
    if (!window.confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/files/${fileId}`);
      toast.success('File deleted');
      fetchFiles();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const statusBadge = (s) => {
    const map = { pending: 'badge-gray', mapping: 'badge-blue', processing: 'badge-orange', completed: 'badge-green', error: 'badge-red' };
    return <span className={`badge ${map[s] || 'badge-gray'}`}>{s.toUpperCase()}</span>;
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Source Files</h1>
          <p className="page-subtitle">
            {isAdmin ? 'All uploaded files across all users' : 'Your uploaded files — only visible to you'}
          </p>
        </div>
      </div>
      <div className="card">
        {files.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}><h3>No files uploaded yet</h3></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Processed</th>
                  <th>Duplicates</th>
                  {isAdmin && <th>Uploaded By</th>}
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.id}>
                    <td className="highlight" style={{ maxWidth: 220 }}>
                      <span className="truncate" style={{ display: 'block' }}>{f.original_name}</span>
                    </td>
                    <td>{statusBadge(f.status)}</td>
                    <td>{f.row_count}</td>
                    <td>{f.processed_count}</td>
                    <td style={{ color: f.duplicate_count > 0 ? 'var(--danger)' : '' }}>{f.duplicate_count}</td>
                    {isAdmin && <td>{f.uploaded_by_name || '—'}</td>}
                    <td>{new Date(f.upload_date).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(f.id, f.original_name)}
                        title="Delete file"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function ExportsPage() {
  const [loading, setLoading] = useState('');

  const dl = async (endpoint, filename) => {
    setLoading(endpoint);
    try {
      const { data } = await api.get(`/exports/${endpoint}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Export failed: ' + (e.response?.data?.error || e.message));
    }
    setLoading('');
  };

  const exportList = [
    { key: 'customers', label: 'Customer Master List', desc: 'All unique customers with their details', file: 'customers_master.xlsx', icon: '👥', color: 'var(--accent)' },
    { key: 'properties', label: 'Property Master List', desc: 'All ownership records (no duplicates)', file: 'properties_master.xlsx', icon: '🏢', color: 'var(--success)' },
    { key: 'duplicates', label: 'Duplicates Report', desc: 'All ownership records flagged as duplicates', file: 'duplicates_report.xlsx', icon: '⚠️', color: 'var(--danger)' },
  ];

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Exports</h1>
          <p className="page-subtitle">Download master data as Excel files</p>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 16, maxWidth: 700 }}>
        {exportList.map(e => (
          <div key={e.key} className="card" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: '2.5rem', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg3)', borderRadius: 12, flexShrink: 0 }}>
              {e.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{e.label}</div>
              <div className="text-sm text-muted mt-8">{e.desc}</div>
            </div>
            <button
              className="btn btn-ghost"
              style={{ flexShrink: 0, borderColor: e.color, color: e.color }}
              onClick={() => dl(e.key, e.file)}
              disabled={loading === e.key}
            >
              {loading === e.key ? '⏳ Exporting…' : '⬇ Download .xlsx'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UsersPage() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer' });
  const [saving, setSaving] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => { api.get('/auth/users').then(r => setUsers(r.data)).catch(() => { }); }, []);

  const createUser = async () => {
    setSaving(true);
    try {
      const { data } = await api.post('/auth/users', form);
      setUsers(u => [data, ...u]);
      setShowModal(false);
      setForm({ name: '', email: '', password: '', role: 'viewer' });
      toast.success('User created');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed');
    }
    setSaving(false);
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    await api.delete(`/auth/users/${id}`);
    setUsers(u => u.filter(x => x.id !== id));
    toast.success('User deleted');
  };

  const openResetModal = (user) => {
    setResetTarget(user);
    setNewPassword('');
    setShowResetModal(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setResetting(true);
    try {
      await api.put(`/auth/users/${resetTarget.id}/password`, { newPassword });
      toast.success(`Password reset for ${resetTarget.name}`);
      setShowResetModal(false);
      setResetTarget(null);
      setNewPassword('');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to reset password');
    }
    setResetting(false);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Control access and roles</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add User</button>
      </div>
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="highlight">{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-yellow' : u.role === 'operator' ? 'badge-blue' : 'badge-gray'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openResetModal(u)}>🔑 Reset Password</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Create User</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {['name', 'email', 'password'].map(f => (
              <div className="input-group" key={f}>
                <label className="input-label">{f}</label>
                <input
                  className="input"
                  type={f === 'password' ? 'password' : 'text'}
                  value={form[f]}
                  onChange={e => setForm({ ...form, [f]: e.target.value })}
                />
              </div>
            ))}
            <div className="input-group">
              <label className="input-label">Role</label>
              <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="flex gap-8 mt-16">
              <button className="btn btn-primary" onClick={createUser} disabled={saving}>
                {saving ? 'Creating…' : 'Create User'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showResetModal && resetTarget && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Reset Password</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowResetModal(false)}>✕</button>
            </div>
            <p style={{ marginTop: 0, marginBottom: 16, color: 'var(--text2)', fontSize: '0.9rem' }}>
              Setting new password for <strong>{resetTarget.name}</strong> ({resetTarget.email})
            </p>
            <div className="input-group">
              <label className="input-label">New Password</label>
              <input
                className="input"
                type="password"
                placeholder="Min. 6 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-8 mt-16">
              <button className="btn btn-primary" onClick={handleResetPassword} disabled={resetting}>
                {resetting ? 'Resetting…' : 'Reset Password'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowResetModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export function AccountPage() {
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const roleColors = { admin: 'badge-yellow', operator: 'badge-blue', viewer: 'badge-gray' };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      await api.put('/auth/me/password', { currentPassword, newPassword });
      toast.success('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    }
    setSaving(false);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Account</h1>
          <p className="page-subtitle">Manage your profile and security settings</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="card mb-16" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '8px 0' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--primary, #4f8ef7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: 700, color: '#fff', flexShrink: 0
          }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>{user?.name}</div>
            <div style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: 8 }}>{user?.email}</div>
            <span className={`badge ${roleColors[user?.role] || 'badge-gray'}`}>{user?.role}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout} style={{ color: 'var(--danger)' }}>
            Sign Out
          </button>
        </div>

        <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</div>
            <div style={{ fontWeight: 500 }}>{user?.name}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</div>
            <div style={{ fontWeight: 500 }}>{user?.email}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Access Role</div>
            <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>{user?.role}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account ID</div>
            <div style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text2)' }}>{user?.id?.slice(0, 8)}…</div>
          </div>
        </div>

        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg3)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text2)' }}>
          🔒 Your account credentials are private. Other users cannot see your password or personal details.
        </div>
      </div>

      {/* Change Password Card */}
      <div className="card">
        <h2 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>Change Password</h2>
        <p style={{ margin: '0 0 20px', color: 'var(--text2)', fontSize: '0.9rem' }}>
          Update your password. You'll need your current password to confirm the change.
        </p>

        <form onSubmit={handleChangePassword} style={{ maxWidth: 400 }}>
          <div className="input-group">
            <label className="input-label">Current Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showCurrent ? 'text' : 'password'}
                style={{ paddingRight: 40 }}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}>
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showNew ? 'text' : 'password'}
                style={{ paddingRight: 40 }}
                placeholder="Min. 6 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}>
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Confirm New Password</label>
            <input
              className="input"
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 4 }}>Passwords do not match</div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving || (confirmPassword && newPassword !== confirmPassword)}>
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
