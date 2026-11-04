const sql = require('mssql');
const { poolPromise } = require('../../config/database');

const APPROVED_ALIAS_MAPPINGS = [
  {
    alias_name: 'c30_incid',
    canonical_indicateur: 'c30_incidSME',
    source_table: 'all',
    note: 'High-confidence legacy alias',
  },
  {
    alias_name: 'm20_maladi',
    canonical_indicateur: 'm20new_malad',
    source_table: 'all',
    note: 'High-confidence legacy alias',
  },
  {
    alias_name: 'm30_smeold',
    canonical_indicateur: 'm30_sme',
    source_table: 'all',
    note: 'High-confidence legacy alias',
  },
  {
    alias_name: 'code_x',
    canonical_indicateur: 'X',
    source_table: 'all',
    note: 'High-confidence legacy alias',
  },
];

const SOURCE_QUERIES = {
  objectifs: `
    SELECT DISTINCT LTRIM(RTRIM(indicateur)) AS alias_name
    FROM dbo.objectiv
    WHERE LTRIM(RTRIM(COALESCE(indicateur, ''))) <> ''
  `,
  realises: `
    SELECT DISTINCT LTRIM(RTRIM(indicateur)) AS alias_name
    FROM dbo.realise
    WHERE LTRIM(RTRIM(COALESCE(indicateur, ''))) <> ''
  `,
  actions: `
    SELECT DISTINCT LTRIM(RTRIM(CAST(Indicateur AS NVARCHAR(255)))) AS alias_name
    FROM dbo.Plan_action
    WHERE LTRIM(RTRIM(COALESCE(CAST(Indicateur AS NVARCHAR(255)), ''))) <> ''
  `,
};

function normalizeIndicator(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) {
    return '';
  }

  return raw
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[-/\\]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function deleteBlankIndicatorRows(pool) {
  const result = await pool.request().query(`
    DELETE FROM dbo.Indicateur
    WHERE
      LTRIM(RTRIM(COALESCE(Indicateur, ''))) = ''
      AND LTRIM(RTRIM(COALESCE(Designation, ''))) = ''
      AND LTRIM(RTRIM(COALESCE(Nordre, ''))) = ''
  `);

  return result.rowsAffected?.[0] || 0;
}

async function fetchCanonicalIndicators(pool) {
  const result = await pool.request().query(`
    SELECT DISTINCT LTRIM(RTRIM(Indicateur)) AS indicateur
    FROM dbo.Indicateur
    WHERE LTRIM(RTRIM(COALESCE(Indicateur, ''))) <> ''
  `);

  const canonicalByNorm = new Map();
  result.recordset.forEach((row) => {
    const canonical = String(row.indicateur ?? '').trim();
    const norm = normalizeIndicator(canonical);
    if (canonical && norm && !canonicalByNorm.has(norm)) {
      canonicalByNorm.set(norm, canonical);
    }
  });

  return canonicalByNorm;
}

async function upsertAlias(pool, {
  alias_name,
  alias_norm,
  canonical_indicateur = null,
  canonical_norm = null,
  source_table,
  status,
  note = null,
}) {
  await pool.request()
    .input('alias_name', sql.NVarChar(255), alias_name)
    .input('alias_norm', sql.NVarChar(255), alias_norm)
    .input('canonical_indicateur', sql.NVarChar(255), canonical_indicateur)
    .input('canonical_norm', sql.NVarChar(255), canonical_norm)
    .input('source_table', sql.NVarChar(50), source_table)
    .input('status', sql.NVarChar(30), status)
    .input('note', sql.NVarChar(500), note)
    .query(`
      MERGE dbo.ml_indicator_aliases AS target
      USING (
        SELECT
          @alias_norm AS alias_norm,
          @source_table AS source_table
      ) AS source
        ON target.alias_norm = source.alias_norm
       AND target.source_table = source.source_table
      WHEN MATCHED THEN
        UPDATE SET
          alias_name = @alias_name,
          canonical_indicateur = @canonical_indicateur,
          canonical_norm = @canonical_norm,
          status = @status,
          note = @note,
          updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (
          alias_name,
          alias_norm,
          canonical_indicateur,
          canonical_norm,
          source_table,
          status,
          note,
          created_at,
          updated_at
        )
        VALUES (
          @alias_name,
          @alias_norm,
          @canonical_indicateur,
          @canonical_norm,
          @source_table,
          @status,
          @note,
          GETDATE(),
          GETDATE()
        );
    `);
}

