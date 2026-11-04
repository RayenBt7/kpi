const { sql, poolPromise, readOnlyPoolPromise } = require('../config/database');
const UserPermission = require('../models/UserPermission');
const ollamaService = require('./ollamaService');
const { validateSafeSelect } = require('./sqlSafetyService');

const MONTHS = [
    ['janv', 'Janvier'],
    ['fev', 'Fevrier'],
    ['mars', 'Mars'],
    ['avril', 'Avril'],
    ['mai', 'Mai'],
    ['juin', 'Juin'],
    ['juil', 'Juillet'],
    ['aout', 'Aout'],
    ['sept', 'Septembre'],
    ['oct', 'Octobre'],
    ['nov', 'Novembre'],
    ['decem', 'Decembre']
];

const ENTERPRISE_KEYWORDS = [
    'kpi',
    'indicateur',
    'objectif',
    'realise',
    'réalisé',
    'ecart',
    'écart',
    'performance',
    'tendance',
    'anomalie',
    'risque',
    'processus',
    'plan',
    'action',
    'production',
    'qualite',
    'qualité',
    'aaf',
    'user',
    'users',
    'utilisateur',
    'utilisateurs',
    'compte',
    'comptes',
    'admin',
    'administrateur'
];

const normalizeText = (value) =>
    String(value ?? '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

const toNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const OBJECTIVE_ANNUAL_EXPRESSION = MONTHS
    .map(([month]) => `COALESCE(TRY_CONVERT(float, o.${month}), 0)`)
    .join(' + ');
const REALISE_ANNUAL_EXPRESSION = 'TRY_CONVERT(float, r.annuel)';

const isEnterpriseQuestion = (question) => {
    const normalized = normalizeText(question);
    return ENTERPRISE_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)));
};

const getReadPool = async () => {
    const readOnlyPool = await readOnlyPoolPromise;
    return readOnlyPool || poolPromise;
};

const getAllowedIndicators = async (user) => {
    if (user?.isAdmin) {
        return null;
    }

    const permissions = await UserPermission.getByUserId(user.id);
    return [...new Set(permissions.map((permission) => String(permission.indicateur || '').trim()).filter(Boolean))];
};

const bindIndicatorScope = (request, allowedIndicators) => {
    if (!Array.isArray(allowedIndicators)) {
        return { request, clause: '' };
    }

    if (allowedIndicators.length === 0) {
        return { request, clause: ' AND 1 = 0' };
    }

    const params = allowedIndicators.map((indicator, index) => {
        const name = `allowedIndicator${index}`;
        request.input(name, sql.NVarChar(255), indicator);
        return `@${name}`;
    });

    return {
        request,
        clause: ` AND LTRIM(RTRIM(CAST(i.Indicateur AS NVARCHAR(255)))) IN (${params.join(', ')})`
    };
};

const loadIndicatorCatalog = async (pool, allowedIndicators) => {
    let request = pool.request();
    const scope = bindIndicatorScope(request, allowedIndicators);
    request = scope.request;

    const query = `
        SELECT TOP (200)
            i.Indicateur,
            i.Designation,
            i.Processus
        FROM dbo.Indicateur AS i
        WHERE NULLIF(LTRIM(RTRIM(CAST(i.Indicateur AS NVARCHAR(255)))), '') IS NOT NULL
        ${scope.clause}
        ORDER BY i.Processus, i.Designation, i.Indicateur
    `;

    validateSafeSelect(query, { limit: 200 });
    const result = await request.query(query);
    return result.recordset || [];
};

const detectIndicator = (question, catalog) => {
    const normalizedQuestion = normalizeText(question);
    return catalog.find((item) => {
        const code = normalizeText(item.Indicateur);
        const designation = normalizeText(item.Designation);
        return (code && normalizedQuestion.includes(code)) || (designation && normalizedQuestion.includes(designation));
    });
};

const detectIntent = (question) => {
    const normalized = normalizeText(question);

    if (/\b(user|users|utilisateur|utilisateurs|compte|comptes|admin|administrateur)\w*/.test(normalized)) {
        return 'users';
    }

    if (/\b(anomal|atyp|exception|alerte)\w*/.test(normalized)) {
        return 'anomalies';
    }

    if (/\b(risque|critique|priorit|prediction|prevision)\w*/.test(normalized)) {
        return 'risks';
    }

    if (/\b(action|plan|recommand|cause|retard)\w*/.test(normalized)) {
        return 'actions';
    }

    if (/\b(ecart|objectif|realise|realisation|compare|comparaison|tendance|evolution)\w*/.test(normalized)) {
        return 'performance';
    }

    return 'overview';
};

