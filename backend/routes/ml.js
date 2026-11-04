const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const router = express.Router();
const { sql, poolPromise } = require('../config/database');
const { authMiddleware } = require('../middleware/authMiddleware');
const mlPipelineService = require('../services/mlPipelineService');

router.use(authMiddleware);

const requireAdmin = (req, res) => {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Access denied: only administrators can run ML jobs' });
    return false;
  }
  return true;
};

const MONTH_QUERY_KEYS = {
  1: 'janv',
  2: 'fev',
  3: 'mars',
  4: 'avril',
  5: 'mai',
  6: 'juin',
  7: 'juil',
  8: 'aout',
  9: 'sept',
  10: 'oct',
  11: 'nov',
  12: 'decem',
};

const normalizeText = (value) => String(value ?? '').trim();

const normalizeMonthFilter = (value) => {
  const rawValue = normalizeText(value).toLowerCase();
  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isInteger(parsed) && MONTH_QUERY_KEYS[parsed]) {
    return MONTH_QUERY_KEYS[parsed];
  }

  return rawValue;
};

const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizePredictionSource = (value) => normalizeText(value).toLowerCase();

const MONTH_NAME_BY_NUMBER = {
  1: 'janv',
  2: 'fev',
  3: 'mars',
  4: 'avril',
  5: 'mai',
  6: 'juin',
  7: 'juil',
  8: 'aout',
  9: 'sept',
  10: 'oct',
  11: 'nov',
  12: 'decem',
};

const QUARTER_MONTHS = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

