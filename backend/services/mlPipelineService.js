const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { sql, poolPromise } = require('../config/database');

const MODELS_DIR = path.resolve(__dirname, '..', 'models');
const DATASET_PATH = path.join(MODELS_DIR, 'kpi_dataset_dw_ml_clean.csv');
const TRAIN_SCRIPT_PATH = path.resolve(__dirname, '..', 'ml', 'train_models.py');
const RISK_SUGGESTION_TRAIN_SCRIPT_PATH = path.resolve(__dirname, '..', 'ml', 'train_risk_suggestion_models.py');
const ANOMALY_SCORE_SCRIPT_PATH = path.resolve(__dirname, '..', 'ml', 'score_anomalies.py');

const MONTHS = [
  { index: 1, key: 'janv' },
  { index: 2, key: 'fev' },
  { index: 3, key: 'mars' },
  { index: 4, key: 'avril' },
  { index: 5, key: 'mai' },
  { index: 6, key: 'juin' },
  { index: 7, key: 'juil' },
  { index: 8, key: 'aout' },
  { index: 9, key: 'sept' },
  { index: 10, key: 'oct' },
  { index: 11, key: 'nov' },
  { index: 12, key: 'decem' },
];

let etlRunning = false;
let trainRunning = false;

const normalizeText = (value) => String(value ?? '').trim();

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(String(value).replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : null;
};

const getYearFromRow = (row) => {
  const directYear = Number.parseInt(row.annee ?? row.Annee ?? row.year_value, 10);
  if (Number.isInteger(directYear)) {
    return directYear;
  }

  const dateValue = row.date1 || row.datenow || row.created_at;
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date.getFullYear();
};

const getMonthFromRow = (row) => {
  const directMonth = Number.parseInt(row.mois ?? row.month_value, 10);
  if (Number.isInteger(directMonth) && directMonth >= 1 && directMonth <= 12) {
    return directMonth;
  }

  const dateValue = row.date1 || row.datenow || row.datecreation || row.created_at;
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date.getMonth() + 1;
};

const csvEscape = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const round = (value, digits = 6) => {
  const numeric = toNumber(value);
  if (numeric === null) {
    return null;
  }
  return Number(numeric.toFixed(digits));
};

const signPasses = (realise, objectif, signe) => {
  const r = toNumber(realise);
  const o = toNumber(objectif);
  if (r === null || o === null) {
    return null;
  }

  const sign = normalizeText(signe);
  if (sign.includes('<') || sign.includes('≤') || sign.includes('≦')) {
    return r <= o;
  }
  if (sign.includes('>') || sign.includes('≥') || sign.includes('≧')) {
    return r >= o;
  }
  if (sign.includes('=') && !sign.includes('!')) {
    return Math.abs(r - o) <= 0.0001;
  }
  return r >= o;
};