const buildQueryPlan = ({ intent, indicator, allowedIndicators }) => {
    const bind = (request) => {
        let nextRequest = request;
        const filters = [];

        if (indicator?.Indicateur) {
            nextRequest.input('targetIndicator', sql.NVarChar(255), indicator.Indicateur);
            filters.push('LTRIM(RTRIM(CAST(i.Indicateur AS NVARCHAR(255)))) = @targetIndicator');
        }

        const scope = bindIndicatorScope(nextRequest, allowedIndicators);
        nextRequest = scope.request;
        if (scope.clause) {
            filters.push(scope.clause.replace(/^\s*AND\s+/i, ''));
        }

        return {
            request: nextRequest,
            where: filters.length ? `WHERE ${filters.join(' AND ')}` : ''
        };
    };

    if (intent === 'users') {
        return {
            intent,
            title: 'Synthese utilisateurs',
            bind: (request) => ({ request, where: '' }),
            sqlText: () => `
                SELECT
                    COUNT(*) AS total_users,
                    SUM(CASE WHEN COALESCE(isAdmin, 0) = 1 THEN 1 ELSE 0 END) AS admin_users,
                    SUM(CASE WHEN COALESCE(isAdmin, 0) = 0 THEN 1 ELSE 0 END) AS standard_users,
                    SUM(CASE WHEN LOWER(LTRIM(RTRIM(COALESCE(user_type, 'user')))) = 'pilote' THEN 1 ELSE 0 END) AS pilote_users,
                    SUM(CASE WHEN LOWER(LTRIM(RTRIM(COALESCE(user_type, 'user')))) = 'responsable' THEN 1 ELSE 0 END) AS responsable_users,
                    SUM(CASE WHEN LOWER(LTRIM(RTRIM(COALESCE(user_type, 'user')))) = 'user' THEN 1 ELSE 0 END) AS simple_users
                FROM dbo.users
            `
        };
    }

    if (intent === 'anomalies') {
        return {
            intent,
            title: 'Anomalies KPI recentes',
            bind,
            sqlText: ({ where }) => `
                SELECT TOP (30)
                    i.Processus,
                    COALESCE(i.Designation, a.canonical_indicateur) AS Designation,
                    a.canonical_indicateur AS Indicateur,
                    a.year_value,
                    a.month,
                    a.objectif,
                    a.realise,
                    a.ecart_absolu,
                    a.ecart_pourcent,
                    a.anomaly_probability,
                    a.prediction_source,
                    a.created_at
                FROM dbo.ml_anomalies AS a
                LEFT JOIN dbo.Indicateur AS i
                    ON LTRIM(RTRIM(CAST(i.Indicateur AS NVARCHAR(255)))) = LTRIM(RTRIM(CAST(a.canonical_indicateur AS NVARCHAR(255))))
                ${where}
                ORDER BY a.created_at DESC, ABS(COALESCE(a.ecart_pourcent, 0)) DESC
            `
        };
    }

    if (intent === 'risks') {
        return {
            intent,
            title: 'Risques et predictions KPI',
            bind,
            sqlText: ({ where }) => `
                SELECT TOP (30)
                    i.Processus,
                    COALESCE(i.Designation, r.canonical_indicateur) AS Designation,
                    r.canonical_indicateur AS Indicateur,
                    r.risk_level,
                    r.risk_score,
                    r.performance_gap,
                    r.volatility,
                    r.anomaly_rate,
                    r.prediction_source,
                    r.created_at
                FROM dbo.ml_risk_scores AS r
                LEFT JOIN dbo.Indicateur AS i
                    ON LTRIM(RTRIM(CAST(i.Indicateur AS NVARCHAR(255)))) = LTRIM(RTRIM(CAST(r.canonical_indicateur AS NVARCHAR(255))))
                ${where}
                ORDER BY r.risk_score DESC, r.created_at DESC
            `
        };
    }

    if (intent === 'actions') {
        return {
            intent,
            title: 'Plans action KPI',
            bind,
            sqlText: ({ where }) => `
                SELECT TOP (30)
                    i.Processus,
                    COALESCE(i.Designation, pa.Indicateur) AS Designation,
                    pa.Indicateur,
                    pa.RootCause,
                    pa.action,
                    pa.responsable,
                    pa.datecreation,
                    pa.dateclotprevu,
                    pa.dateclot,
                    pa.efficacit
                FROM dbo.Plan_action AS pa
                LEFT JOIN dbo.Indicateur AS i
                    ON LTRIM(RTRIM(CAST(i.Indicateur AS NVARCHAR(255)))) = LTRIM(RTRIM(CAST(pa.Indicateur AS NVARCHAR(255))))
                ${where}
                ORDER BY COALESCE(TRY_CONVERT(datetime, pa.datecreation), GETDATE()) DESC
            `
        };
    }

    if (intent === 'performance') {
        return {
            intent,
            title: 'Objectif vs realise',
            bind,
            sqlText: ({ where }) => `
                SELECT TOP (40)
                    i.Processus,
                    i.Indicateur,
                    i.Designation,
                    i.Signe,
                    i.Unite,
                    o.date1 AS objective_date,
                    r.date1 AS realise_date,
                    (${OBJECTIVE_ANNUAL_EXPRESSION}) AS objectif_annuel,
                    ${REALISE_ANNUAL_EXPRESSION} AS realise_annuel,
                    (COALESCE(${REALISE_ANNUAL_EXPRESSION}, 0) - (${OBJECTIVE_ANNUAL_EXPRESSION})) AS ecart_annuel,
                    o.janv AS objectif_janv,
                    r.janv AS realise_janv,
                    o.fev AS objectif_fev,
                    r.fev AS realise_fev,
                    o.mars AS objectif_mars,
                    r.mars AS realise_mars,
                    o.avril AS objectif_avril,
                    r.avril AS realise_avril,
                    o.mai AS objectif_mai,
                    r.mai AS realise_mai,
                    o.juin AS objectif_juin,
                    r.juin AS realise_juin,
                    o.juil AS objectif_juil,
                    r.juil AS realise_juil,
                    o.aout AS objectif_aout,
                    r.aout AS realise_aout,
                    o.sept AS objectif_sept,
                    r.sept AS realise_sept,
                    o.oct AS objectif_oct,
                    r.oct AS realise_oct,
                    o.nov AS objectif_nov,
                    r.nov AS realise_nov,
                    o.decem AS objectif_decem,
                    r.decem AS realise_decem
                FROM dbo.Indicateur AS i
                OUTER APPLY (
                    SELECT TOP (1) *
                    FROM dbo.objectiv AS o
                    WHERE LTRIM(RTRIM(CAST(o.indicateur AS NVARCHAR(255)))) = LTRIM(RTRIM(CAST(i.Indicateur AS NVARCHAR(255))))
                    ORDER BY TRY_CONVERT(datetime, o.date1) DESC, o.date1 DESC, o.datenow DESC
                ) AS o
                OUTER APPLY (
                    SELECT TOP (1) *
                    FROM dbo.realise AS r
                    WHERE LTRIM(RTRIM(CAST(r.indicateur AS NVARCHAR(255)))) = LTRIM(RTRIM(CAST(i.Indicateur AS NVARCHAR(255))))
                    ORDER BY TRY_CONVERT(datetime, r.date1) DESC, r.date1 DESC, r.datenow DESC
                ) AS r
                ${where}
                ORDER BY ABS(COALESCE(${REALISE_ANNUAL_EXPRESSION}, 0) - (${OBJECTIVE_ANNUAL_EXPRESSION})) DESC
            `
        };
    }

    return {
        intent,
        title: 'Vue generale KPI',
        bind,
        sqlText: ({ where }) => `
            SELECT TOP (50)
                i.Processus,
                i.Indicateur,
                i.Designation,
                i.Signe,
                i.Unite,
                ia.pilote_name,
                ia.responsable_name,
                (${OBJECTIVE_ANNUAL_EXPRESSION}) AS objectif_annuel,
                ${REALISE_ANNUAL_EXPRESSION} AS realise_annuel,
                (COALESCE(${REALISE_ANNUAL_EXPRESSION}, 0) - (${OBJECTIVE_ANNUAL_EXPRESSION})) AS ecart_annuel
            FROM dbo.Indicateur AS i
            LEFT JOIN dbo.indicator_assignments AS ia
                ON LTRIM(RTRIM(CAST(ia.indicateur AS NVARCHAR(255)))) = LTRIM(RTRIM(CAST(i.Indicateur AS NVARCHAR(255))))
            OUTER APPLY (
                SELECT TOP (1) *
                FROM dbo.objectiv AS o
                WHERE LTRIM(RTRIM(CAST(o.indicateur AS NVARCHAR(255)))) = LTRIM(RTRIM(CAST(i.Indicateur AS NVARCHAR(255))))
                ORDER BY TRY_CONVERT(datetime, o.date1) DESC, o.date1 DESC, o.datenow DESC
            ) AS o
            OUTER APPLY (
                SELECT TOP (1) *
                FROM dbo.realise AS r
                WHERE LTRIM(RTRIM(CAST(r.indicateur AS NVARCHAR(255)))) = LTRIM(RTRIM(CAST(i.Indicateur AS NVARCHAR(255))))
                ORDER BY TRY_CONVERT(datetime, r.date1) DESC, r.date1 DESC, r.datenow DESC
            ) AS r
            ${where}
            ORDER BY i.Processus, i.Designation, i.Indicateur
        `
    };
};

