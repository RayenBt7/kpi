/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import '../styles/Plan_action.css';

const MONTHS = [
  { value: 1, label: 'Janvier' },
  { value: 2, label: 'Février' },
  { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' },
  { value: 8, label: 'Août' },
  { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Décembre' },
];

const EFFICIENCY_OPTIONS = [
  { value: '', label: 'Sélectionner...' },
  { value: '0%', label: '0%' },
  { value: '25%', label: '25%' },
  { value: '50%', label: '50%' },
  { value: '75%', label: '75%' },
  { value: '100%', label: '100%' },
];

const hasFilledValue = (value) => String(value ?? '').trim().length > 0;
const normalizeResponsableValue = (value) => {
  const trimmed = String(value ?? '').trim();
  return trimmed === '-' ? '' : trimmed;
};

const computeConformityProgress = (data) => {
  if (!hasFilledValue(data.rootCause) || !hasFilledValue(data.action)) {
    return 0;
  }

  if (!hasFilledValue(data.responsable)) {
    return 25;
  }

  if (!hasFilledValue(data.dateclotprevu) || !hasFilledValue(data.datecreation)) {
    return 50;
  }

  if (!hasFilledValue(data.efficacit)) {
    return 75;
  }

  return 100;
};

// Progress smileys based on conformity progress
const getProgressSmileys = (progress) => {
  const normalizedProgress = Number.isFinite(Number(progress)) ? Number(progress) : 0;
  const greenCount = Math.round(normalizedProgress / 25);
  const redCount = 4 - greenCount;
  
  return {
    green: '😀'.repeat(greenCount),
    red: '😔'.repeat(redCount),
    percentage: normalizedProgress
  };
};

// Get progress intensity based on conformity progress
const getProgressIntensity = (progress) => {
  const normalizedProgress = Number.isFinite(Number(progress)) ? Number(progress) : 0;
  return normalizedProgress;
};

function Plan_action({ theme = 'dark', authUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const monthFromUrl = searchParams.get('month');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Permission state
  const [permissions, setPermissions] = useState({ isAdmin: false, indicators: [] });
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  
  // Form data
  const [formData, setFormData] = useState({
    Indicateur: '',
    Designation: '',
    processus: '',
    annee: new Date().getFullYear(),
    mois: new Date().getMonth() + 1,
    rootCause: '',
    action: '',
    responsable: '',
    dateclotprevu: '',
    dateclot: '',
    datecreation: new Date().toISOString().split('T')[0],
    efficacit: '',
    PROGRESS: 0
  });
  
  // Dropdown options
  const [responsables, setResponsables] = useState([]);
  const [existingAction, setExistingAction] = useState(null);
  
  // Load plan-action responsables from dbo.responsable for the same indicator
  const loadResponsables = useCallback(async (indicatorCode, fallbackResponsable = '') => {
    const trimmedIndicator = String(indicatorCode ?? '').trim();

    if (!trimmedIndicator) {
      setResponsables(
        normalizeResponsableValue(fallbackResponsable) ? [normalizeResponsableValue(fallbackResponsable)] : []
      );
      return;
    }

    try {
      const response = await api.get(
        `/api/dashboard/action-responsables?indicateur=${encodeURIComponent(trimmedIndicator)}`
      );
      const options = Array.isArray(response.data)
        ? response.data
          .map((row) => String(row?.responsable ?? '').trim())
          .filter(Boolean)
        : [];

      setResponsables(
        [...new Set([fallbackResponsable, ...options]
          .map((value) => normalizeResponsableValue(value))
          .filter(Boolean))]
      );
    } catch (err) {
      console.error('Error loading responsables:', err);
      setResponsables(
        normalizeResponsableValue(fallbackResponsable) ? [normalizeResponsableValue(fallbackResponsable)] : []
      );
    }
  }, []);
  
  // Fetch user permissions on mount
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const response = await api.get('/api/dashboard/my-editable-indicators');
        setPermissions({
          isAdmin: response.data.isAdmin === true,
          indicators: Array.isArray(response.data.indicators) ? response.data.indicators : []
        });
      } catch (err) {
        console.error('Error fetching permissions:', err);
        setPermissions({ isAdmin: false, indicators: [] });
      } finally {
        setIsLoadingPermissions(false);
      }
    };
    
    fetchPermissions();
  }, []);

  // Check if user can edit the current indicator based on permissions
  // Check if user can edit the current indicator based on permissions
