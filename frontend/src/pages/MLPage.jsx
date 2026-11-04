import React, { useEffect, useState } from 'react';
import {
  fetchMLAnomalies,
  fetchMLJobStatus,
  fetchMLModelMetadata,
  fetchMLRiskScores,
  fetchMLSuggestions,
  predictMLRiskSuggestion,
  runMLEtlJob,
  runMLTrainingJob,
} from '../services/api';
import '../styles/MLPage.css';

const toNumberOrNull = (value) => {
  const numeric = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : null;
};

const formatPercent = (value) => (
  typeof value === 'number' ? `${Math.round(value * 100)}%` : 'n/a'
);

const MLPage = ({ theme = 'dark' }) => {
  const [anomalies, setAnomalies] = useState([]);
  const [riskScores, setRiskScores] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [jobRuns, setJobRuns] = useState([]);
  const [modelMetadata, setModelMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jobLoading, setJobLoading] = useState('');
  const [jobMessage, setJobMessage] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [error, setError] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState('');
  const [predictionResult, setPredictionResult] = useState(null);
  const [predictionForm, setPredictionForm] = useState({
    indicator: 'test_direct_features',
    processus: 'Qualite',
    signe: '>=',
    unite: '%',
    objectif: '80',
    realisation: '60',
    annee: String(new Date().getFullYear()),
    mois: String(new Date().getMonth() + 1),
    rollingMean: '70',
    rollingStd: '8',
    openActions: '0',
    lateActions: '0',
  });

  const fetchMLData = async () => {
    try {
      setError(null);
      const [anomaliesRes, riskRes, suggestionsRes, jobsRes, metadataRes] = await Promise.all([
        fetchMLAnomalies(),
        fetchMLRiskScores(),
        fetchMLSuggestions(),
        fetchMLJobStatus(),
        fetchMLModelMetadata(),
      ]);

      setAnomalies(anomaliesRes.data || []);
      setRiskScores(riskRes.data || []);
      setSuggestions(suggestionsRes.data || []);
      setJobRuns(jobsRes.data?.runs || []);
      setModelMetadata(metadataRes.data || null);
    } catch (requestError) {
      console.error('Erreur chargement ML:', requestError);
      setError('Erreur lors du chargement des donnees ML');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMLData();
  }, []);

  const runJob = async (jobType) => {
    setJobLoading(jobType);
    setJobMessage('');
    setError(null);

    try {
      const response = jobType === 'etl' ? await runMLEtlJob() : await runMLTrainingJob();
      setJobMessage(response.data?.message || `${jobType} termine`);
      await fetchMLData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.details ||
        requestError.response?.data?.error ||
        `Erreur pendant le job ${jobType}`,
      );
    } finally {
      setJobLoading('');
    }
  };

  const highRiskCount = riskScores.filter((risk) => risk.risk_level === 'High').length;
  const criticalSuggestions = suggestions.filter((suggestion) => suggestion.priority === 'Critical').length;
  const anomalyCount = anomalies.filter((anomaly) => anomaly.is_anomaly).length;
  const registry = modelMetadata?.registry || [];
  const riskSuggestionMetadata = modelMetadata?.risk_suggestion_metadata || null;
  const riskSuggestionMetrics = riskSuggestionMetadata?.metrics || {};
  const activeRiskSuggestionModels = registry.filter((model) =>
    ['risk_level_classifier', 'suggestion_classifier'].includes(model.model_name)
  );

  const updatePredictionField = (field, value) => {
    setPredictionForm((previous) => ({ ...previous, [field]: value }));
  };

  const runRiskSuggestionPrediction = async (event) => {
    event.preventDefault();
    setPredictionLoading(true);
    setPredictionError('');
    setPredictionResult(null);

    try {
      const objectif = toNumberOrNull(predictionForm.objectif);
      const realisation = toNumberOrNull(predictionForm.realisation);
      const rollingMean = toNumberOrNull(predictionForm.rollingMean);
      const rollingStd = toNumberOrNull(predictionForm.rollingStd);

      const response = await predictMLRiskSuggestion({
        indicator: predictionForm.indicator,
        year: toNumberOrNull(predictionForm.annee),
        month: toNumberOrNull(predictionForm.mois),
        features: {
          Indicateur: predictionForm.indicator,
          Processus: predictionForm.processus,
          Signe: predictionForm.signe,
          Unite: predictionForm.unite,
          Objectif: objectif,
          Realisation: realisation,
          Annee: toNumberOrNull(predictionForm.annee),
          Mois: toNumberOrNull(predictionForm.mois),
          rolling_mean: rollingMean,
          rolling_std: rollingStd,
          plan_action_open_count: toNumberOrNull(predictionForm.openActions) ?? 0,
          plan_action_late_count: toNumberOrNull(predictionForm.lateActions) ?? 0,
        },
      });

      setPredictionResult(response.data || null);
    } catch (requestError) {
      setPredictionError(
        requestError.response?.data?.details ||
        requestError.response?.data?.error ||
        'Prediction risk/suggestion indisponible',
      );
    } finally {
      setPredictionLoading(false);
    }
  };

  if (loading) {
    return <div className={`ml-loading ${theme}`}>Chargement des donnees ML...</div>;
  }

  if (error) {
    return (
      <div className={`ml-error ${theme}`}>
        <h2>Erreur</h2>
        <p>{error}</p>
        <button onClick={fetchMLData} className="retry-btn">
          Reessayer
        </button>
      </div>
    );
  }

  return (
    <div className={`ml-page ${theme}`}>
      <div className="ml-page-header">
        <div>
          <h1>AI Copilot KPI</h1>
          <p className="ml-page-copy">
            Supervision des modeles ML KPI: prediction du risk level, categorie de suggestion,
            anomalies et jobs ETL/training.
          </p>
        </div>
      </div>

      <div className="ml-tabs">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
          Tableau de Bord
        </button>
        <button className={activeTab === 'anomalies' ? 'active' : ''} onClick={() => setActiveTab('anomalies')}>
          Anomalies ({anomalyCount})
        </button>
        <button className={activeTab === 'risks' ? 'active' : ''} onClick={() => setActiveTab('risks')}>
          Scores Risque ({highRiskCount})
        </button>
        <button className={activeTab === 'suggestions' ? 'active' : ''} onClick={() => setActiveTab('suggestions')}>
          Suggestions ({criticalSuggestions})
        </button>
        <button className={activeTab === 'predict' ? 'active' : ''} onClick={() => setActiveTab('predict')}>
          Tester Risk/Suggestion
        </button>
        <button className={activeTab === 'jobs' ? 'active' : ''} onClick={() => setActiveTab('jobs')}>
          Jobs ML
        </button>
      </div>

      <div className="ml-content">
        {activeTab === 'dashboard' && (
          <div className="ml-dashboard">
            <div className="ml-job-actions">
              <button className="retry-btn" onClick={() => runJob('etl')} disabled={Boolean(jobLoading)}>
                {jobLoading === 'etl' ? 'ETL en cours...' : 'Lancer ETL'}
              </button>
              <button className="retry-btn" onClick={() => runJob('train')} disabled={Boolean(jobLoading)}>
                {jobLoading === 'train' ? 'Train en cours...' : 'Entrainer models'}
              </button>
              <button className="retry-btn" onClick={fetchMLData} disabled={Boolean(jobLoading)}>
                Actualiser
              </button>
            </div>
            {jobMessage && <p className="ml-job-message">{jobMessage}</p>}

            <div className="ml-stat-cards">
              <div className="stat-card danger">
                <h3>{anomalyCount}</h3>
                <p>Anomalies detectees</p>
              </div>
              <div className="stat-card warning">
                <h3>{highRiskCount}</h3>
                <p>Indicateurs haut risque</p>
              </div>
              <div className="stat-card critical">
                <h3>{criticalSuggestions}</h3>
                <p>Actions critiques</p>
              </div>
            </div>

            <div className="ml-model-summary">
              <h3>Modeles ML actifs</h3>
              <div className="suggestion-actions">
                <span className="action-tag">xgb_regression</span>
                <span className="action-tag">xgb_classification</span>
                <span className="action-tag">ml_anomaly_detector</span>
                <span className="action-tag">risk_level_classifier</span>
                <span className="action-tag">suggestion_classifier</span>
              </div>
              <p>
                ETL construit le dataset et rafraichit les signaux. Train regenere les modeles de
                realisation/conformite ainsi que les deux classifiers risk level et suggestion.
              </p>
              {riskSuggestionMetadata ? (
                <div className="ml-model-metrics">
                  <span>Version: {riskSuggestionMetadata.version}</span>
                  <span>Lignes: {riskSuggestionMetadata.rows_processed}</span>
                  <span>Risk accuracy: {formatPercent(riskSuggestionMetrics.risk_level_accuracy)}</span>
                  <span>Suggestion accuracy: {formatPercent(riskSuggestionMetrics.suggestion_accuracy)}</span>
                </div>
              ) : null}
              <div className="suggestion-actions">
                {(activeRiskSuggestionModels.length ? activeRiskSuggestionModels : registry.slice(0, 5)).map((model) => (
                  <span key={`${model.model_name}-${model.id}`} className="action-tag">
                    {model.model_name} {model.is_active ? 'actif' : 'archive'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'predict' && (
          <div className="ml-predict">
            <form className="ml-predict-form" onSubmit={runRiskSuggestionPrediction}>
              <label>
                Indicateur
                <input
                  value={predictionForm.indicator}
                  onChange={(event) => updatePredictionField('indicator', event.target.value)}
                />
              </label>
              <label>
                Processus
                <input
                  value={predictionForm.processus}
                  onChange={(event) => updatePredictionField('processus', event.target.value)}
                />
              </label>
              <label>
                Signe
                <select
                  value={predictionForm.signe}
                  onChange={(event) => updatePredictionField('signe', event.target.value)}
                >
                  <option value=">=">&gt;=</option>
                  <option value="<=">&lt;=</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value="=">=</option>
                </select>
              </label>
              <label>
                Unite
                <input
                  value={predictionForm.unite}
                  onChange={(event) => updatePredictionField('unite', event.target.value)}
                />
              </label>
              <label>
                Objectif
                <input
                  type="number"
                  value={predictionForm.objectif}
                  onChange={(event) => updatePredictionField('objectif', event.target.value)}
                />
              </label>
              <label>
                Realisation
                <input
                  type="number"
                  value={predictionForm.realisation}
                  onChange={(event) => updatePredictionField('realisation', event.target.value)}
                />
              </label>
              <label>
                Annee
                <input
                  type="number"
                  value={predictionForm.annee}
                  onChange={(event) => updatePredictionField('annee', event.target.value)}
                />
              </label>
              <label>
                Mois
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={predictionForm.mois}
                  onChange={(event) => updatePredictionField('mois', event.target.value)}
                />
              </label>
              <label>
                Rolling mean
                <input
                  type="number"
                  value={predictionForm.rollingMean}
                  onChange={(event) => updatePredictionField('rollingMean', event.target.value)}
                />
              </label>
              <label>
                Rolling std
                <input
                  type="number"
                  value={predictionForm.rollingStd}
                  onChange={(event) => updatePredictionField('rollingStd', event.target.value)}
                />
              </label>
              <label>
                Actions ouvertes
                <input
                  type="number"
                  min="0"
                  value={predictionForm.openActions}
                  onChange={(event) => updatePredictionField('openActions', event.target.value)}
                />
              </label>
              <label>
                Actions en retard
                <input
                  type="number"
                  min="0"
                  value={predictionForm.lateActions}
                  onChange={(event) => updatePredictionField('lateActions', event.target.value)}
                />
              </label>
              <button className="retry-btn" type="submit" disabled={predictionLoading}>
                {predictionLoading ? 'Prediction...' : 'Predire risk/suggestion'}
              </button>
            </form>

            {predictionError ? <div className="ml-predict-error">{predictionError}</div> : null}

            {predictionResult ? (
              <div className="ml-predict-result">
                <div className={`suggestion-card ${(predictionResult.risk?.level || '').toLowerCase()}`}>
                  <div className="suggestion-header">
                    <h3>Risk Level: {predictionResult.risk?.level || 'Unknown'}</h3>
                    <span className={`badge ${(predictionResult.risk?.level || '').toLowerCase()}`}>
                      {formatPercent(predictionResult.risk?.score)}
                    </span>
                  </div>
                  <p className="suggestion-text">
                    Confiance prediction: {formatPercent(predictionResult.risk?.probability)} ·
                    Source: {predictionResult.prediction_source}
                  </p>
                </div>

                <div className={`suggestion-card ${(predictionResult.suggestion?.priority || '').toLowerCase()}`}>
                  <div className="suggestion-header">
                    <h3>Suggestion: {predictionResult.suggestion?.category}</h3>
                    <span className={`priority-badge ${(predictionResult.suggestion?.priority || '').toLowerCase()}`}>
                      {predictionResult.suggestion?.priority}
                    </span>
                  </div>
                  <p className="suggestion-text">{predictionResult.suggestion?.text}</p>
                  <div className="suggestion-actions">
                    {(predictionResult.suggestion?.actions || []).map((action) => (
                      <span key={action} className="action-tag">{action}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 'anomalies' && (
          <div className="ml-anomalies">
            {anomalies.length === 0 ? (
              <p>Aucune anomalie detectee.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Indicateur</th>
                    <th>Annee</th>
                    <th>Mois</th>
                    <th>Objectif</th>
                    <th>Realise</th>
                    <th>Ecart %</th>
                    <th>Anomalie</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((anomaly) => (
                    <tr key={anomaly.id} className={anomaly.is_anomaly ? 'anomaly-row' : ''}>
                      <td>{anomaly.canonical_indicateur}</td>
                      <td>{anomaly.year_value}</td>
                      <td>{anomaly.month}</td>
                      <td>{anomaly.objectif}</td>
                      <td>{anomaly.realise}</td>
                      <td>{Number(anomaly.ecart_pourcent ?? 0).toFixed(1)}%</td>
                      <td>{anomaly.is_anomaly ? 'Alerte' : 'OK'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'risks' && (
          <div className="ml-risks">
            {riskScores.length === 0 ? (
              <p>Aucun score de risque disponible.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Indicateur</th>
                    <th>Score Risque</th>
                    <th>Niveau</th>
                    <th>Volatilite</th>
                    <th>Ecart Performance</th>
                    <th>Taux Anomalie</th>
                  </tr>
                </thead>
                <tbody>
                  {riskScores.map((risk) => (
                    <tr key={risk.id} className={`risk-${risk.risk_level?.toLowerCase()}`}>
                      <td>{risk.canonical_indicateur}</td>
                      <td>{(Number(risk.risk_score ?? 0) * 100).toFixed(1)}%</td>
                      <td>
                        <span className={`badge ${risk.risk_level?.toLowerCase()}`}>
                          {risk.risk_level}
                        </span>
                      </td>
                      <td>{Number(risk.volatility ?? 0).toFixed(2)}</td>
                      <td>{(Number(risk.performance_gap ?? 0) * 100).toFixed(1)}%</td>
                      <td>{(Number(risk.anomaly_rate ?? 0) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'suggestions' && (
          <div className="ml-suggestions">
            {suggestions.length === 0 ? (
              <p>Aucune suggestion disponible.</p>
            ) : (
              suggestions.map((suggestion) => (
                <div key={suggestion.id} className={`suggestion-card ${suggestion.priority?.toLowerCase()}`}>
                  <div className="suggestion-header">
                    <h3>{suggestion.canonical_indicateur}</h3>
                    <span className={`priority-badge ${suggestion.priority?.toLowerCase()}`}>
                      {suggestion.priority}
                    </span>
                  </div>
                  <p className="suggestion-text">{suggestion.suggestion}</p>
                  <div className="suggestion-actions">
                    {suggestion.suggested_actions?.split(',').map((action) => (
                      <span key={action.trim()} className="action-tag">{action.trim()}</span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="ml-jobs">
            <div className="ml-job-actions">
              <button className="retry-btn" onClick={() => runJob('etl')} disabled={Boolean(jobLoading)}>
                {jobLoading === 'etl' ? 'ETL en cours...' : 'Run ETL process'}
              </button>
              <button className="retry-btn" onClick={() => runJob('train')} disabled={Boolean(jobLoading)}>
                {jobLoading === 'train' ? 'Training en cours...' : 'Train models'}
              </button>
            </div>
            <p className="ml-job-message">
              Cron ETL: le backend conserve les executions dans ml_pipeline_runs. Ce panneau lance les memes jobs via POST API.
            </p>
            {jobRuns.length === 0 ? (
              <p>Aucun job ML execute.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Debut</th>
                    <th>Fin</th>
                    <th>Lignes</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {jobRuns.map((run) => (
                    <tr key={run.id}>
                      <td>{run.job_type}</td>
                      <td>{run.status}</td>
                      <td>{run.started_at}</td>
                      <td>{run.finished_at || '-'}</td>
                      <td>{run.rows_processed ?? '-'}</td>
                      <td>{run.message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MLPage;