const summarizeRows = (rows) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    if (safeRows.length === 0) {
        return {
            count: 0,
            sample: [],
            metrics: {}
        };
    }

    const numericGaps = safeRows
        .map((row) => toNumber(row.ecart_annuel ?? row.performance_gap ?? row.ecart_pourcent ?? row.ecart_absolu))
        .filter((value) => value !== null);

    const metrics = {
        lignes: safeRows.length
    };

    if (numericGaps.length > 0) {
        metrics.ecart_min = Math.min(...numericGaps);
        metrics.ecart_max = Math.max(...numericGaps);
        metrics.ecart_moyen = Number((numericGaps.reduce((sum, value) => sum + value, 0) / numericGaps.length).toFixed(2));
    }

    return {
        count: safeRows.length,
        metrics,
        sample: safeRows.slice(0, 12)
    };
};

const buildBusinessContext = ({ question, plan, sqlText, rows, catalog, indicator }) => {
    const summary = summarizeRows(rows);
    return [
        `Question utilisateur: ${question}`,
        `Intention detectee: ${plan.intent}`,
        `Perimetre: ${indicator ? `${indicator.Indicateur} - ${indicator.Designation || ''}` : 'multi-indicateurs'}`,
        `Requete SQL validee en lecture seule: ${sqlText}`,
        `Volume retourne: ${summary.count} ligne(s).`,
        `Metriques rapides: ${JSON.stringify(summary.metrics)}`,
        `Extrait des resultats: ${JSON.stringify(summary.sample, null, 2)}`,
        `Catalogue disponible: ${catalog.slice(0, 20).map((item) => `${item.Indicateur}:${item.Designation}`).join(' | ')}`,
        `Mois disponibles pour objectif/realise: ${MONTHS.map(([, label]) => label).join(', ')}`
    ].join('\n');
};