const canEdit = useMemo(() => {
    // Admin can always edit
    if (permissions.isAdmin) {
        return true;
    }
    
    // Get the current indicator - try formData first, then URL param
    const currentIndicator = formData.Indicateur || (id ? decodeURIComponent(id) : '');
    if (!currentIndicator) {
        return false;
    }
    
    // Normalize: trim whitespace and convert to lowercase
    const normalize = (str) => String(str || '').trim().toLowerCase();
    const normalizedIndicator = normalize(currentIndicator);
    
    // Check if ANY permission matches (processus OR indicateur)
    const hasPermission = permissions.indicators.some(permIndicator => 
        normalize(permIndicator) === normalizedIndicator
    );
    
    console.log('Permission check:', {
        currentIndicator,
        normalizedIndicator,
        permissions: permissions.indicators,
        hasPermission
    });
    
    return hasPermission;
}, [permissions, formData.Indicateur, id]);

  // Load action plan by ID
  const loadActionPlan = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setExistingAction(null);
      setResponsables([]);
      // Decode the ID which contains indicator info
      const decodedId = decodeURIComponent(id);
      
      // Try to get pending indicators and find matching one
      const response = await api.get('/api/dashboard/plan-action/pending');
      const pendingData = response.data.rows || [];
      
      // Find the matching indicator (we use the encoded indicator name)
      const matchedIndicator = pendingData.find(row => 
        encodeURIComponent(row.Indicateur || '') === id ||
        row.Indicateur === decodedId
      );
      
      if (matchedIndicator) {
        const matchedResponsable = normalizeResponsableValue(
          matchedIndicator.actionResponsable || matchedIndicator.responsable || ''
        );

        setFormData(prev => ({
          ...prev,
          Indicateur: matchedIndicator.Indicateur || '',
          Designation: matchedIndicator.Designation || '',
          processus: matchedIndicator.Processus || '',
          annee: matchedIndicator.annee ? parseInt(matchedIndicator.annee) : new Date().getFullYear(),
          mois: matchedIndicator.mois ? parseInt(matchedIndicator.mois) : new Date().getMonth() + 1,
          rootCause: matchedIndicator.rootCause || '',
          action: matchedIndicator.action || '',
          responsable: matchedResponsable,
          dateclotprevu: matchedIndicator.dateclotprevu || '',
          dateclot: matchedIndicator.dateclot || '',
          datecreation: matchedIndicator.datecreation || new Date().toISOString().split('T')[0],
          efficacit: matchedIndicator.efficacit || '',
          PROGRESS: matchedIndicator.PROGRESS || 0
        }));
        
        // Check if there's an existing action in the Plan_action table for the current year
        // Note: For Profile navigation, we always create new action (no update mode)
        const isFromProfile = window.location.pathname.startsWith('/plan-action/');
        const currentYear = new Date().getFullYear();
        
        // Convert month key from URL to month number (1-12)
        const MONTH_KEY_TO_NUMBER = {
          'janv': 1, 'fev': 2, 'mars': 3, 'avril': 4, 'mai': 5, 'juin': 6,
          'juil': 7, 'aout': 8, 'sept': 9, 'oct': 10, 'nov': 11, 'decem': 12
        };
        const selectedMonthNum = monthFromUrl ? (MONTH_KEY_TO_NUMBER[monthFromUrl] || new Date().getMonth() + 1) : new Date().getMonth() + 1;
        
        // If navigating from Profile, always create new action (skip existing action check)
        if (isFromProfile) {
          console.log('Navigating from Profile - Create mode only');
          setFormData(prev => ({
            ...prev,
            Indicateur: matchedIndicator.Indicateur || '',
            Designation: matchedIndicator.Designation || '',
            processus: matchedIndicator.Processus || '',
            annee: currentYear,
            mois: selectedMonthNum,
            rootCause: '',
            action: '',
            responsable: normalizeResponsableValue(matchedResponsable),
            dateclotprevu: '',
            dateclot: '',
            datecreation: new Date().toISOString().split('T')[0],
          }));
          await loadResponsables(matchedIndicator.Indicateur, matchedResponsable);
          setLoading(false);
          return;
        }
        
        // For KPI page: Check if there's an existing action
        try {
          const actionResponse = await api.get(`/api/actions/indicateur/${encodeURIComponent(matchedIndicator.Indicateur)}?year=${currentYear}`);
          if (actionResponse.data && actionResponse.data.length > 0) {
            const existing = actionResponse.data[0];
            setExistingAction(existing);
            setFormData({
              Indicateur: existing.Indicateur || matchedIndicator.Indicateur || '',
              Designation: existing.Designation || matchedIndicator.Designation || '',
              processus: matchedIndicator.Processus || '',
              annee: existing.annee || new Date().getFullYear(),
              mois: existing.mois || new Date().getMonth() + 1,
              rootCause: existing.rootCause || '',
              action: existing.action || '',
              responsable: normalizeResponsableValue(existing.responsable || matchedResponsable),
              dateclotprevu: existing.dateclotprevu ? existing.dateclotprevu.split('T')[0] : '',
              dateclot: existing.dateclot ? existing.dateclot.split('T')[0] : '',
              datecreation: existing.datecreation ? existing.datecreation.split('T')[0] : new Date().toISOString().split('T')[0],
              efficacit: existing.efficacit || '',
              PROGRESS: existing.PROGRESS || 0
            });
            await loadResponsables(
              existing.Indicateur || matchedIndicator.Indicateur,
              normalizeResponsableValue(existing.responsable || matchedResponsable)
            );
          } else {
            await loadResponsables(matchedIndicator.Indicateur, matchedResponsable);
          }
        } catch (e) {
          console.log('No existing action found');
          await loadResponsables(matchedIndicator.Indicateur, matchedResponsable);
        }
      } else {
        // Try to decode the ID as indicator name directly
        setFormData(prev => ({
          ...prev,
          Indicateur: decodedId
        }));
        await loadResponsables(decodedId, '');
      }
    } catch (err) {
      console.error('Error loading action plan:', err);
      setError('Erreur lors du chargement du plan d\'action');
    } finally {
      setLoading(false);
    }
  }, [id, loadResponsables]);
  
  useEffect(() => {
    loadActionPlan();
  }, [loadActionPlan]);
  
  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const computedProgress = computeConformityProgress(formData);
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    
    try {
      const payload = {
        ...formData,
        annee: parseInt(formData.annee),
        mois: parseInt(formData.mois),
        PROGRESS: computedProgress
      };
      
      if (existingAction) {
        // Update existing action - use indicateur as identifier
        await api.put(`/api/actions/${encodeURIComponent(formData.Indicateur)}`, payload);
        setSuccess('Plan d\'action mis à jour avec succès');
      } else {
        // Create new action
        await api.post('/api/actions', payload);
        setSuccess('Plan d\'action créé avec succès');
      }
      
      // Refresh data
      loadActionPlan();
    } catch (err) {
      console.error('Error saving action plan:', err);
      setError(err.response?.data?.details || err.response?.data?.error || 'Erreur lors de la sauvegarde du plan d\'action');
    } finally {
      setSaving(false);
    }
  };
  
  // Handle go back
  const handleGoBack = () => {
    navigate('/dashboard');
  };
  
  // Get progress visualization
  const progressVisual = getProgressSmileys(computedProgress);
  const progressIntensity = getProgressIntensity(computedProgress);
  
  // Show loading while either data or permissions are loading
  if (loading || isLoadingPermissions) {
    return (
      <div className="dashboard-page" data-theme={theme}>
        <div className="dashboard-loading">
          <p>Chargement du plan d'action...</p>
        </div>
      </div>
    );
  }
  
   // Show access denied message if user doesn't have permission