async function seedApprovedAliases(pool, canonicalByNorm) {
  let applied = 0;

  for (const mapping of APPROVED_ALIAS_MAPPINGS) {
    const alias_name = mapping.alias_name;
    const alias_norm = normalizeIndicator(alias_name);
    const canonical_norm = normalizeIndicator(mapping.canonical_indicateur);
    const canonical_indicateur = canonicalByNorm.get(canonical_norm);

    if (!alias_norm || !canonical_indicateur) {
      continue;
    }

    await upsertAlias(pool, {
      alias_name,
      alias_norm,
      canonical_indicateur,
      canonical_norm,
      source_table: mapping.source_table,
      status: 'approved',
      note: mapping.note,
    });
    applied += 1;
  }

  return applied;
}

async function seedPendingAliases(pool, canonicalByNorm) {
  let insertedOrUpdated = 0;

  for (const [sourceTable, query] of Object.entries(SOURCE_QUERIES)) {
    const result = await pool.request().query(query);

    for (const row of result.recordset) {
      const alias_name = String(row.alias_name ?? '').trim();
      const alias_norm = normalizeIndicator(alias_name);

      if (!alias_name || !alias_norm) {
        continue;
      }

      if (canonicalByNorm.has(alias_norm)) {
        continue;
      }

      await upsertAlias(pool, {
        alias_name,
        alias_norm,
        canonical_indicateur: null,
        canonical_norm: null,
        source_table: sourceTable,
        status: 'pending',
        note: 'Unresolved alias discovered during nightly audit',
      });
      insertedOrUpdated += 1;
    }
  }

  return insertedOrUpdated;
}

async function countAliases(pool) {
  const result = await pool.request().query(`
    SELECT
      status,
      COUNT(*) AS alias_count
    FROM dbo.ml_indicator_aliases
    GROUP BY status
    ORDER BY status
  `);

  return result.recordset;
}

async function removePendingCoveredByApproved(pool) {
  const result = await pool.request().query(`
    DELETE pending
    FROM dbo.ml_indicator_aliases AS pending
    WHERE
      pending.status = 'pending'
      AND EXISTS (
        SELECT 1
        FROM dbo.ml_indicator_aliases AS approved
        WHERE
          approved.alias_norm = pending.alias_norm
          AND approved.status = 'approved'
          AND (
            approved.source_table = 'all'
            OR approved.source_table = pending.source_table
          )
      )
  `);

  return result.rowsAffected?.[0] || 0;
}

async function syncMlIndicatorAliases() {
  try {
    const pool = await poolPromise;

    const deletedBlankRows = await deleteBlankIndicatorRows(pool);
    const canonicalByNorm = await fetchCanonicalIndicators(pool);
    const approvedCount = await seedApprovedAliases(pool, canonicalByNorm);
    const pendingCount = await seedPendingAliases(pool, canonicalByNorm);
    const redundantPendingRemoved = await removePendingCoveredByApproved(pool);
    const aliasStats = await countAliases(pool);

    console.log(`Deleted blank indicator rows: ${deletedBlankRows}`);
    console.log(`Approved aliases upserted: ${approvedCount}`);
    console.log(`Pending aliases upserted: ${pendingCount}`);
    console.log(`Redundant pending aliases removed: ${redundantPendingRemoved}`);
    console.log('Alias table status counts:');
    aliasStats.forEach((row) => {
      console.log(`- ${row.status}: ${row.alias_count}`);
    });
  } catch (error) {
    console.error('Error syncing ML indicator aliases:', error);
    process.exit(1);
  }
}

syncMlIndicatorAliases();
