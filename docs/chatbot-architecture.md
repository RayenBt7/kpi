# Architecture Chatbot Ollama

## Modes

- Chat normal: `POST /api/ollama/chat`, public, sans authentification et sans acces base de donnees.
- Chat entreprise: `POST /api/ollama/enterprise-chat`, protege par JWT, connecte aux donnees KPI et aux agregats administratifs autorises en lecture seule.

## Flux entreprise

Utilisateur -> Backend API -> validation du message -> detection intention -> selection d'une requete SQL parametree -> verification SQL -> execution via pool read-only -> construction du contexte metier -> Ollama -> reponse analytique.

## Services backend

- `backend/services/ollamaService.js`: client Ollama centralise.
- `backend/services/sqlSafetyService.js`: garde SQL strict.
- `backend/services/enterpriseChatService.js`: detection d'intention, selection de requete, contexte metier et appel Ollama.

## Securite SQL

La couche `sqlSafetyService` applique:

- seules les requetes `SELECT` ou `WITH` sont acceptees;
- blocage de `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, `ALTER`, `CREATE`, `MERGE`, `EXEC`, `GRANT`, `REVOKE`, `DBCC`, etc.;
- blocage des requetes multiples avec `;`;
- blocage des commentaires SQL;
- allowlist de tables KPI uniquement;
- limite automatique via `TOP` quand necessaire.

Les valeurs utilisateur sont passees avec des parametres `mssql` et non concatenees dans le SQL.

## Compte read-only

Variables recommandees:

```env
DB_READONLY_USER=kpi_reader
DB_READONLY_PASSWORD=********
DB_READONLY_DATABASE=kpi
```

Le compte SQL Server doit avoir uniquement `SELECT` sur les tables KPI necessaires. Exemple SQL Server:

```sql
CREATE USER kpi_reader FOR LOGIN kpi_reader;
GRANT SELECT ON dbo.Indicateur TO kpi_reader;
GRANT SELECT ON dbo.Indicateur_Annee TO kpi_reader;
GRANT SELECT ON dbo.objectiv TO kpi_reader;
GRANT SELECT ON dbo.realise TO kpi_reader;
GRANT SELECT ON dbo.Plan_action TO kpi_reader;
GRANT SELECT ON dbo.indicator_assignments TO kpi_reader;
GRANT SELECT ON dbo.responsable TO kpi_reader;
GRANT SELECT ON dbo.users TO kpi_reader;
GRANT SELECT ON dbo.ml_anomalies TO kpi_reader;
GRANT SELECT ON dbo.ml_risk_scores TO kpi_reader;
GRANT SELECT ON dbo.ml_suggestions TO kpi_reader;
GRANT SELECT ON dbo.ml_kpi_monthly_dataset TO kpi_reader;
```

## Prompts systeme

Chat normal: assistant general en francais, sans acces aux donnees internes.

Chat entreprise: assistant KPI AAF, reponse professionnelle, basee uniquement sur le contexte SQL valide, sans invention de chiffres et sans proposer de modification de base.

## Frontend

- `frontend/src/components/GlobalChatbot.jsx`: chat public affiche hors session.
- `frontend/src/pages/KPI.jsx`: chat interne avec bascule `Normal` / `Entreprise`.
- `frontend/src/services/api.js`: fonctions `ollamaPublicChat` et `ollamaEnterpriseChat`.