if (!canEdit && !loading && formData.Indicateur) {
    return (
        <div className="dashboard-page plan-action-page" data-theme={theme}>
            <div className="plan-action-container">
                <div className="permission-denied" style={{
                    padding: '40px',
                    textAlign: 'center',
                    background: '#fee2e2',
                    borderRadius: '8px',
                    margin: '20px'
                }}>
                    <h2 style={{color: '#dc2626'}}>🚫 Accès refusé</h2>
                    <p style={{color: '#7f1d1d'}}>
                        Vous n'avez pas la permission de modifier ce plan d'action.
                    </p>
                    <p style={{color: '#7f1d1d'}}>
                        <strong>Indicateur :</strong> {formData.Designation || formData.Indicateur}
                    </p>
                    <p style={{color: '#7f1d1d', fontSize: '14px'}}>
                        Seul un utilisateur ayant une permission pour cet indicateur peut le modifier.
                    </p>
                    <button 
                        onClick={() => navigate('/dashboard')}
                        style={{
                            marginTop: '20px',
                            padding: '10px 20px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer'
                        }}
                    >
                        Retour au tableau de bord
                    </button>
                </div>
            </div>
        </div>
    );
}


  
  return (
    <div className="dashboard-page plan-action-page" data-theme={theme}>
      <div className="plan-action-container">
        {/* Header */}
        <div className="plan-action-header">
          <div className="plan-action-header-left">
            <button type="button" className="plan-action-back-btn" onClick={handleGoBack}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
              </svg>
              Retour
            </button>
            <h1>Plan d'Action</h1>
          </div>
          <div className="plan-action-header-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
            </svg>
            {existingAction ? 'Modification' : 'Nouveau'}
          </div>
        </div>
        
        {/* Info Banner */}
        <div className="plan-action-info">
          <div className="plan-action-info-item">
            <span className="plan-action-label">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Utilisateur
            </span>
            <span className="plan-action-value">{authUser?.userType || 'user'}</span>
          </div>
          <div className="plan-action-info-item">
            <span className="plan-action-label">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              Processus
            </span>
            <span className="plan-action-value">{formData.processus || '-'}</span>
          </div>
          <div className="plan-action-info-item">
            <span className="plan-action-label">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>
              </svg>
              Indicateur
            </span>
            <span className="plan-action-value">{formData.Indicateur || '-'}</span>
          </div>
          <div className="plan-action-info-item">
            <span className="plan-action-label">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/>
              </svg>
              Designation
            </span>
            <span className="plan-action-value">{formData.Designation || '-'}</span>
          </div>
          <div className="plan-action-info-item">
            <span className="plan-action-label">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
              Mois
            </span>
            <span className="plan-action-value">
              {MONTHS.find(m => m.value === parseInt(formData.mois))?.label || '-'}
            </span>
          </div>
          <div className="plan-action-info-item">
            <span className="plan-action-label">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
              Année
            </span>
            <span className="plan-action-value">{formData.annee}</span>
          </div>
        </div>
        
        {/* Error/Success Messages */}
        {error && (
          <div className="plan-action-message plan-action-error">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="plan-action-message plan-action-success">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            {success}
          </div>
        )}
        
        {/* Action Plan Form */}
        
        <form className="plan-action-form" onSubmit={handleSubmit}>
            
          <div className="plan-action-form-header">
            <h2 className="plan-action-form-title">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/>
              </svg>
              Détails du Plan d'Action
            </h2>
          </div>
          
          <div className="plan-action-form-grid">
            {/* Root Cause */}
            <div className="plan-action-field">
              <label htmlFor="rootCause">
                Root Cause <span className="required">*</span>
              </label>
              <textarea
                id="rootCause"
                name="rootCause"
                value={formData.rootCause}
                onChange={handleChange}
                placeholder="Décrivez la cause racine du problème..."
                rows={3}
                disabled={!canEdit}
              />
            </div>
            
            {/* Action */}
            <div className="plan-action-field">
              <label htmlFor="action">
                Action <span className="required">*</span>
              </label>
              <textarea
                id="action"
                name="action"
                value={formData.action}
                onChange={handleChange}
                placeholder="Décrivez l'action à mettre en place..."
                rows={3}
                disabled={!canEdit}
              />
            </div>
            
            {/* Responsable */}
            <div className="plan-action-field">
              <label htmlFor="responsable">
                Responsable <span className="required">*</span>
              </label>
              <select
                id="responsable"
                name="responsable"
                value={formData.responsable}
                onChange={handleChange}
                disabled={!canEdit}
              >
                <option value="">Sélectionner un responsable</option>
                {[...new Set([formData.responsable, ...responsables].filter(Boolean))].map((resp) => (
                  <option key={resp} value={resp}>{resp}</option>
                ))}
              </select>
            </div>
            
            {/* Date cloture prevue */}
            <div className="plan-action-field">
              <label htmlFor="dateclotprevu">Date de clôture prévue</label>
              <input
                type="date"
                id="dateclotprevu"
                name="dateclotprevu"
                value={formData.dateclotprevu}
                onChange={handleChange}
                disabled={!canEdit}
              />
            </div>
            
            {/* Date cloture  */}
            <div className="plan-action-field">
              <label htmlFor="dateclot">Date de clôture</label>
              <input
                type="date"
                id="dateclot"
                name="dateclot"
                value={formData.dateclot}
                onChange={handleChange}
                disabled={!canEdit}
              />
            </div>
            
            {/* Date creation */}
            <div className="plan-action-field">
              <label htmlFor="datecreation">Date de création</label>
              <input
                type="date"
                id="datecreation"
                name="datecreation"
                value={formData.datecreation}
                onChange={handleChange}
                disabled={!canEdit}
              />
            </div>
            
            {/* Efficacité */}
            <div className="plan-action-field">
              <label htmlFor="efficacit">Efficacité</label>
              <select
                id="efficacit"
                name="efficacit"
                value={formData.efficacit}
                onChange={handleChange}
                disabled={!canEdit}
              >
                {EFFICIENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Progress Visualization */}
          <div className="plan-action-progress-section">
            <h3>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
              </svg>
              Progression de la conformité
            </h3>
            <div className="plan-action-progress-container">
              <div className="plan-action-progress-bar">
                <div 
                  className="plan-action-progress-fill"
                  style={{ width: `${progressIntensity}%` }}
                />
              </div>
              <div className="plan-action-progress-smileys">
                <span className="progress-green">{progressVisual.green}</span>
                <span className="progress-red">{progressVisual.red}</span>
              </div>
              <div className="plan-action-progress-value">
                {progressVisual.percentage}%
              </div>
            </div>
            <div className="plan-action-progress-legend">
              <div className="plan-action-progress-legend-item">
                <span className="emoji">😀</span>
                <span>Conforme</span>
              </div>
              <div className="plan-action-progress-legend-item">
                <span className="emoji">😔</span>
                <span>Non conforme</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="plan-action-form-actions">
           <button 
              type="submit" 
              className="plan-action-submit-btn"
              disabled={!canEdit || saving}  // ← AJOUTER !canEdit
              title={!canEdit ? "Vous n'avez pas la permission de modifier cet indicateur" : ''}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              {!canEdit ? 'Accès refusé' : saving ? 'Enregistrement...' : existingAction ? 'Mettre à jour' : 'Créer le plan d\'action'}
            </button>

          </div>
        </form>
      </div>
    </div>
  );
}

export default Plan_action;
