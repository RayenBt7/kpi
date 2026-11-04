# Développement d'un module de suivi et d'analyse prédictive des indicateurs de performance (KPI) avec IA/ML pour la production automobile AAF

**AAF KPI-ML Dashboard** est une application full-stack innovante conçue pour le suivi en temps réel et l'analyse prédictive des indicateurs de performance (KPI) dans l'industrie automobile.

## Fonctionnalités principales :

- **Dashboard interactif** (React/Vite/Tailwind) : Visualisation des KPI, indicateurs de production, objectifs vs réalisés
- **Machine Learning Python** :
  - Détection d'anomalies
  - Scoring de risque sur les indicateurs
  - Suggestions d'actions automatisées
  - Nettoyage/normalisation des données SQL Server
- **Backend Node.js/Express** : API sécurisée (JWT), gestion utilisateurs/admin, notifications, permissions
- **Processus automatisés** : Pipeline nightly ML, migrations DB, cron jobs

## Domaines métier couverts :

```
Câblage automobile | Tests RF/DC | Sertissage | Soudure | Rivetage
Usinage | Contrôles qualité | Production en série | Certifications
```

## Architecture :

```
Frontend (React) ↔ Backend (Node/Express + SQL Server) ↔ ML Pipeline (Python)
                    ↓
              Admin | Notifications | Rapports
```

**Technos** : React, Node.js, Python ML (joblib), Tailwind, SQL Server, JWT Auth

**Objectif** : Aider les responsables production à anticiper les dérives, optimiser les processus et réduire les temps d'arrêt grâce à l'IA.

## Quick Start

```
cd backend && npm start
cd frontend && npm run dev
cd ml && python -m ml.run_nightly
```
