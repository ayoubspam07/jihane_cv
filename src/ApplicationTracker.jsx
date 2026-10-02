import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const STATUSES = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

const TEXT = {
  fr: {
    heading: 'Suivi des candidatures',
    subtitle: 'Enregistrez vos candidatures. Le CV par défaut est ajouté automatiquement.',
    add: 'Nouvelle candidature',
    title: 'Intitulé du poste',
    company: 'Entreprise',
    url: 'Lien de l’offre',
    jobDescription: 'Description du poste',
    resumeJson: 'JSON du CV utilisé',
    status: 'Statut',
    save: 'Enregistrer',
    cancel: 'Annuler',
    empty: 'Aucune candidature pour le moment.',
    close: 'Fermer',
    download: 'Télécharger le CV',
    delete: 'Supprimer',
    open: 'Voir l’offre',
    required: 'L’intitulé et l’entreprise sont obligatoires.',
    loadError: 'Le suivi des candidatures est temporairement indisponible. Vérifiez votre connexion et réessayez.',
    saveError: 'Votre modification n’a pas été enregistrée. Vérifiez votre connexion puis réessayez ; vos informations sont toujours affichées.',
    deleteError: 'Cette candidature n’a pas été supprimée. Réessayez dans un instant.',
    search: 'Rechercher un poste ou une entreprise…',
    allStatuses: 'Tous les statuts',
    date: 'Date de candidature',
    noMatch: 'Aucune candidature ne correspond aux filtres.',
    edit: 'Modifier',
    location: 'Localisation',
    contractType: 'Type de contrat',
    summary: 'Résumé',
    missions: 'Missions, une par ligne',
    requirements: 'Exigences, une par ligne',
    missingProfile: 'Ce qui manque à mon profil',
    qualified: 'Profil qualifié',
    assessment: 'Évaluation',
  },
  en: {
    heading: 'Application Tracker',
    subtitle: 'Save your applications. The default resume is attached automatically.',
    add: 'New application',
    title: 'Job title',
    company: 'Company',
    url: 'Job posting URL',
    jobDescription: 'Job description',
    resumeJson: 'Resume JSON used',
    status: 'Status',
    save: 'Save',
    cancel: 'Cancel',
    empty: 'No applications yet.',
    close: 'Close',
    download: 'Download resume',
    delete: 'Delete',
    open: 'Open posting',
    required: 'Title and company are required.',
    loadError: 'Applications are temporarily unavailable. Check your connection and try again.',
    saveError: 'Your change was not saved. Check your connection and try again; your information is still shown here.',
    deleteError: 'This application was not deleted. Please try again.',
    search: 'Search by job title or company…',
    allStatuses: 'All statuses',
    date: 'Applied on',
    noMatch: 'No applications match your filters.',
    edit: 'Edit',
    location: 'Location',
    contractType: 'Contract type',
    summary: 'Summary',
    missions: 'Missions, one per line',
    requirements: 'Requirements, one per line',
    missingProfile: 'Profile gaps',
    qualified: 'Qualified profile',
    assessment: 'Assessment',
  },
};

const emptyForm = {
  title: '',
  company: '',
  url: '',
  jobDescription: '',
  status: 'Saved',
};

function StatusBadge({ status }) {
  return <span className={`trk-badge trk-badge--${status.toLowerCase()}`}>{status}</span>;
}

