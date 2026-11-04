# Plan de Reconstruction du Dashboard

## Contexte Actuel

Le fichier KPI.jsx actuel contient ~170,000 caractères avec les fonctionnalités suivantes :

- **3 vues principales** : Dashboard, KPI, Plan Action
- **Gestion des indicateurs** : Objectifs, Réalisés
- **Gestion des processus** : CRUD complet
- **Modales d'édition** : Objectifs, Réalisés
- **Admin Panel** : Création processus/indicateurs
- **Graphiques** : Recharts (Line, Bar, Area charts)
- **Filtres avancés** : Recherche, year, periodicity
- **Theming** : Dark/Light mode
- **CSS** : Dashboard.css (~75KB)

---

## Structure Backend (API Routes)

| Endpoint                                    | Description                            |
| ------------------------------------------- | -------------------------------------- |
| `GET /api/dashboard/all-summary`            | Vue d'ensemble de tous les indicateurs |
| `GET /api/dashboard/processus`              | Liste des processus                    |
| `GET /api/dashboard/processus/:processus`   | Indicateurs par processus              |
| `GET /api/dashboard/plan-action/all`        | Tous les plans d'action                |
| `GET /api/dashboard/actions`                | Plans d'action avec détails            |
| `POST /api/dashboard/processus`             | Créer processus + indicateurs          |
| `PUT /api/dashboard/indicateur/:indicateur` | Modifier indicateur                    |
| `PUT /api/dashboard/objective/:indicateur`  | Définir objectifs                      |
| `PUT /api/dashboard/realise/:indicateur`    | Saisir réalisés                        |

---

## Options de Reconstruction

### Option A : Refactorisation Progressive (RECOMMANDÉE)

**Approche** : Conserver les fonctionnalités existantes mais restructurer en composants modulares.

```
frontend/src/
├── components/dashboard/
│   ├── DashboardHeader.jsx
│   ├── ProcessusSelector.jsx
│   ├── IndicatorTable.jsx
│   ├── ObjectiveModal.jsx
│   ├── RealiseModal.jsx
│   ├── ActionPlanView.jsx
│   ├── KPIView.jsx
│   └── ChartPanel.jsx
├── pages/
│   └── KPI.jsx (simplifié - orchestrateur)
└── hooks/
    └── useDashboard.js
```

**Avantages** :

- Réutilisation des composants
- Maintenance facilitée
- Tests unitaires possibles
- Évolutions plus simples

**Inconvénients** :

- Migration progressive nécessaire

---

### Option B : Nouvelle Architecture Complète

**Approche** : Créer un nouveau dashboard avec architecture moderne.

```
frontend/src/
├── features/dashboard/
│   ├── components/
│   ├── hooks/
│   ├── api/
│   └── slices/
├── pages/
│   └── NewDashboard.jsx
└── App.jsx (nouveau routing)
```

**Avantages** :

- Code propre depuis le début
- Technologies modernes
- Meilleure performance

**Inconvénients** :

- Double développement
- Migration complète nécessaire

---

### Option C : Amélioration UI/UX Seule

**Approche** : Garder la logique existante mais redesign complet.

- Nouveau design system (Tailwind + CSS moderne)
- Layout responsive amélioré
- Nouvelles couleurs et animations
- Tables améliore avec virtualisation

**Avantages** :

- Temps de développement réduit
- Conservation de toute la logique métier

---

## Plan d'Action Recommandé (Option A)

### Phase 1 : Extraction des Composants

1. Créer dossier `components/dashboard/`
2. Extraire `DashboardHeader` (sidebar + navigation)
3. Extraire `ProcessusSelector` (menu dropdown)
4. Extraire `IndicatorTable` (tableau principal)
5. Extraire les modales (Objectifs, Réalisés)

### Phase 2 : Hooks Personnalisés

1. Créer `useDashboardProcessus` (gestion processus)
2. Créer `useDashboardIndicateurs` (gestion indicateurs)
3. Créer `useDashboardActions` (plans action)
4. Créer `useDashboardPermissions` (permissions)

### Phase 3 : Refactorisation KPI.jsx

1. Simplifier en composant orchestrateur
2. Utiliser les nouveaux hooks
3. Importer les composants extraits

### Phase 4 : Optimisations

1. Implémenter React.memo où nécessaire
2. Ajouter chargement skeletal
3. Améliorer gestion d'erreurs

---

## Files Requises

### Backend (pas de modification prévue)

- `backend/routes/dashboard.js` (déjà complet)
- `backend/routes/actions.js`
- `backend/routes/indicateurs.js`
- `backend/routes/objectives.js`

### Frontend (nouveaux fichiers)

- `frontend/src/components/dashboard/*.jsx` (nouveaux composants)
- `frontend/src/hooks/*.js` (nouveaux hooks)
- `frontend/src/pages/KPI.jsx` (refactorisé)
- `frontend/src/styles/Dashboard.css` (amélioré si nécessaire)

---

## Dépendances Actuelles (déjà installées)

- react-router-dom
- recharts
- react-icons/fa
- tailwindcss (via PostCSS)

---

## Prochaines Étapes

1. **Valider l'option choisie** avec l'utilisateur
2. **Définir les priorités** : composants à extraire en premier
3. **Estimer la complexité** selon les fonctionnalités critiques
4. **Commencer l'implémentation** phase par phase