const answerEnterpriseQuestion = async ({ question, user, model }) => {
    if (!isEnterpriseQuestion(question)) {
        return {
            response: "Je peux répondre uniquement aux questions liées aux KPI, aux performances, aux objectifs, aux réalisations, aux anomalies et aux plans d'action de l'entreprise.",
            refused: true
        };
    }

    const pool = await getReadPool();
    const allowedIndicators = await getAllowedIndicators(user);
    const catalog = await loadIndicatorCatalog(pool, allowedIndicators);
    const indicator = detectIndicator(question, catalog);
    const intent = detectIntent(question);
    const plan = buildQueryPlan({ intent, indicator, allowedIndicators });
    const bound = plan.bind(pool.request());
    const rawSql = plan.sqlText({ where: bound.where });
    const { sql: safeSql, referencedTables } = validateSafeSelect(rawSql, { limit: 50 });
    const result = await bound.request.query(safeSql);
    const context = buildBusinessContext({
        question,
        plan,
        sqlText: safeSql,
        rows: result.recordset || [],
        catalog,
        indicator
    });

    const systemPrompt = [
        "Tu es l'assistant entreprise AAF specialise KPI.",
        "Tu reponds en francais professionnel, de facon analytique et concise.",
        "Utilise uniquement le contexte metier fourni. N'invente jamais de chiffres absents du contexte.",
        "Explique les tendances, anomalies, ecarts objectif/realise et recommandations quand les donnees le permettent.",
        "Si le contexte est insuffisant, dis clairement quelles donnees manquent.",
        "Ne fournis jamais de SQL a executer a l'utilisateur et ne propose jamais de modification de base de donnees."
    ].join(' ');

    const completion = await ollamaService.chat({
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: context }
        ],
        max_tokens: 700,
        temperature: 0.25,
        top_p: 0.9
    });

    return {
        response: completion.text || 'Aucune reponse generee.',
        intent: plan.intent,
        sql: process.env.CHATBOT_DEBUG_SQL === 'true' ? safeSql : undefined,
        referencedTables,
        rowCount: result.recordset?.length || 0
    };
};

module.exports = {
    answerEnterpriseQuestion,
    isEnterpriseQuestion,
    detectIntent
};