function formatDate(iso, locale) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function downloadResume(app) {
  const raw = app.resumeJson || '';
  let content = raw;
  try {
    content = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    // Not valid JSON; download the raw text as-is.
  }
  const safe = `${app.company}-${app.title}`.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  const blob = new Blob([content], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `resume-${safe || 'application'}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function ApplicationForm({ t, onCancel, onSaved, defaultResume }) {
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    resumeJson: JSON.stringify(defaultResume, null, 2),
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.title.trim() || !form.company.trim()) {
      setError(t.required);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, resumeJson: JSON.stringify(defaultResume, null, 2) }),
      });
      if (!res.ok) throw new Error('save failed');
      const created = await res.json();
      onSaved(created);
      setForm({ ...emptyForm, resumeJson: JSON.stringify(defaultResume, null, 2) });
    } catch {
      setError(t.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="trk-form" onSubmit={handleSubmit}>
      <div className="trk-form-grid">
        <label className="trk-field">
          <span>{t.title} *</span>
          <input value={form.title} onChange={(e) => update('title', e.target.value)} required />
        </label>
        <label className="trk-field">
          <span>{t.company} *</span>
          <input value={form.company} onChange={(e) => update('company', e.target.value)} required />
        </label>
        <label className="trk-field">
          <span>{t.url}</span>
          <input type="url" value={form.url} onChange={(e) => update('url', e.target.value)} placeholder="https://" />
        </label>
      </div>
      {error && <p className="trk-error">{error}</p>}
      <div className="trk-form-actions">
        <button type="button" className="trk-btn" onClick={onCancel}>
          {t.cancel}
        </button>
        <button type="submit" className="trk-btn trk-btn--primary" disabled={saving}>
          {t.save}
        </button>
      </div>
    </form>
  );
}

function DetailModal({ t, app, error, onClose, onStatusChange, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(app);

  useEffect(() => setDraft(app), [app]);

  function update(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    if (await onSave(draft)) setEditing(false);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="trk-modal-overlay" onClick={onClose} role="presentation">
      <div className="trk-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="trk-modal-head">
          <div>
            <h2 className="trk-modal-title">{app.title}</h2>
            <p className="trk-modal-company">{app.company}</p>
          </div>
          <button type="button" className="trk-icon-btn" onClick={onClose} aria-label={t.close}>
            <FontAwesomeIcon icon={['fas', 'xmark']} />
          </button>
        </header>

        <div className="trk-modal-body">
          {error && <p className="trk-error" role="alert">{error}</p>}
          {editing ? (
            <div className="trk-edit-form">
              <div className="trk-form-grid">
                <label className="trk-field"><span>{t.title} *</span><input value={draft.title ?? ''} onChange={(e) => update('title', e.target.value)} /></label>
                <label className="trk-field"><span>{t.company} *</span><input value={draft.company ?? ''} onChange={(e) => update('company', e.target.value)} /></label>
                <label className="trk-field"><span>{t.url}</span><input type="url" value={draft.url ?? ''} onChange={(e) => update('url', e.target.value)} /></label>
                <label className="trk-field"><span>{t.location}</span><input value={draft.location ?? ''} onChange={(e) => update('location', e.target.value)} /></label>
                <label className="trk-field"><span>{t.contractType}</span><input value={draft.contractType ?? ''} onChange={(e) => update('contractType', e.target.value)} /></label>
                <label className="trk-field"><span>{t.status}</span><select value={draft.status ?? 'Saved'} onChange={(e) => update('status', e.target.value)}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
                <label className="trk-field"><span>{t.score}</span><input type="number" min="0" max="100" value={draft.matchScore ?? ''} onChange={(e) => update('matchScore', e.target.value === '' ? null : Number(e.target.value))} /></label>
                <label className="trk-field trk-check-field"><input type="checkbox" checked={draft.qualified === true} onChange={(e) => update('qualified', e.target.checked)} /><span>{t.qualified}</span></label>
              </div>
              <label className="trk-field"><span>{t.summary}</span><textarea rows="3" value={draft.summary ?? ''} onChange={(e) => update('summary', e.target.value)} /></label>
              <label className="trk-field"><span>{t.missions}</span><textarea rows="4" value={(draft.missions ?? []).join('\n')} onChange={(e) => update('missions', e.target.value.split('\n').map((value) => value.trim()).filter(Boolean))} /></label>
              <label className="trk-field"><span>{t.requirements}</span><textarea rows="4" value={(draft.requirements ?? []).join('\n')} onChange={(e) => update('requirements', e.target.value.split('\n').map((value) => value.trim()).filter(Boolean))} /></label>
              <label className="trk-field"><span>{t.jobDescription}</span><textarea rows="6" value={draft.jobDescription ?? ''} onChange={(e) => update('jobDescription', e.target.value)} /></label>
              <label className="trk-field"><span>{t.missingProfile}</span><textarea rows="4" value={draft.missingProfile ?? ''} onChange={(e) => update('missingProfile', e.target.value)} /></label>
              <label className="trk-field"><span>{t.assessment}</span><textarea rows="3" value={draft.assessment ?? ''} onChange={(e) => update('assessment', e.target.value)} /></label>
            </div>
          ) : (<>
          <div className="trk-detail-row">
            <span className="trk-detail-label">{t.status}</span>
            <select
              className="trk-status-select"
              value={app.status}
              onChange={(e) => onStatusChange(app.id, e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {app.createdAt && (
            <div className="trk-detail-row">
              <span className="trk-detail-label">{t.date}</span>
              <span className="trk-detail-value">{formatDate(app.createdAt, t === TEXT.fr ? 'fr' : 'en')}</span>
            </div>
          )}

          {app.url && (
            <div className="trk-detail-row">
              <span className="trk-detail-label">{t.url}</span>
              <a className="trk-link" href={app.url} target="_blank" rel="noreferrer">
                {t.open} <FontAwesomeIcon icon={['fas', 'arrow-up-right-from-square']} />
              </a>
            </div>
          )}

          {app.jobDescription && (
            <div className="trk-detail-block">
              <span className="trk-detail-label">{t.jobDescription}</span>
              <p className="trk-detail-text">{app.jobDescription}</p>
            </div>
          )}

          {app.missingProfile && (
            <div className="trk-detail-block">
              <span className="trk-detail-label">{t.missingProfile}</span>
              <p className="trk-detail-text">{app.missingProfile}</p>
            </div>
          )}

          {app.resumeJson && (
            <div className="trk-detail-block">
              <span className="trk-detail-label">{t.resumeJson}</span>
              <pre className="trk-detail-json">{app.resumeJson}</pre>
            </div>
          )}
          </>)}
        </div>

        <footer className="trk-modal-foot">
          <button type="button" className="trk-btn trk-btn--danger" onClick={() => onDelete(app.id)}>
            <FontAwesomeIcon icon={['fas', 'trash']} /> {t.delete}
          </button>
          {editing ? (
            <>
              <button type="button" className="trk-btn" onClick={() => { setDraft(app); setEditing(false); }}>{t.cancel}</button>
              <button type="button" className="trk-btn trk-btn--primary" onClick={save} disabled={!draft.title?.trim() || !draft.company?.trim()}><FontAwesomeIcon icon={['fas', 'floppy-disk']} /> {t.save}</button>
            </>
          ) : (
            <button type="button" className="trk-btn" onClick={() => setEditing(true)}><FontAwesomeIcon icon={['fas', 'pen-to-square']} /> {t.edit}</button>
          )}
          <button
            type="button"
            className="trk-btn trk-btn--primary"
            onClick={() => downloadResume(app)}
            disabled={!app.resumeJson}
          >
            <FontAwesomeIcon icon={['fas', 'download']} /> {t.download}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ApplicationTracker({ locale = 'en', defaultResume, refreshKey = 0, onOpenApplication }) {
  const t = TEXT[locale] ?? TEXT.en;
  const [apps, setApps] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  async function load() {
    try {
      const res = await fetch('/api/applications');
      if (!res.ok) throw new Error('load failed');
      setApps(await res.json());
      setError('');
    } catch {
      setError(t.loadError);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  function handleSaved(created) {
    setApps((prev) => [created, ...prev]);
    setShowForm(false);
  }

  async function handleStatusChange(id, status) {
    const target = apps.find((a) => a.id === id);
    if (!target) return;
    const updated = { ...target, status };
    setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    setSelected((prev) => (prev && prev.id === id ? updated : prev));
    setError('');
    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (!response.ok) throw new Error('update failed');
    } catch {
      setApps((prev) => prev.map((app) => app.id === id ? target : app));
      setSelected((prev) => (prev && prev.id === id ? target : prev));
      setError(t.saveError);
    }
  }

  async function handleUpdate(updated) {
    setError('');
    try {
      const res = await fetch(`/api/applications/${updated.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error('update failed');
      const saved = await res.json();
      setApps((prev) => prev.map((app) => app.id === saved.id ? saved : app));
      setSelected(saved);
      return true;
    } catch {
      setError(t.saveError);
      return false;
    }
  }

  async function handleDelete(id) {
    setError('');
    try {
      const response = await fetch(`/api/applications/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('delete failed');
      setApps((prev) => prev.filter((app) => app.id !== id));
      setSelected(null);
    } catch {
      setError(t.deleteError);
    }
  }

  const query_ = query.trim().toLowerCase();
  const filtered = apps.filter((a) => {
    const matchesQuery =
      !query_ ||
      a.title.toLowerCase().includes(query_) ||
      a.company.toLowerCase().includes(query_);
    const matchesStatus = statusFilter === 'All' || a.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="trk">
      <header className="trk-header">
        <div>
          <h1 className="trk-heading">{t.heading}</h1>
          <p className="trk-subtitle">{t.subtitle}</p>
        </div>
        <button type="button" className="trk-btn trk-btn--primary" onClick={() => setShowForm((v) => !v)}>
          <FontAwesomeIcon icon={['fas', showForm ? 'xmark' : 'plus']} /> {t.add}
        </button>
      </header>

      {error && !selected && <p className="trk-error" role="alert">{error}</p>}

      {showForm && <ApplicationForm t={t} onCancel={() => setShowForm(false)} onSaved={handleSaved} defaultResume={defaultResume} />}

      {apps.length > 0 && (
        <div className="trk-toolbar">
          <div className="trk-search">
            <FontAwesomeIcon icon={['fas', 'magnifying-glass']} className="trk-search-icon" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.search}
            />
          </div>
          <select
            className="trk-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">{t.allStatuses}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {apps.length === 0 ? (
        <p className="trk-empty">{t.empty}</p>
      ) : filtered.length === 0 ? (
        <p className="trk-empty">{t.noMatch}</p>
      ) : (
        <ul className="trk-list">
          {filtered.map((app) => (
            <li key={app.id}>
                <button type="button" className="trk-item" onClick={() => onOpenApplication ? onOpenApplication(app) : setSelected(app)}>
                <span className="trk-item-main">
                  <span className="trk-item-title">{app.title}</span>
                  <span className="trk-item-company">{app.company}</span>
                  {app.createdAt && (
                    <span className="trk-item-date">
                      <FontAwesomeIcon icon={['fas', 'calendar-day']} /> {formatDate(app.createdAt, locale)}
                    </span>
                  )}
                </span>
                <span className="trk-item-side">
                  {typeof app.matchScore === 'number' && (
                    <span
                      className={`trk-score ${
                        app.matchScore >= 60 ? 'is-ok' : app.matchScore >= 35 ? 'is-warn' : 'is-bad'
                      }`}
                    >
                      {app.matchScore}%
                    </span>
                  )}
                  <StatusBadge status={app.status} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <DetailModal
          t={t}
          app={selected}
          error={error}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          onSave={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

export default ApplicationTracker;
