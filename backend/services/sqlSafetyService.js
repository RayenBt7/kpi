const FORBIDDEN_SQL = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|MERGE|EXEC|EXECUTE|GRANT|REVOKE|DENY|BACKUP|RESTORE|DBCC|BULK)\b/i;
const ALLOWED_TABLES = new Set([
    'dbo.indicateur',
    'dbo.indicateur_annee',
    'dbo.objectiv',
    'dbo.realise',
    'dbo.plan_action',
    'dbo.indicator_assignments',
    'dbo.responsable',
    'dbo.users',
    'dbo.ml_anomalies',
    'dbo.ml_risk_scores',
    'dbo.ml_suggestions',
    'dbo.ml_kpi_monthly_dataset'
]);

const normalizeSql = (query) => String(query || '').replace(/\s+/g, ' ').trim();

const stripLiterals = (query) =>
    String(query || '')
        .replace(/N?'([^']|'')*'/gi, "''")
        .replace(/\[[^\]]+\]/g, '[]');

const extractReferencedTables = (query) => {
    const tables = [];
    const pattern = /\b(?:FROM|JOIN)\s+((?:\[?dbo\]?\.)?\[?[a-zA-Z_][\w]*\]?)/gi;
    let match;

    while ((match = pattern.exec(query)) !== null) {
        const normalized = match[1]
            .replace(/\[|\]/g, '')
            .toLowerCase();
        const tableName = normalized.includes('.') ? normalized : `dbo.${normalized}`;
        tables.push(tableName);
    }

    return tables;
};

const hasTopOrOffset = (query) => /\bSELECT\s+(?:DISTINCT\s+)?TOP\s*\(?\s*\d+/i.test(query) || /\bOFFSET\s+\d+\s+ROWS\b/i.test(query);

const ensureSelectOnly = (query) => {
    const sql = normalizeSql(query);
    const withoutLiterals = stripLiterals(sql);

    if (!sql) {
        throw new Error('Requete SQL vide.');
    }

    if (!/^(SELECT|WITH)\b/i.test(sql)) {
        throw new Error('Seules les requetes SELECT sont autorisees.');
    }

    if (FORBIDDEN_SQL.test(withoutLiterals)) {
        throw new Error('Mot-cle SQL interdit detecte.');
    }

    if (/;/.test(withoutLiterals)) {
        throw new Error('Les requetes multiples sont interdites.');
    }

    if (/--|\/\*/.test(withoutLiterals)) {
        throw new Error('Les commentaires SQL sont interdits.');
    }

    const referencedTables = extractReferencedTables(withoutLiterals);
    const blockedTable = referencedTables.find((table) => !ALLOWED_TABLES.has(table));
    if (blockedTable) {
        throw new Error(`Table non autorisee: ${blockedTable}.`);
    }

    return {
        sql,
        referencedTables
    };
};

const enforceResultLimit = (query, limit = 50) => {
    const sql = normalizeSql(query);
    if (!/^SELECT\b/i.test(sql) || hasTopOrOffset(sql)) {
        return sql;
    }

    return sql.replace(/^SELECT\s+/i, `SELECT TOP (${limit}) `);
};

const validateSafeSelect = (query, { limit = 50 } = {}) => {
    const limitedQuery = enforceResultLimit(query, limit);
    return ensureSelectOnly(limitedQuery);
};

module.exports = {
    ALLOWED_TABLES,
    validateSafeSelect,
    ensureSelectOnly,
    enforceResultLimit,
    extractReferencedTables
};