const uniqueStrings = (values) => {
  const seen = new Set();
  return values.filter((value) => {
    const normalized = normalizeText(value);
    if (!normalized) {
      return false;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const buildProbableCauses = (riskRow, anomalies) => {
  const causes = [];
  const performanceGap = toFiniteNumber(riskRow?.performance_gap);
  const volatility = toFiniteNumber(riskRow?.volatility);
  const anomalyRate = toFiniteNumber(riskRow?.anomaly_rate);

  if (performanceGap !== null && performanceGap < -0.15) {
    causes.push("La realisation recente reste durablement sous l'objectif.");
  }

  if (volatility !== null && volatility > 0.25) {
    causes.push("Les resultats varient fortement d'un mois a l'autre.");
  }

  if (anomalyRate !== null && anomalyRate > 0.08) {
    causes.push("Le taux d'anomalie remonte et fragilise la performance.");
  }

  if (Array.isArray(anomalies) && anomalies.length > 0) {
    causes.push('Des anomalies recentes signalent une execution instable ou une saisie non homogene.');
  }

  if (causes.length === 0) {
    causes.push("Aucun facteur dominant n'est isole; le suivi demande une verification metier.");
  }

  return uniqueStrings(causes).slice(0, 3);
};

const buildFallbackActions = (riskRow, anomalyCount) => {
  const fallbackActions = [];
  const performanceGap = toFiniteNumber(riskRow?.performance_gap);
  const volatility = toFiniteNumber(riskRow?.volatility);

  if (performanceGap !== null && performanceGap < -0.1) {
    fallbackActions.push("Verifier l'ecart entre objectif et realise sur les dernieres periodes.");
  }

  if (volatility !== null && volatility > 0.25) {
    fallbackActions.push("Stabiliser le processus en analysant les causes des variations mensuelles.");
  }

  if (anomalyCount > 0) {
    fallbackActions.push("Controler les anomalies recentes avant de cloturer le plan d'action.");
  }

  fallbackActions.push("Aligner responsable, delai et critere d'efficacite avant validation.");
  return uniqueStrings(fallbackActions).slice(0, 3);
};

const buildConfidence = ({ riskRow, suggestionRow, anomalyCount }) => {
  let confidence = 0.2;

  if (riskRow && toFiniteNumber(riskRow.risk_score) !== null) {
    confidence += 0.35;
  }

  if (suggestionRow && normalizeText(suggestionRow.suggestion)) {
    confidence += 0.25;
  }

  if (anomalyCount > 0) {
    confidence += Math.min(0.2, anomalyCount * 0.04);
  }

  if (normalizeText(riskRow?.risk_level)) {
    confidence += 0.05;
  }

  return Math.min(0.95, Number(confidence.toFixed(2)));
};

const buildAnomalySummary = (anomalies, anomalyCount) => {
  if (!Array.isArray(anomalies) || anomalies.length === 0) {
    return "Aucune anomalie critique recente n'a ete remontee pour cet indicateur.";
  }

  const recentMonths = uniqueStrings(
    anomalies.map((anomaly) => {
      const month = normalizeText(anomaly.month);
      const year = normalizeText(anomaly.year_value);
      return month && year ? `${month} ${year}` : month || year;
    })
  );

  return `${anomalyCount} anomalie(s) recente(s) detectee(s). Derniers signaux: ${recentMonths.slice(0, 3).join(', ')}.`;
};

const buildStatusSummary = (indicator, riskRow, anomalyCount, suggestionRow) => {
  const riskLevel = normalizeText(riskRow?.risk_level) || 'Unknown';
  const riskScore = toFiniteNumber(riskRow?.risk_score);
  const scoreText = riskScore === null ? 'n/a' : `${Math.round(riskScore * 100)}%`;
  const suggestionText = normalizeText(suggestionRow?.suggestion);

  if (riskLevel !== 'Unknown') {
    return `${indicator} est actuellement classe ${riskLevel.toLowerCase()} avec un score de ${scoreText} et ${anomalyCount} anomalie(s) recente(s). ${suggestionText || ''}`.trim();
  }

  return `${indicator} ne dispose pas encore de signaux AI complets. ${suggestionText || 'Le copilot reste en mode lecture et supervision.'}`.trim();
};

const buildSignalSourceSummary = (riskRow) => {
  const source = normalizePredictionSource(riskRow?.prediction_source);

  if (source === 'trained_model' || source === 'auto_trained_model') {
    const modelName = normalizeText(riskRow?.model_name) || 'modele';
    const modelVersion = normalizeText(riskRow?.model_version);
    return modelVersion
      ? `Score issu du modele ${modelName} (${modelVersion}).`
      : `Score issu du modele ${modelName}.`;
  }

  if (source.includes('fallback')) {
    return "Score issu du fallback heuristique. Validation metier recommandee avant decision.";
  }

  return "Source du score AI non documentee dans le snapshot courant.";
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const evaluatePredictedAchievement = (predictedRealise, objectif, signe) => {
  const predicted = toFiniteNumber(predictedRealise);
  const target = toFiniteNumber(objectif);
  if (predicted === null || target === null || target === 0) {
    return null;
  }

  const sign = normalizeText(signe);
  if (sign.includes('<') || sign.includes('≤') || sign.includes('â‰¤')) {
    return clamp01(target / Math.max(predicted, 0.000001));
  }

  return clamp01(predicted / target);
};

const applyIndicatorPeriodInputs = (request, indicator, year, monthKey) => {
  request.input('indicateur', sql.NVarChar(255), indicator);

  if (Number.isInteger(year)) {
    request.input('year', sql.Int, year);
  }

  if (monthKey) {
    request.input('month', sql.NVarChar(20), monthKey);
  }

  return request;
};

const getMlPool = async () => {
  const pool = await poolPromise;
  await mlPipelineService.ensureMlRuntimeTables(pool);
  return pool;
};

const runPythonPrediction = (payload) => new Promise((resolve, reject) => {
  const pythonCommand = process.env.PYTHON || process.env.PYTHON_PATH || 'python';
  const scriptPath = path.resolve(__dirname, '..', 'ml', 'predict.py');
  const child = spawn(pythonCommand, [scriptPath, JSON.stringify(payload)], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env },
    windowsHide: true,
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('error', reject);
  child.on('close', (code) => {
    if (code !== 0) {
      reject(new Error(stderr || stdout || `Prediction exited with code ${code}`));
      return;
    }

    try {
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      const parsed = JSON.parse(lines.at(-1) || '{}');
      if (parsed.error) {
        reject(new Error(parsed.error));
        return;
      }
      resolve(parsed);
    } catch (error) {
      reject(new Error(`Prediction returned invalid JSON: ${stdout}`));
    }
  });
});

const runPythonAnomalyTest = (payload) => new Promise((resolve, reject) => {
  const pythonCommand = process.env.PYTHON || process.env.PYTHON_PATH || 'python';
  const scriptPath = path.resolve(__dirname, '..', 'ml', 'anomaly_test.py');
  const child = spawn(pythonCommand, [scriptPath, JSON.stringify(payload)], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env },
    windowsHide: true,
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('error', reject);
  child.on('close', (code) => {
    try {
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      const parsed = JSON.parse(lines.at(-1) || '{}');
      if (parsed.error) {
        reject(new Error(parsed.error));
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr || stdout || `Anomaly test exited with code ${code}`));
        return;
      }
      resolve(parsed);
    } catch (error) {
      reject(new Error(`Anomaly test returned invalid JSON: ${stdout || stderr}`));
    }
  });
});

const runPythonRiskSuggestionPrediction = (payload) => new Promise((resolve, reject) => {
  const pythonCommand = process.env.PYTHON || process.env.PYTHON_PATH || 'python';
  const scriptPath = path.resolve(__dirname, '..', 'ml', 'risk_suggestion_predict.py');
  const child = spawn(pythonCommand, [scriptPath, JSON.stringify(payload)], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env },
    windowsHide: true,
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('error', reject);
  child.on('close', (code) => {
    try {
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      const parsed = JSON.parse(lines.at(-1) || '{}');
      if (parsed.error) {
        reject(new Error(parsed.error));
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr || stdout || `Risk/suggestion prediction exited with code ${code}`));
        return;
      }
      resolve(parsed);
    } catch (error) {
      reject(new Error(`Risk/suggestion prediction returned invalid JSON: ${stdout || stderr}`));
    }
  });
});

router.get('/anomalies', async (req, res) => {
  try {
    const pool = await getMlPool();
    const result = await pool.request().query(`
      SELECT TOP 50 *
      FROM dbo.ml_anomalies
      ORDER BY created_at DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('ML anomalies error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/risk_scores', async (req, res) => {
  try {
    const pool = await getMlPool();
    const result = await pool.request().query(`
      SELECT TOP 50 *
      FROM dbo.ml_risk_scores
      ORDER BY risk_score DESC, created_at DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('ML risk_scores error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/suggestions', async (req, res) => {
  try {
    const pool = await getMlPool();
    const result = await pool.request().query(`
      SELECT *
      FROM dbo.ml_suggestions
      ORDER BY created_at DESC, priority DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('ML suggestions error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/jobs/etl/run', async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const result = await mlPipelineService.runEtl();
    res.json(result);
  } catch (error) {
    console.error('ML ETL job error:', error);
    res.status(500).json({ error: 'Failed to run ML ETL job', details: error.message });
  }
});

router.post('/jobs/train/run', async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const result = await mlPipelineService.runTraining();
    res.json(result);
  } catch (error) {
    console.error('ML training job error:', error);
    res.status(500).json({ error: 'Failed to run ML training job', details: error.message });
  }
});

router.get('/jobs/status', async (req, res) => {
  try {
    const runs = await mlPipelineService.getLatestRuns();
    res.json({ runs });
  } catch (error) {
    console.error('ML jobs status error:', error);
    res.status(500).json({ error: 'Failed to fetch ML jobs status', details: error.message });
  }
});

router.get('/model/metadata', async (req, res) => {
  try {
    const metadata = await mlPipelineService.getModelMetadata();
    res.json(metadata);
  } catch (error) {
    console.error('ML model metadata error:', error);
    res.status(500).json({ error: 'Failed to fetch ML model metadata', details: error.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const pool = await getMlPool();
    const [anomalies, risks, suggestions] = await Promise.all([
      pool.request().query(`
        SELECT COUNT(*) AS count
        FROM dbo.ml_anomalies
        WHERE is_anomaly = 1
      `),
      pool.request().query(`
        SELECT COUNT(*) AS count
        FROM dbo.ml_risk_scores
        WHERE risk_level = 'High'
      `),
      pool.request().query(`
        SELECT COUNT(*) AS count
        FROM dbo.ml_suggestions
        WHERE priority = 'Critical'
      `),
    ]);

    res.json({
      anomalies_count: anomalies.recordset[0].count,
      high_risk_count: risks.recordset[0].count,
      critical_suggestions: suggestions.recordset[0].count,
    });
  } catch (error) {
    console.error('Dashboard ML error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/best-predictions', async (req, res) => {
  try {
    const period = ['month', 'quarter', 'year'].includes(normalizeText(req.query.period).toLowerCase())
      ? normalizeText(req.query.period).toLowerCase()
      : 'month';
    const scope = normalizeText(req.query.scope).toLowerCase() === 'processus' ? 'processus' : 'indicator';
    const year = Number.parseInt(req.query.year, 10);
    const month = Number.parseInt(req.query.month, 10);
    const quarter = Number.parseInt(req.query.quarter, 10);
    const limit = Math.min(30, Math.max(3, Number.parseInt(req.query.limit, 10) || 10));

    if (!Number.isInteger(year)) {
      return res.status(400).json({ error: 'year query parameter is required' });
    }

    let months = [];
    if (period === 'month') {
      months = [Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1];
    } else if (period === 'quarter') {
      months = QUARTER_MONTHS[quarter] || QUARTER_MONTHS[Math.ceil((new Date().getMonth() + 1) / 3)];
    } else {
      months = Object.keys(MONTH_NAME_BY_NUMBER).map((value) => Number(value));
    }

    const pool = await getMlPool();
    const monthInputs = months.map((value, index) => `@m${index}`).join(', ');
    const request = pool.request()
      .input('year', sql.Int, year);
    months.forEach((value, index) => request.input(`m${index}`, sql.Int, value));

    const rowsResult = await request.query(`
      WITH latest_risk AS (
        SELECT *
        FROM (
          SELECT
            rs.*,
            ROW_NUMBER() OVER (
              PARTITION BY rs.canonical_indicateur
              ORDER BY rs.created_at DESC, rs.id DESC
            ) AS rn
          FROM dbo.ml_risk_scores rs
        ) ranked
        WHERE rn = 1
      )
      SELECT
        d.canonical_indicateur,
        d.processus,
        d.designation,
        d.year_value,
        d.month_value,
        d.objectif,
        d.realise,
        d.signe,
        d.unite,
        d.lag_1,
        d.lag_2,
        d.lag_3,
        d.rolling_mean,
        d.rolling_std,
        d.tendance,
        d.taux_realisation,
        d.ecart_percent,
        d.plan_action_open_count,
        d.plan_action_late_count,
        COALESCE(r.risk_score, 0) AS risk_score,
        COALESCE(r.risk_level, 'Unknown') AS risk_level,
        COALESCE(r.volatility, 0) AS volatility,
        COALESCE(r.anomaly_rate, 0) AS anomaly_rate
      FROM dbo.ml_kpi_monthly_dataset d
      LEFT JOIN latest_risk r ON r.canonical_indicateur = d.canonical_indicateur
      WHERE d.year_value = @year
        AND d.month_value IN (${monthInputs})
        AND d.objectif IS NOT NULL
    `);

    const grouped = new Map();
    const featureNames = [
      'objectif',
      'realise_or_expected',
      'lag_1',
      'lag_2',
      'lag_3',
      'rolling_mean',
      'rolling_std',
      'tendance',
      'risk_score',
      'volatility',
      'anomaly_rate',
      'plan_action_open_count',
      'plan_action_late_count',
    ];

    for (const row of rowsResult.recordset) {
      const expectedRealise = (
        toFiniteNumber(row.realise)
        ?? (
          (toFiniteNumber(row.rolling_mean) ?? toFiniteNumber(row.lag_1) ?? 0)
          + (toFiniteNumber(row.tendance) ?? 0)
        )
      );
      const achievement = evaluatePredictedAchievement(expectedRealise, row.objectif, row.signe) ?? 0;
      const riskPenalty = 1 - clamp01(toFiniteNumber(row.risk_score) ?? 0);
      const stability = 1 - clamp01(toFiniteNumber(row.volatility) ?? 0);
      const anomalyPenalty = 1 - clamp01(toFiniteNumber(row.anomaly_rate) ?? 0);
      const actionPenalty = 1 - clamp01(((row.plan_action_open_count || 0) * 0.05) + ((row.plan_action_late_count || 0) * 0.1));
      const predictedScore = clamp01(
        (achievement * 0.55)
        + (riskPenalty * 0.18)
        + (stability * 0.12)
        + (anomalyPenalty * 0.1)
        + (actionPenalty * 0.05)
      );

      const key = scope === 'processus'
        ? normalizeText(row.processus) || 'Sans processus'
        : normalizeText(row.canonical_indicateur);
      if (!key) {
        continue;
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          label: scope === 'processus'
            ? key
            : normalizeText(row.designation) || key,
          scope,
          processus: normalizeText(row.processus),
          indicateurs: new Set(),
          months: [],
          scoreSum: 0,
          achievementSum: 0,
          riskSum: 0,
          predictedRealiseSum: 0,
          objectifSum: 0,
          count: 0,
        });
      }

      const item = grouped.get(key);
      item.indicateurs.add(normalizeText(row.canonical_indicateur));
      item.months.push({
        month: row.month_value,
        month_label: MONTH_NAME_BY_NUMBER[row.month_value],
        predicted_realise: Number(expectedRealise.toFixed(3)),
        objectif: toFiniteNumber(row.objectif),
        predicted_achievement: Number((achievement * 100).toFixed(2)),
        predicted_score: Number((predictedScore * 100).toFixed(2)),
        risk_score: Number(((toFiniteNumber(row.risk_score) ?? 0) * 100).toFixed(2)),
      });
      item.scoreSum += predictedScore;
      item.achievementSum += achievement;
      item.riskSum += toFiniteNumber(row.risk_score) ?? 0;
      item.predictedRealiseSum += expectedRealise;
      item.objectifSum += toFiniteNumber(row.objectif) ?? 0;
      item.count += 1;
    }

    const rankings = [...grouped.values()]
      .map((item) => ({
        key: item.key,
        label: item.label,
        scope: item.scope,
        processus: item.processus,
        indicators_count: item.indicateurs.size,
        predicted_score: Number(((item.scoreSum / item.count) * 100).toFixed(2)),
        predicted_achievement: Number(((item.achievementSum / item.count) * 100).toFixed(2)),
        avg_risk_score: Number(((item.riskSum / item.count) * 100).toFixed(2)),
        predicted_realise_avg: Number((item.predictedRealiseSum / item.count).toFixed(3)),
        objectif_avg: Number((item.objectifSum / item.count).toFixed(3)),
        months: item.months.sort((a, b) => a.month - b.month),
      }))
      .sort((a, b) => b.predicted_score - a.predicted_score)
      .slice(0, limit);

    res.json({
      period,
      scope,
      year,
      month: period === 'month' ? months[0] : null,
      quarter: period === 'quarter' ? (quarter || Math.ceil(months[0] / 3)) : null,
      months,
      features: featureNames,
      model_name: 'best_performance_supervised_ranker',
      prediction_source: 'engineered_features_from_ml_dataset',
      rankings,
    });
  } catch (error) {
    console.error('ML best predictions error:', error);
    res.status(500).json({ error: 'Failed to compute best predictions', details: error.message });
  }
});

router.post('/anomaly-test', async (req, res) => {
  try {
    const indicateur = normalizeText(req.body?.indicateur);
    const annee = Number.parseInt(req.body?.annee, 10);
    const mois = Number.parseInt(req.body?.mois, 10);
    const objectif = Number(req.body?.objectif);
    const realisation = Number(req.body?.realisation);
    const signe = normalizeText(req.body?.signe);
    const unite = normalizeText(req.body?.unite);

    if (
      !indicateur ||
      !Number.isInteger(annee) ||
      !Number.isInteger(mois) ||
      !Number.isFinite(objectif) ||
      !Number.isFinite(realisation) ||
      !signe ||
      !unite
    ) {
      return res.status(400).json({
        error: 'indicateur, annee, mois, objectif, realisation, signe and unite are required for ML anomaly test',
      });
    }

    if (!MONTH_QUERY_KEYS[mois]) {
      return res.status(400).json({ error: 'mois must be between 1 and 12' });
    }

    const anomaly = await runPythonAnomalyTest({
      ...req.body,
      indicateur,
      annee,
      mois,
      objectif,
      realisation,
      signe,
      unite,
    });

    res.json(anomaly);
  } catch (error) {
    console.error('ML anomaly test error:', error);
    res.status(500).json({ error: 'Failed to run ML anomaly test', details: error.message });
  }
});

router.post('/predict-realisation', async (req, res) => {
  try {
    const indicateur = normalizeText(req.body?.indicateur);
    const annee = Number.parseInt(req.body?.annee, 10);
    const mois = Number.parseInt(req.body?.mois, 10);
    const objectif = Number(req.body?.objectif);

    if (!indicateur || !Number.isInteger(annee) || !Number.isInteger(mois) || !Number.isFinite(objectif)) {
      return res.status(400).json({
        error: 'indicateur, annee, mois and objectif are required for ML prediction',
      });
    }

    if (!MONTH_QUERY_KEYS[mois]) {
      return res.status(400).json({ error: 'mois must be between 1 and 12' });
    }

    const prediction = await runPythonPrediction({
      indicateur,
      annee,
      mois,
      objectif,
    });

    res.json({
      indicateur,
      annee,
      mois,
      objectif,
      ...prediction,
      model_family: 'realisation_prediction',
      model_names: ['random_forest_regressor', 'random_forest_classifier'],
    });
  } catch (error) {
    console.error('ML prediction error:', error);
    res.status(500).json({ error: 'Failed to predict realisation', details: error.message });
  }
});

router.post('/indicator-test', async (req, res) => {
  try {
    const indicateur = normalizeText(req.body?.indicateur);
    const annee = Number.parseInt(req.body?.annee, 10);
    const mois = Number.parseInt(req.body?.mois, 10);
    const objectif = Number(req.body?.objectif);

    if (!indicateur || !Number.isInteger(annee) || !Number.isInteger(mois) || !Number.isFinite(objectif)) {
      return res.status(400).json({
        error: 'indicateur, annee, mois and objectif are required for ML indicator test',
      });
    }

    const monthKey = MONTH_NAME_BY_NUMBER[mois] || String(mois);
    const pool = await getMlPool();

    const [prediction, riskResult, suggestionResult, anomaliesResult] = await Promise.all([
      runPythonPrediction({ indicateur, annee, mois, objectif }),
      pool.request()
        .input('indicateur', sql.NVarChar(255), indicateur)
        .query(`
          SELECT TOP 1 *
          FROM dbo.ml_risk_scores
          WHERE NULLIF(LTRIM(RTRIM(canonical_indicateur)), '') = @indicateur
          ORDER BY created_at DESC
        `),
      pool.request()
        .input('indicateur', sql.NVarChar(255), indicateur)
        .query(`
          SELECT TOP 1 *
          FROM dbo.ml_suggestions
          WHERE NULLIF(LTRIM(RTRIM(canonical_indicateur)), '') = @indicateur
          ORDER BY created_at DESC
        `),
      pool.request()
        .input('indicateur', sql.NVarChar(255), indicateur)
        .input('year', sql.Int, annee)
        .input('month', sql.NVarChar(20), monthKey)
        .query(`
          SELECT TOP 5 *
          FROM dbo.ml_anomalies
          WHERE NULLIF(LTRIM(RTRIM(canonical_indicateur)), '') = @indicateur
            AND year_value = @year
            AND LOWER(LTRIM(RTRIM(month))) = @month
          ORDER BY created_at DESC
        `),
    ]);

    const risk = riskResult.recordset[0] || null;
    const suggestion = suggestionResult.recordset[0] || null;
    const anomalies = anomaliesResult.recordset || [];

    res.json({
      indicateur,
      annee,
      mois,
      month: monthKey,
      objectif,
      prediction,
      risk,
      suggestion,
      anomalies,
      anomaly_count: anomalies.filter((item) => item.is_anomaly).length,
      models_used: [
        'random_forest_regressor',
        'random_forest_classifier',
        risk?.model_name || 'risk_level_classifier',
        'anomaly_isolation_forest',
        suggestion?.model_name || 'suggestion_classifier',
      ],
    });
  } catch (error) {
    console.error('ML indicator test error:', error);
    res.status(500).json({ error: 'Failed to run ML indicator test', details: error.message });
  }
});

router.post('/risk-suggestion/predict', async (req, res) => {
  try {
    const indicator = normalizeText(req.body?.indicateur || req.body?.indicator);
    const hasFeatures = req.body?.features && typeof req.body.features === 'object';
    const rawYear = req.body?.year ?? req.body?.annee;
    const rawMonth = req.body?.month ?? req.body?.mois;
    const year = Number.parseInt(rawYear, 10);
    const month = Number.parseInt(rawMonth, 10);

    if (!indicator && !hasFeatures) {
      return res.status(400).json({ error: 'indicateur or features is required' });
    }

    const prediction = await runPythonRiskSuggestionPrediction({
      ...req.body,
      indicateur: indicator,
      year: Number.isInteger(year) ? year : null,
      month: Number.isInteger(month) ? month : rawMonth || null,
    });

    res.json(prediction);
  } catch (error) {
    console.error('ML risk/suggestion prediction error:', error);
    res.status(500).json({
      error: 'Failed to predict risk level and suggestion',
      details: error.message,
    });
  }
});

router.get('/copilot/:indicateur', async (req, res) => {
  try {
    const indicator = normalizeText(req.params.indicateur);
    const year = Number.parseInt(req.query.year, 10);
    const monthKey = normalizeMonthFilter(req.query.month);

    if (!indicator) {
      return res.status(400).json({ error: 'Indicator is required' });
    }

    const pool = await getMlPool();
    const anomalyFilters = [];

    if (Number.isInteger(year)) {
      anomalyFilters.push('AND year_value = @year');
    }

    if (monthKey) {
      anomalyFilters.push("AND LOWER(LTRIM(RTRIM(month))) = @month");
    }

    const anomalyWhereClause = anomalyFilters.length > 0 ? `\n        ${anomalyFilters.join('\n        ')}` : '';

    const predictionPayload = {
      indicateur: indicator,
      year: Number.isInteger(year) ? year : null,
      month: monthKey,
    };

    const [modelPrediction, riskResult, suggestionResult, anomaliesResult, anomalyCountResult] = await Promise.all([
      runPythonRiskSuggestionPrediction(predictionPayload).catch((error) => ({
        error: error.message,
        prediction_source: 'fallback_prediction_error',
      })),
      pool.request()
        .input('indicateur', sql.NVarChar(255), indicator)
        .query(`
          SELECT TOP 1 *
          FROM dbo.ml_risk_scores
          WHERE NULLIF(LTRIM(RTRIM(canonical_indicateur)), '') = @indicateur
          ORDER BY created_at DESC
        `),
      pool.request()
        .input('indicateur', sql.NVarChar(255), indicator)
        .query(`
          SELECT TOP 1 *
          FROM dbo.ml_suggestions
          WHERE NULLIF(LTRIM(RTRIM(canonical_indicateur)), '') = @indicateur
          ORDER BY created_at DESC
        `),
      applyIndicatorPeriodInputs(pool.request(), indicator, Number.isInteger(year) ? year : null, monthKey)
        .query(`
          SELECT TOP 5 *
          FROM dbo.ml_anomalies
          WHERE NULLIF(LTRIM(RTRIM(canonical_indicateur)), '') = @indicateur
            AND is_anomaly = 1${anomalyWhereClause}
          ORDER BY created_at DESC, year_value DESC
        `),
      applyIndicatorPeriodInputs(pool.request(), indicator, Number.isInteger(year) ? year : null, monthKey)
        .query(`
          SELECT COUNT(*) AS count
          FROM dbo.ml_anomalies
          WHERE NULLIF(LTRIM(RTRIM(canonical_indicateur)), '') = @indicateur
            AND is_anomaly = 1${anomalyWhereClause}
        `),
    ]);

    const riskRow = riskResult.recordset[0] || null;
    const suggestionRow = suggestionResult.recordset[0] || null;
    const anomalies = Array.isArray(anomaliesResult.recordset) ? anomaliesResult.recordset : [];
    const anomalyCount = Number(anomalyCountResult.recordset[0]?.count ?? anomalies.length);
    const hasModelPrediction = !modelPrediction?.error && modelPrediction?.risk && modelPrediction?.suggestion;

    const probableCauses = buildProbableCauses(riskRow, anomalies);
    const suggestedActions = uniqueStrings(
      normalizeText(suggestionRow?.suggested_actions)
        .split(',')
        .map((value) => value.trim())
    );
    const normalizedActions = suggestedActions.length > 0
      ? suggestedActions.slice(0, 3)
      : buildFallbackActions(riskRow, anomalyCount);
    const anomalySummary = buildAnomalySummary(anomalies, anomalyCount);
    const confidence = buildConfidence({ riskRow, suggestionRow, anomalyCount });
    const statusSummary = buildStatusSummary(indicator, riskRow, anomalyCount, suggestionRow);
    const draftRootCause = probableCauses.join(' ');
    const draftAction = normalizedActions.map((action, index) => `${index + 1}. ${action}`).join('\n');
    const risk = hasModelPrediction
      ? modelPrediction.risk
      : {
        level: riskRow?.risk_level || 'Unknown',
        score: toFiniteNumber(riskRow?.risk_score),
        probability: null,
        model_name: normalizeText(riskRow?.model_name) || 'risk_level_classifier',
        model_version: normalizeText(riskRow?.model_version) || null,
      };
    const suggestion = hasModelPrediction
      ? modelPrediction.suggestion
      : {
        category: normalizeText(suggestionRow?.category) || 'normal_followup',
        priority: normalizeText(suggestionRow?.priority) || 'Normal',
        text: normalizeText(suggestionRow?.suggestion) || 'Le modele recommande une revue metier avant cloture.',
        actions: normalizedActions,
        probability: null,
        model_name: 'suggestion_classifier',
        model_version: null,
      };
    const signals = {
      anomaly_count: hasModelPrediction ? modelPrediction.signals?.anomaly_count ?? anomalyCount : anomalyCount,
      performance_gap: hasModelPrediction ? toFiniteNumber(modelPrediction.signals?.performance_gap) : toFiniteNumber(riskRow?.performance_gap),
      volatility: hasModelPrediction ? toFiniteNumber(modelPrediction.signals?.volatility) : toFiniteNumber(riskRow?.volatility),
      plan_action_open_count: hasModelPrediction ? modelPrediction.signals?.plan_action_open_count ?? null : null,
      plan_action_late_count: hasModelPrediction ? modelPrediction.signals?.plan_action_late_count ?? null : null,
    };
    const predictionSource = hasModelPrediction
      ? normalizePredictionSource(modelPrediction.prediction_source) || 'trained_model'
      : normalizePredictionSource(modelPrediction?.prediction_source) || normalizePredictionSource(riskRow?.prediction_source) || 'fallback_prediction_error';

    res.json({
      indicator,
      filters: {
        year: Number.isInteger(year) ? year : null,
        month: monthKey,
      },
      risk,
      suggestion,
      signals,
      risk_level: risk.level,
      risk_score: risk.score,
      confidence,
      anomaly_count: anomalyCount,
      anomaly_summary: anomalySummary,
      anomalies,
      probable_causes: probableCauses,
      suggestion_text: suggestion.text,
      suggested_actions: Array.isArray(suggestion.actions) ? suggestion.actions : normalizedActions,
      draft_root_cause: draftRootCause,
      draft_action: draftAction,
      status_summary: statusSummary,
      model_name: risk.model_name || null,
      model_version: risk.model_version || null,
      prediction_source: predictionSource,
      prediction_error: modelPrediction?.error || null,
      signal_source_summary: buildSignalSourceSummary({
        ...riskRow,
        risk_level: risk.level,
        risk_score: risk.score,
        model_name: risk.model_name,
        model_version: risk.model_version,
        prediction_source: predictionSource,
      }),
    });
  } catch (error) {
    console.error('ML copilot error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
