import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Phone, Mail, Globe, FileText, Edit2, Save, X, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from "../context/AuthContext";

// ── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmModal({ name, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 'var(--radius-lg)', padding: '32px 36px',
        maxWidth: 400, width: '90%', boxShadow: 'var(--shadow)', textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(255,77,77,0.12)', border: '1px solid rgba(255,77,77,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <AlertTriangle size={22} color="var(--danger)" />
        </div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', marginBottom: 8 }}>
          Delete Customer?
        </h3>
        <p style={{ color: 'var(--text2)', fontSize: '0.875rem', marginBottom: 24, lineHeight: 1.6 }}>
          Permanently delete <strong style={{ color: 'var(--text)' }}>{name || 'this customer'}</strong> and all
          their property records? This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{
            padding: '9px 22px', background: 'var(--bg3)',
            border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)',
            color: 'var(--text2)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '9px 22px', background: 'var(--danger)', border: 'none',
            borderRadius: 'var(--radius-sm)', color: '#fff',
            cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
          }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [customer, setCustomer] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    api.get(`/customers/${id}`)
      .then(r => {
        setCustomer(r.data);
        setForm({
          name: r.data.name || '',
          phone: r.data.phone || '',
          email: r.data.email || '',
          nationality: r.data.nationality || '',
        });
      })
      .catch(() => navigate('/search'));
  }, [id]);

  const handleEdit = () => setEditing(true);

  const handleCancel = () => {
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      nationality: customer.nationality || '',
    });
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/customers/${id}`, {
        name: form.name || null,
        phone: form.phone || null,
        email: form.email || null,
        nationality: form.nationality || null,
      });
      setCustomer(c => ({ ...c, ...data }));
      setEditing(false);
      toast.success('Customer updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setShowConfirm(false);
    setDeleting(true);
    try {
      await api.delete(`/customers/${id}`);
      toast.success('Customer deleted');
      navigate(-1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
      setDeleting(false);
    }
  };

  if (!customer) return (
    <div className="fade-in" style={{ textAlign: 'center', padding: 64 }}>
      <div className="pulse text-muted">Loading…</div>
    </div>
  );

  const canEdit = ['admin', 'operator'].includes(user?.role);
  const canDelete = user?.role === 'admin';

  const FIELDS = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'nationality', label: 'Nationality' },
  ];

  return (
    <div className="fade-in">
      {showConfirm && (
        <ConfirmModal
          name={customer.name}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <button className="btn btn-ghost btn-sm mb-24" onClick={() => navigate(-1)}>
        <ArrowLeft size={14} /> Back
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>

        {/* ── Left: Customer Info ── */}
        <div className="card">
          {/* Avatar + actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--accent-dim)', border: '2px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent)',
            }}>
              {(customer.name || '?')[0]}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {canEdit && !editing && (
                <button className="btn btn-ghost btn-sm" onClick={handleEdit}>
                  <Edit2 size={14} /> Edit
                </button>
              )}
              {canDelete && !editing && (
                <button
                  className="btn btn-sm"
                  disabled={deleting}
                  onClick={() => setShowConfirm(true)}
                  style={{
                    background: 'rgba(255,77,77,0.1)',
                    border: '1px solid rgba(255,77,77,0.3)',
                    color: 'var(--danger)',
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                  }}
                >
                  <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
          </div>

          {/* Customer ID badge */}
          <code style={{
            fontSize: '0.72rem', color: 'var(--accent)',
            background: 'var(--accent-dim)', padding: '3px 8px', borderRadius: 4,
          }}>
            {customer.customer_id}
          </code>

          {/* Form / Read view */}
          {editing ? (
            <div style={{ marginTop: 16 }}>
              {FIELDS.map(f => (
                <div className="input-group" key={f.key}>
                  <label className="input-label">{f.label}</label>
                  <input
                    className="input"
                    value={form[f.key]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  />
                </div>
              ))}
              <div className="flex gap-8 mt-16">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save size={14} /> {saving ? 'Saving…' : 'Save'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleCancel}>
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>
                {customer.name || 'Unknown'}
              </h2>
              {customer.phone && (
                <div className="flex items-center gap-8 text-sm text-muted">
                  <Phone size={14} />{customer.phone}
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-8 text-sm text-muted">
                  <Mail size={14} />{customer.email}
                </div>
              )}
              {customer.nationality && (
                <div className="flex items-center gap-8 text-sm text-muted">
                  <Globe size={14} />{customer.nationality}
                </div>
              )}
              <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div className="text-xs text-muted">
                  Member since {new Date(customer.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Properties ── */}
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 16, fontSize: '1rem' }}>
            <Building2 size={16} style={{ display: 'inline', marginRight: 8, color: 'var(--accent)' }} />
            Properties ({customer.properties?.filter(p => !p.is_duplicate).length || 0})
          </h3>

          {(!customer.properties || customer.properties.length === 0) ? (
            <p className="text-muted text-sm">No properties found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {customer.properties.map(p => (
                <div key={p.id} style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg3)',
                  border: `1px solid ${p.is_duplicate ? 'rgba(255,77,77,0.2)' : 'var(--border)'}`,
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px',
                }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Project</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.project || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Unit</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.unit || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</div>
                    <div className="text-sm">{p.unit_type || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reg. Date</div>
                    <div className="text-sm">{p.registration_date || '—'}</div>
                  </div>
                  <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <div className="flex items-center gap-8 text-xs text-muted">
                      <FileText size={11} />{p.source_file_name || 'Unknown source'}
                    </div>
                    {p.is_duplicate && <span className="badge badge-red">Duplicate</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