const ensureMlRuntimeTables = async (pool) => {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ml_anomalies')
    BEGIN
      CREATE TABLE dbo.ml_anomalies (
        id INT PRIMARY KEY IDENTITY(1,1),
        canonical_indicateur NVARCHAR(255) NULL,
        year_value INT NULL,
        month NVARCHAR(20) NULL,
        objectif FLOAT NULL,
        realise FLOAT NULL,
        ecart_absolu FLOAT NULL,
        ecart_pourcent FLOAT NULL,
        is_anomaly BIT NOT NULL DEFAULT 0,
        anomaly_score FLOAT NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_ml_anomalies_indicator_period
        ON dbo.ml_anomalies(canonical_indicateur, year_value, month);
    END

    IF COL_LENGTH('dbo.ml_anomalies', 'anomaly_score') IS NULL
      ALTER TABLE dbo.ml_anomalies ADD anomaly_score FLOAT NULL;

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ml_risk_scores')
    BEGIN
      CREATE TABLE dbo.ml_risk_scores (
        id INT PRIMARY KEY IDENTITY(1,1),
        canonical_indicateur NVARCHAR(255) NULL,
        risk_score FLOAT NULL,
        risk_level NVARCHAR(20) NULL,
        volatility FLOAT NULL,
        performance_gap FLOAT NULL,
        anomaly_rate FLOAT NULL,
        model_name NVARCHAR(100) NULL,
        model_version NVARCHAR(50) NULL,
        prediction_source NVARCHAR(80) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_ml_risk_scores_level
        ON dbo.ml_risk_scores(risk_level, risk_score DESC);
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ml_suggestions')
    BEGIN
      CREATE TABLE dbo.ml_suggestions (
        id INT PRIMARY KEY IDENTITY(1,1),
        canonical_indicateur NVARCHAR(255) NULL,
        priority NVARCHAR(20) NULL,
        risk_level NVARCHAR(20) NULL,
        anomaly_count INT NULL,
        avg_ecart_pourcent FLOAT NULL,
        suggestion NVARCHAR(MAX) NULL,
        suggested_actions NVARCHAR(MAX) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_ml_suggestions_priority
        ON dbo.ml_suggestions(priority);
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ml_kpi_monthly_dataset')
    BEGIN
      CREATE TABLE dbo.ml_kpi_monthly_dataset (
        id INT PRIMARY KEY IDENTITY(1,1),
        canonical_indicateur NVARCHAR(255) NOT NULL,
        processus NVARCHAR(255) NULL,
        designation NVARCHAR(500) NULL,
        year_value INT NOT NULL,
        month_value INT NOT NULL,
        objectif FLOAT NULL,
        realise FLOAT NULL,
        signe NVARCHAR(50) NULL,
        unite NVARCHAR(100) NULL,
        ecart FLOAT NULL,
        ecart_percent FLOAT NULL,
        taux_realisation FLOAT NULL,
        is_conforme BIT NULL,
        lag_1 FLOAT NULL,
        lag_2 FLOAT NULL,
        lag_3 FLOAT NULL,
        rolling_mean FLOAT NULL,
        rolling_std FLOAT NULL,
        tendance FLOAT NULL,
        plan_action_open_count INT NOT NULL DEFAULT 0,
        plan_action_late_count INT NOT NULL DEFAULT 0,
        has_action_open BIT NOT NULL DEFAULT 0,
        responsable NVARCHAR(255) NULL,
        pilote NVARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_ml_kpi_dataset_indicator_period
        ON dbo.ml_kpi_monthly_dataset(canonical_indicateur, year_value, month_value);
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ml_pipeline_runs')
    BEGIN
      CREATE TABLE dbo.ml_pipeline_runs (
        id INT PRIMARY KEY IDENTITY(1,1),
        job_type NVARCHAR(50) NOT NULL,
        status NVARCHAR(30) NOT NULL,
        started_at DATETIME NOT NULL DEFAULT GETDATE(),
        finished_at DATETIME NULL,
        message NVARCHAR(MAX) NULL,
        rows_processed INT NULL
      );
      CREATE INDEX IX_ml_pipeline_runs_latest ON dbo.ml_pipeline_runs(job_type, started_at DESC);
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ml_model_registry')
    BEGIN
      CREATE TABLE dbo.ml_model_registry (
        id INT PRIMARY KEY IDENTITY(1,1),
        model_name NVARCHAR(100) NOT NULL,
        model_version NVARCHAR(50) NOT NULL,
        path NVARCHAR(1000) NOT NULL,
        metrics_json NVARCHAR(MAX) NULL,
        is_active BIT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_ml_model_registry_active ON dbo.ml_model_registry(model_name, is_active, created_at DESC);
    END
  `);
};

const startRun = async (pool, jobType) => {
  const result = await pool.request()
    .input('jobType', sql.NVarChar(50), jobType)
    .query(`
      INSERT INTO dbo.ml_pipeline_runs (job_type, status, started_at)
      OUTPUT inserted.id, inserted.job_type, inserted.status, inserted.started_at
      VALUES (@jobType, 'running', GETDATE())
    `);

  return result.recordset[0];
};

const finishRun = async (pool, id, status, message, rowsProcessed = null) => {
  await pool.request()
    .input('id', sql.Int, id)
    .input('status', sql.NVarChar(30), status)
    .input('message', sql.NVarChar(sql.MAX), message)
    .input('rowsProcessed', sql.Int, rowsProcessed)
    .query(`
      UPDATE dbo.ml_pipeline_runs
      SET status = @status,
          finished_at = GETDATE(),
          message = @message,
          rows_processed = @rowsProcessed
      WHERE id = @id
    `);
};

const getLatestRuns = async () => {
  const pool = await poolPromise;
  if (!pool) {
    throw new Error('Database connection unavailable');
  }

  await ensureMlRuntimeTables(pool);
  const result = await pool.request().query(`
    SELECT TOP 20 *
    FROM dbo.ml_pipeline_runs
    ORDER BY started_at DESC
  `);
  return result.recordset;
};

const extractRows = async (pool) => {
  const [
    indicators,
    objectifs,
    realises,
    actions,
    assignments,
    responsables,
    annualValues,
  ] = await Promise.all([
    pool.request().query(`
      SELECT
        NULLIF(LTRIM(RTRIM(CAST(Indicateur AS NVARCHAR(255)))), '') AS Indicateur,
        NULLIF(LTRIM(RTRIM(CAST(Processus AS NVARCHAR(255)))), '') AS Processus,
        NULLIF(LTRIM(RTRIM(CAST(Designation AS NVARCHAR(500)))), '') AS Designation,
        NULLIF(LTRIM(RTRIM(CAST(Nordre AS NVARCHAR(50)))), '') AS Nordre
      FROM dbo.Indicateur
      WHERE NULLIF(LTRIM(RTRIM(CAST(Indicateur AS NVARCHAR(255)))), '') IS NOT NULL
    `),
    pool.request().query('SELECT * FROM dbo.objectiv'),
    pool.request().query('SELECT * FROM dbo.realise'),
    pool.request().query('SELECT * FROM dbo.Plan_action'),
    pool.request().query(`
      IF OBJECT_ID('dbo.indicator_assignments', 'U') IS NULL
        SELECT CAST(NULL AS NVARCHAR(255)) AS indicateur WHERE 1 = 0
      ELSE
        SELECT * FROM dbo.indicator_assignments
    `),
    pool.request().query(`
      IF OBJECT_ID('dbo.responsable', 'U') IS NULL
        SELECT CAST(NULL AS NVARCHAR(255)) AS indicateur WHERE 1 = 0
      ELSE
        SELECT * FROM dbo.responsable
    `),
    pool.request().query(`
      IF OBJECT_ID('dbo.Indicateur_New', 'U') IS NOT NULL
      BEGIN
        SELECT
          ia.Annee,
          ia.Signe,
          ia.Unite,
          COALESCE(dim_i.NomIndicateur, legacy.Indicateur) AS Indicateur
        FROM dbo.Indicateur_Annee AS ia
        LEFT JOIN dbo.Indicateur_New AS dim_i ON dim_i.IdIndicateur = ia.IdIndicateur
        OUTER APPLY (
          SELECT TOP 1 i.Indicateur
          FROM dbo.Indicateur AS i
          WHERE TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(CAST(i.Nordre AS NVARCHAR(50)))), '')) = ia.IdProcessus
             OR TRY_CONVERT(INT, NULLIF(REPLACE(LTRIM(RTRIM(CAST(i.Indicateur AS NVARCHAR(255)))), 'I', ''), '')) = ia.IdIndicateur
          ORDER BY i.Nordre
        ) AS legacy
      END
      ELSE
      BEGIN
        SELECT
          ia.Annee,
          ia.Signe,
          ia.Unite,
          legacy.Indicateur AS Indicateur
        FROM dbo.Indicateur_Annee AS ia
        OUTER APPLY (
          SELECT TOP 1 i.Indicateur
          FROM dbo.Indicateur AS i
          WHERE TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(CAST(i.Nordre AS NVARCHAR(50)))), '')) = ia.IdProcessus
             OR TRY_CONVERT(INT, NULLIF(REPLACE(LTRIM(RTRIM(CAST(i.Indicateur AS NVARCHAR(255)))), 'I', ''), '')) = ia.IdIndicateur
          ORDER BY i.Nordre
        ) AS legacy
      END
    `),
  ]);

  return {
    indicators: indicators.recordset,
    objectifs: objectifs.recordset,
    realises: realises.recordset,
    actions: actions.recordset,
    assignments: assignments.recordset,
    responsables: responsables.recordset,
    annualValues: annualValues.recordset,
  };
};

const buildDataset = (source) => {
  const indicatorMap = new Map();
  const rowsByKey = new Map();
  const annualByIndicatorYear = new Map();
  const firstAnnualYear = new Map();

  source.indicators.forEach((indicator) => {
    const code = normalizeText(indicator.Indicateur);
    if (!code) {
      return;
    }
    indicatorMap.set(code.toLowerCase(), {
      indicateur: code,
      processus: normalizeText(indicator.Processus),
      designation: normalizeText(indicator.Designation),
    });
  });

  source.annualValues.forEach((row) => {
    const indicateur = normalizeText(row.Indicateur);
    const year = Number.parseInt(row.Annee, 10);
    if (!indicateur || !Number.isInteger(year)) {
      return;
    }
    annualByIndicatorYear.set(`${indicateur.toLowerCase()}|${year}`, {
      signe: normalizeText(row.Signe),
      unite: normalizeText(row.Unite),
    });
    const current = firstAnnualYear.get(indicateur.toLowerCase());
    if (!current || year < current) {
      firstAnnualYear.set(indicateur.toLowerCase(), year);
    }
  });

  const ensureRow = (indicateur, year, month) => {
    const code = normalizeText(indicateur);
    if (!code || !Number.isInteger(year) || !Number.isInteger(month)) {
      return null;
    }

    const firstYear = firstAnnualYear.get(code.toLowerCase());
    if (firstYear && year < firstYear) {
      return null;
    }

    const key = `${code}|${year}|${month}`;
    if (!rowsByKey.has(key)) {
      const indicatorInfo = indicatorMap.get(code.toLowerCase()) || {};
      const annual = annualByIndicatorYear.get(`${code.toLowerCase()}|${year}`) || {};
      rowsByKey.set(key, {
        canonical_indicateur: code,
        processus: indicatorInfo.processus || '',
        designation: indicatorInfo.designation || '',
        year_value: year,
        month_value: month,
        objectif: null,
        realise: null,
        signe: annual.signe || '',
        unite: annual.unite || '',
        plan_action_open_count: 0,
        plan_action_late_count: 0,
        has_action_open: 0,
        responsable: '',
        pilote: '',
      });
    }
    return rowsByKey.get(key);
  };

  const readMonthlyValues = (row, type) => {
    const indicateur = normalizeText(row.indicateur ?? row.Indicateur);
    const year = getYearFromRow(row);
    if (!indicateur || !Number.isInteger(year)) {
      return;
    }

    MONTHS.forEach(({ index, key }) => {
      const value = toNumber(row[key]);
      if (value === null) {
        return;
      }
      const target = ensureRow(indicateur, year, index);
      if (target) {
        target[type] = value;
      }
    });
  };

  source.objectifs.forEach((row) => readMonthlyValues(row, 'objectif'));
  source.realises.forEach((row) => readMonthlyValues(row, 'realise'));

  source.actions.forEach((action) => {
    const indicateur = normalizeText(action.Indicateur ?? action.indicateur);
    const year = Number.parseInt(action.annee ?? action.Annee, 10);
    const month = getMonthFromRow(action);
    const target = ensureRow(indicateur, year, month || 1);
    if (!target) {
      return;
    }

    const efficacit = normalizeText(action.efficacit).toLowerCase();
    const dateClot = normalizeText(action.dateclot);
    const datePrev = action.dateclotprevu ? new Date(action.dateclotprevu) : null;
    const isClosed = dateClot || ['100', '100%', 'realise', 'réalisé', 'realized'].includes(efficacit);
    if (!isClosed) {
      target.plan_action_open_count += 1;
      target.has_action_open = 1;
    }
    if (!isClosed && datePrev && !Number.isNaN(datePrev.getTime()) && datePrev < new Date()) {
      target.plan_action_late_count += 1;
    }
  });

  source.assignments.forEach((assignment) => {
    const indicateur = normalizeText(assignment.indicateur);
    if (!indicateur) {
      return;
    }
    rowsByKey.forEach((row) => {
      if (row.canonical_indicateur.toLowerCase() === indicateur.toLowerCase()) {
        row.responsable = row.responsable || normalizeText(assignment.responsable_name);
        row.pilote = row.pilote || normalizeText(assignment.pilote_name);
      }
    });
  });

  source.responsables.forEach((responsable) => {
    const indicateur = normalizeText(responsable.indicateur);
    if (!indicateur) {
      return;
    }
    rowsByKey.forEach((row) => {
      if (row.canonical_indicateur.toLowerCase() === indicateur.toLowerCase()) {
        row.responsable = row.responsable || normalizeText(responsable.responsable);
      }
    });
  });

  const dataset = [...rowsByKey.values()]
    .sort((a, b) => (
      a.canonical_indicateur.localeCompare(b.canonical_indicateur)
      || a.year_value - b.year_value
      || a.month_value - b.month_value
    ));

  const historyByIndicator = new Map();
  dataset.forEach((row) => {
    if (!historyByIndicator.has(row.canonical_indicateur)) {
      historyByIndicator.set(row.canonical_indicateur, []);
    }
    const history = historyByIndicator.get(row.canonical_indicateur);
    const previous = history.filter((item) => toNumber(item.realise) !== null);
    const lag1 = previous.at(-1)?.realise ?? row.realise;
    const lag2 = previous.at(-2)?.realise ?? lag1;
    const lag3 = previous.at(-3)?.realise ?? lag2;
    const rollingValues = [lag3, lag2, lag1].map(toNumber).filter((value) => value !== null);
    const rollingMean = rollingValues.length
      ? rollingValues.reduce((sum, value) => sum + value, 0) / rollingValues.length
      : null;
    const rollingStd = rollingValues.length
      ? Math.sqrt(rollingValues.reduce((sum, value) => sum + ((value - rollingMean) ** 2), 0) / rollingValues.length)
      : null;

    const ecart = row.realise !== null && row.objectif !== null ? row.realise - row.objectif : null;
    const ecartPercent = ecart !== null && row.objectif ? (ecart / row.objectif) * 100 : null;
    const tauxRealisation = row.realise !== null && row.objectif ? (row.realise / row.objectif) * 100 : null;
    const conforms = signPasses(row.realise, row.objectif, row.signe);

    Object.assign(row, {
      Ecart: round(ecart),
      ecart: round(ecart),
      ecart_percent: round(ecartPercent),
      taux_realisation: round(tauxRealisation),
      is_conforme: conforms === null ? null : conforms ? 1 : 0,
      lag_1: round(lag1),
      lag_2: round(lag2),
      lag_3: round(lag3),
      rolling_mean: round(rollingMean),
      rolling_std: round(rollingStd),
      tendance: round(toNumber(lag1) !== null && toNumber(lag2) !== null ? lag1 - lag2 : null),
    });

    history.push(row);
  });

  return dataset.filter((row) => row.objectif !== null || row.realise !== null || row.plan_action_open_count > 0);
};

const writeDatasetCsv = (dataset) => {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  const headers = [
    'Indicateur',
    'Processus',
    'Designation',
    'Annee',
    'Mois',
    'Objectif',
    'Realisation',
    'Ecart',
    'taux_realisation',
    'is_conforme',
    'lag_1',
    'lag_2',
    'lag_3',
    'rolling_mean',
    'rolling_std',
    'tendance',
    'indicateur_enc',
    'plan_action_open_count',
    'plan_action_late_count',
    'Signe',
    'Unite',
  ];

  const indicatorCodes = [...new Set(dataset.map((row) => row.canonical_indicateur))].sort();
  const encoder = new Map(indicatorCodes.map((code, index) => [code, index]));
  const lines = [headers.join(';')];

  dataset.forEach((row) => {
    lines.push([
      row.canonical_indicateur,
      row.processus,
      row.designation,
      row.year_value,
      row.month_value,
      row.objectif,
      row.realise,
      row.ecart,
      row.taux_realisation,
      row.is_conforme,
      row.lag_1,
      row.lag_2,
      row.lag_3,
      row.rolling_mean,
      row.rolling_std,
      row.tendance,
      encoder.get(row.canonical_indicateur),
      row.plan_action_open_count,
      row.plan_action_late_count,
      row.signe,
      row.unite,
    ].map(csvEscape).join(';'));
  });

  fs.writeFileSync(DATASET_PATH, `${lines.join('\n')}\n`, 'utf8');
  return DATASET_PATH;
};

const loadDatasetTable = async (pool, dataset) => {
  await pool.request().query('TRUNCATE TABLE dbo.ml_kpi_monthly_dataset');

  for (const row of dataset) {
    await pool.request()
      .input('canonical_indicateur', sql.NVarChar(255), row.canonical_indicateur)
      .input('processus', sql.NVarChar(255), row.processus)
      .input('designation', sql.NVarChar(500), row.designation)
      .input('year_value', sql.Int, row.year_value)
      .input('month_value', sql.Int, row.month_value)
      .input('objectif', sql.Float, row.objectif)
      .input('realise', sql.Float, row.realise)
      .input('signe', sql.NVarChar(50), row.signe)
      .input('unite', sql.NVarChar(100), row.unite)
      .input('ecart', sql.Float, row.ecart)
      .input('ecart_percent', sql.Float, row.ecart_percent)
      .input('taux_realisation', sql.Float, row.taux_realisation)
      .input('is_conforme', sql.Bit, row.is_conforme)
      .input('lag_1', sql.Float, row.lag_1)
      .input('lag_2', sql.Float, row.lag_2)
      .input('lag_3', sql.Float, row.lag_3)
      .input('rolling_mean', sql.Float, row.rolling_mean)
      .input('rolling_std', sql.Float, row.rolling_std)
      .input('tendance', sql.Float, row.tendance)
      .input('plan_action_open_count', sql.Int, row.plan_action_open_count)
      .input('plan_action_late_count', sql.Int, row.plan_action_late_count)
      .input('has_action_open', sql.Bit, row.has_action_open)
      .input('responsable', sql.NVarChar(255), row.responsable)
      .input('pilote', sql.NVarChar(255), row.pilote)
      .query(`
        INSERT INTO dbo.ml_kpi_monthly_dataset (
          canonical_indicateur, processus, designation, year_value, month_value,
          objectif, realise, signe, unite, ecart, ecart_percent, taux_realisation,
          is_conforme, lag_1, lag_2, lag_3, rolling_mean, rolling_std, tendance,
          plan_action_open_count, plan_action_late_count, has_action_open,
          responsable, pilote
        )
        VALUES (
          @canonical_indicateur, @processus, @designation, @year_value, @month_value,
          @objectif, @realise, @signe, @unite, @ecart, @ecart_percent, @taux_realisation,
          @is_conforme, @lag_1, @lag_2, @lag_3, @rolling_mean, @rolling_std, @tendance,
          @plan_action_open_count, @plan_action_late_count, @has_action_open,
          @responsable, @pilote
        )
      `);
  }
};

const refreshSignals = async (pool, dataset) => {
  await pool.request().query(`
    DELETE FROM dbo.ml_anomalies;
    DELETE FROM dbo.ml_risk_scores;
    DELETE FROM dbo.ml_suggestions;
  `);

  const anomalyPredictions = new Map();
  try {
    const scoredRows = await runPythonAnomalyScoring();
    scoredRows.forEach((row) => {
      anomalyPredictions.set(row.row_index, row);
    });
  } catch (error) {
    console.warn('Anomaly model scoring unavailable, falling back to heuristic rules:', error.message);
  }

  const grouped = new Map();
  dataset.forEach((row, index) => {
    row.anomaly_prediction = anomalyPredictions.get(index) || null;
    if (!grouped.has(row.canonical_indicateur)) {
      grouped.set(row.canonical_indicateur, []);
    }
    grouped.get(row.canonical_indicateur).push(row);
  });

  for (const [indicator, rows] of grouped.entries()) {
    const recentRows = rows.slice(-12);
    const validGaps = recentRows.map((row) => toNumber(row.ecart_percent)).filter((value) => value !== null);
    const avgGap = validGaps.length ? validGaps.reduce((sum, value) => sum + value, 0) / validGaps.length : 0;
    const volatilityValues = recentRows.map((row) => toNumber(row.realise)).filter((value) => value !== null);
    const mean = volatilityValues.length ? volatilityValues.reduce((sum, value) => sum + value, 0) / volatilityValues.length : 0;
    const volatility = volatilityValues.length ? Math.sqrt(volatilityValues.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / volatilityValues.length) / (Math.abs(mean) || 1) : 0;
    let anomalyCount = 0;

    for (const row of rows) {
      const gap = Math.abs(toNumber(row.ecart_percent) ?? 0);
      const variation = Math.abs(toNumber(row.tendance) ?? 0);
      const std = Math.abs(toNumber(row.rolling_std) ?? 0);
      const heuristicAnomaly = gap >= 30 || (std > 0 && variation > std * 2.5);
      const isAnomaly = row.anomaly_prediction
        ? row.anomaly_prediction.is_anomaly === 1
        : heuristicAnomaly;
      const anomalyScore = row.anomaly_prediction
        ? toNumber(row.anomaly_prediction.anomaly_score)
        : null;
      if (isAnomaly) {
        anomalyCount += 1;
      }

      await pool.request()
        .input('canonical_indicateur', sql.NVarChar(255), indicator)
        .input('year_value', sql.Int, row.year_value)
        .input('month', sql.NVarChar(20), MONTHS[row.month_value - 1]?.key || String(row.month_value))
        .input('objectif', sql.Float, row.objectif)
        .input('realise', sql.Float, row.realise)
        .input('ecart_absolu', sql.Float, row.ecart)
        .input('ecart_pourcent', sql.Float, row.ecart_percent)
        .input('is_anomaly', sql.Bit, isAnomaly ? 1 : 0)
        .input('anomaly_score', sql.Float, anomalyScore)
        .query(`
          INSERT INTO dbo.ml_anomalies (
            canonical_indicateur, year_value, month, objectif, realise,
            ecart_absolu, ecart_pourcent, is_anomaly, anomaly_score
          )
          VALUES (
            @canonical_indicateur, @year_value, @month, @objectif, @realise,
            @ecart_absolu, @ecart_pourcent, @is_anomaly, @anomaly_score
          )
        `);
    }

    const anomalyRate = rows.length ? anomalyCount / rows.length : 0;
    const openActions = recentRows.reduce((sum, row) => sum + (row.plan_action_open_count || 0), 0);
    const lateActions = recentRows.reduce((sum, row) => sum + (row.plan_action_late_count || 0), 0);
    const riskScore = Math.min(1, Math.max(0, (Math.max(0, -avgGap) / 100) + (volatility * 0.35) + (anomalyRate * 0.25) + (openActions * 0.03) + (lateActions * 0.05)));
    const riskLevel = riskScore >= 0.7 ? 'High' : riskScore >= 0.4 ? 'Medium' : 'Low';
    const priority = riskLevel === 'High' ? 'Critical' : riskLevel === 'Medium' ? 'High' : 'Normal';
    const suggestion = riskLevel === 'High'
      ? 'Prioriser une analyse des causes et verifier les plans d action ouverts.'
      : riskLevel === 'Medium'
        ? 'Surveiller la tendance et confirmer les actions correctives.'
        : 'Maintenir le suivi standard.';

    await pool.request()
      .input('canonical_indicateur', sql.NVarChar(255), indicator)
      .input('risk_score', sql.Float, round(riskScore))
      .input('risk_level', sql.NVarChar(20), riskLevel)
      .input('volatility', sql.Float, round(volatility))
      .input('performance_gap', sql.Float, round(avgGap / 100))
      .input('anomaly_rate', sql.Float, round(anomalyRate))
      .input('model_name', sql.NVarChar(100), 'heuristic_risk_score')
      .input('model_version', sql.NVarChar(50), 'v1')
      .input('prediction_source', sql.NVarChar(80), 'etl_heuristic')
      .query(`
        INSERT INTO dbo.ml_risk_scores (
          canonical_indicateur, risk_score, risk_level, volatility,
          performance_gap, anomaly_rate, model_name, model_version, prediction_source
        )
        VALUES (
          @canonical_indicateur, @risk_score, @risk_level, @volatility,
          @performance_gap, @anomaly_rate, @model_name, @model_version, @prediction_source
        )
      `);

    await pool.request()
      .input('canonical_indicateur', sql.NVarChar(255), indicator)
      .input('priority', sql.NVarChar(20), priority)
      .input('risk_level', sql.NVarChar(20), riskLevel)
      .input('anomaly_count', sql.Int, anomalyCount)
      .input('avg_ecart_pourcent', sql.Float, round(avgGap))
      .input('suggestion', sql.NVarChar(sql.MAX), suggestion)
      .input('suggested_actions', sql.NVarChar(sql.MAX), 'Verifier les ecarts recents, analyser les causes racines, mettre a jour le plan d action.')
      .query(`
        INSERT INTO dbo.ml_suggestions (
          canonical_indicateur, priority, risk_level, anomaly_count,
          avg_ecart_pourcent, suggestion, suggested_actions
        )
        VALUES (
          @canonical_indicateur, @priority, @risk_level, @anomaly_count,
          @avg_ecart_pourcent, @suggestion, @suggested_actions
        )
      `);
  }
};

const runEtl = async () => {
  if (etlRunning) {
    throw new Error('ETL job already running');
  }

  etlRunning = true;
  const pool = await poolPromise;
  if (!pool) {
    etlRunning = false;
    throw new Error('Database connection unavailable');
  }

  await ensureMlRuntimeTables(pool);
  const run = await startRun(pool, 'etl');

  try {
    const source = await extractRows(pool);
    const dataset = buildDataset(source);
    await loadDatasetTable(pool, dataset);
    writeDatasetCsv(dataset);
    await refreshSignals(pool, dataset);
    const message = `ETL completed. Dataset rows: ${dataset.length}`;
    await finishRun(pool, run.id, 'success', message, dataset.length);
    return { ...run, status: 'success', message, rows_processed: dataset.length, dataset_path: DATASET_PATH };
  } catch (error) {
    await finishRun(pool, run.id, 'failed', error.message, null);
    throw error;
  } finally {
    etlRunning = false;
  }
};

const runPythonTraining = () => new Promise((resolve, reject) => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const venvPythonWin = path.join(repoRoot, '.venv', 'Scripts', 'python.exe');
  const venvPythonNix = path.join(repoRoot, '.venv', 'bin', 'python');

  const pythonCommand =
    (process.env.PYTHON_PATH && String(process.env.PYTHON_PATH)) ||
    (process.env.PYTHON && String(process.env.PYTHON)) ||
    (fs.existsSync(venvPythonWin)
      ? venvPythonWin
      : fs.existsSync(venvPythonNix)
        ? venvPythonNix
        : 'python');

  const child = spawn(pythonCommand, [TRAIN_SCRIPT_PATH], {
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
      reject(new Error(stderr || stdout || `Training exited with code ${code}`));
      return;
    }

    try {
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      resolve(JSON.parse(lines.at(-1) || '{}'));
    } catch (error) {
      reject(new Error(`Training completed but returned invalid JSON: ${stdout}`));
    }
  });
});

const runPythonRiskSuggestionTraining = () => new Promise((resolve, reject) => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const venvPythonWin = path.join(repoRoot, '.venv', 'Scripts', 'python.exe');
  const venvPythonNix = path.join(repoRoot, '.venv', 'bin', 'python');

  const pythonCommand =
    (process.env.PYTHON_PATH && String(process.env.PYTHON_PATH)) ||
    (process.env.PYTHON && String(process.env.PYTHON)) ||
    (fs.existsSync(venvPythonWin)
      ? venvPythonWin
      : fs.existsSync(venvPythonNix)
        ? venvPythonNix
        : 'python');

  const child = spawn(pythonCommand, [RISK_SUGGESTION_TRAIN_SCRIPT_PATH], {
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
      reject(new Error(stderr || stdout || `Risk/suggestion training exited with code ${code}`));
      return;
    }

    try {
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      resolve(JSON.parse(lines.at(-1) || '{}'));
    } catch (error) {
      reject(new Error(`Risk/suggestion training returned invalid JSON: ${stdout}`));
    }
  });
});

const runPythonAnomalyScoring = () => new Promise((resolve, reject) => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const venvPythonWin = path.join(repoRoot, '.venv', 'Scripts', 'python.exe');
  const venvPythonNix = path.join(repoRoot, '.venv', 'bin', 'python');

  const pythonCommand =
    (process.env.PYTHON_PATH && String(process.env.PYTHON_PATH)) ||
    (process.env.PYTHON && String(process.env.PYTHON)) ||
    (fs.existsSync(venvPythonWin)
      ? venvPythonWin
      : fs.existsSync(venvPythonNix)
        ? venvPythonNix
        : 'python');

  const child = spawn(pythonCommand, [ANOMALY_SCORE_SCRIPT_PATH], {
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
        reject(new Error(stderr || stdout || `Anomaly scoring exited with code ${code}`));
        return;
      }
      resolve(parsed.rows || []);
    } catch (error) {
      reject(new Error(`Anomaly scoring returned invalid JSON: ${stdout || stderr}`));
    }
  });
});

const registerModel = async (pool, trainingResult) => {
  const version = normalizeText(trainingResult.version) || new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const versionPath = normalizeText(trainingResult.version_path) || path.join(MODELS_DIR, 'versions', version);
  const metricsJson = JSON.stringify(trainingResult.metrics || {});

  await pool.request()
    .input('version', sql.NVarChar(50), version)
    .input('path', sql.NVarChar(1000), versionPath)
    .input('metrics_json', sql.NVarChar(sql.MAX), metricsJson)
    .query(`
      UPDATE dbo.ml_model_registry
      SET is_active = 0
      WHERE model_name IN ('random_forest_regressor', 'random_forest_classifier', 'anomaly_isolation_forest');

      INSERT INTO dbo.ml_model_registry (model_name, model_version, path, metrics_json, is_active)
      VALUES
        ('random_forest_regressor', @version, @path, @metrics_json, 1),
        ('random_forest_classifier', @version, @path, @metrics_json, 1),
        ('anomaly_isolation_forest', @version, @path, @metrics_json, 1)
    `);
};

const registerRiskSuggestionModels = async (pool, trainingResult) => {
  const version = normalizeText(trainingResult.version) || new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const versionPath = normalizeText(trainingResult.version_path) || MODELS_DIR;
  const metricsJson = JSON.stringify(trainingResult.metrics || {});

  await pool.request()
    .input('version', sql.NVarChar(50), version)
    .input('path', sql.NVarChar(1000), versionPath)
    .input('metrics_json', sql.NVarChar(sql.MAX), metricsJson)
    .query(`
      UPDATE dbo.ml_model_registry
      SET is_active = 0
      WHERE model_name IN ('risk_level_classifier', 'suggestion_classifier');

      INSERT INTO dbo.ml_model_registry (model_name, model_version, path, metrics_json, is_active)
      VALUES
        ('risk_level_classifier', @version, @path, @metrics_json, 1),
        ('suggestion_classifier', @version, @path, @metrics_json, 1)
    `);
};

const runTraining = async () => {
  if (trainRunning) {
    throw new Error('Training job already running');
  }

  trainRunning = true;
  const pool = await poolPromise;
  if (!pool) {
    trainRunning = false;
    throw new Error('Database connection unavailable');
  }

  await ensureMlRuntimeTables(pool);
  const run = await startRun(pool, 'train');

  try {
    const trainingResult = await runPythonTraining();
    const riskSuggestionTraining = await runPythonRiskSuggestionTraining();
    await registerModel(pool, trainingResult);
    await registerRiskSuggestionModels(pool, riskSuggestionTraining);
    const message = `Training completed. Version: ${trainingResult.version || 'unknown'}`;
    await finishRun(pool, run.id, 'success', message, trainingResult.rows_processed || null);
    return {
      ...run,
      status: 'success',
      message,
      training: trainingResult,
      risk_suggestion_training: riskSuggestionTraining,
    };
  } catch (error) {
    await finishRun(pool, run.id, 'failed', error.message, null);
    throw error;
  } finally {
    trainRunning = false;
  }
};

const getModelMetadata = async () => {
  const pool = await poolPromise;
  if (!pool) {
    throw new Error('Database connection unavailable');
  }

  await ensureMlRuntimeTables(pool);
  const metadataPath = path.join(MODELS_DIR, 'model_metadata.json');
  const riskSuggestionMetadataPath = path.join(MODELS_DIR, 'risk_suggestion_model_metadata.json');
  const fileMetadata = fs.existsSync(metadataPath)
    ? JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
    : null;
  const riskSuggestionMetadata = fs.existsSync(riskSuggestionMetadataPath)
    ? JSON.parse(fs.readFileSync(riskSuggestionMetadataPath, 'utf8'))
    : null;
  const registry = await pool.request().query(`
    SELECT TOP 20 *
    FROM dbo.ml_model_registry
    ORDER BY is_active DESC, created_at DESC
  `);

  return {
    metadata_path: metadataPath,
    file_metadata: fileMetadata,
    risk_suggestion_metadata_path: riskSuggestionMetadataPath,
    risk_suggestion_metadata: riskSuggestionMetadata,
    registry: registry.recordset,
  };
};

module.exports = {
  ensureMlRuntimeTables,
  runEtl,
  runTraining,
  getLatestRuns,
  getModelMetadata,
};
