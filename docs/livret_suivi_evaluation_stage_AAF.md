# Livret de suivi et d'évaluation de stage

## Informations générales

**Formation :** Licence en Génie Logiciel  
**Type de stage :** Stage de Fin d'Études (PFE)  
**Entreprise d'accueil :** AAF Production  
**Période du stage :** du 10 février 2026 au 29 mai 2026, soit 108 jours correspondant à 15 semaines et 3 jours.  
**Sujet :** Développement d'un module de suivi et d'analyse prédictive des indicateurs de performance (KPI) avec intelligence artificielle et Machine Learning pour la production automobile AAF.

## 1. Sujet du stage

### Titre professionnel

Développement d'une plateforme décisionnelle intelligente pour le suivi, l'analyse et la prédiction des indicateurs de performance industriels d'AAF Production.

### Description complète

Le stage porte sur la conception et la réalisation d'une solution décisionnelle destinée au suivi des indicateurs de performance d'AAF Production. Dans l'environnement existant, les données relatives aux processus industriels, à la qualité, à la sécurité, à l'environnement et au management sont dispersées entre plusieurs sources, ce qui rend le pilotage global moins fluide et limite la capacité d'anticipation. Le projet consiste donc à centraliser les données KPI, à structurer un entrepôt de données exploitable, puis à développer une application web sécurisée permettant aux responsables, pilotes et administrateurs de consulter les indicateurs selon leurs droits d'accès.

La solution intègre un backend Node.js/Express assurant les API, l'authentification JWT, la gestion des rôles, les permissions, les notifications et l'envoi d'emails. Le frontend, développé avec React, Vite et Tailwind CSS, propose des tableaux de bord interactifs, des vues KPI, des filtres par processus, ainsi que des interfaces d'administration. Une composante Machine Learning en Python permet d'exploiter l'historique des données afin de détecter les anomalies, estimer les risques de non-atteinte des objectifs et produire des recommandations d'actions correctives. Le projet s'inscrit dans une démarche de Business Intelligence orientée métier, fondée sur la méthodologie Kimball et adaptée aux besoins opérationnels d'AAF Production.

## 2. Fiches de suivi mensuel

Le stage a été organisé en quatre phases logiques afin de couvrir progressivement l'analyse, la réalisation, l'intégration et la validation de la solution. Même si la durée réelle correspond à 15 semaines et 3 jours, le suivi est présenté en quatre mois fonctionnels.

| Mois | Période | Durée | Axe principal |
|---|---:|---:|---|
| Mois 1 | 10 février - 9 mars 2026 | 4 semaines | Cadrage, analyse métier, architecture et préparation du dashboard |
| Mois 2 | 10 mars - 6 avril 2026 | 4 semaines | Développement des fondations : dashboard, utilisateurs, rôles et permissions |
| Mois 3 | 7 avril - 4 mai 2026 | 4 semaines | Notifications email, intégration des données, IA/ML et enrichissement fonctionnel |
| Mois 4 | 5 mai - 29 mai 2026 | 3 semaines + 3 jours | Tests, validation, optimisation, rapport et finalisation |

Les fonctionnalités fondamentales suivies durant le stage sont le dashboard décisionnel, les espaces utilisateurs, les notifications email et l'intelligence artificielle intégrée.

### Mois 1 : Cadrage, analyse de l'existant et préparation du dashboard

**Activités réalisées :**

- Prise de connaissance de l'organisation d'AAF Production, de ses processus industriels et des besoins liés au suivi de la performance.
- Analyse des sources de données existantes relatives aux indicateurs, objectifs, réalisations, processus, responsables et plans d'action.
- Identification des limites du système actuel : dispersion des données, traitements manuels, absence de tableau de bord centralisé et manque d'anticipation prédictive.
- Définition des besoins fonctionnels et non fonctionnels de la solution, notamment l'authentification, la gestion des rôles, l'affectation des permissions et la consultation sécurisée des KPI.
- Identification des éléments à intégrer dans le futur dashboard KPI : indicateurs, objectifs, réalisés, processus, responsables, statuts visuels et plans d'action.
- Préparation des premières maquettes fonctionnelles du dashboard décisionnel et des parcours de consultation selon les profils utilisateurs.
- Étude comparative des approches décisionnelles et choix de la méthodologie Kimball pour structurer l'entrepôt de données.

**Résultats obtenus :**

- Vision claire du périmètre fonctionnel et technique du projet.
- Formalisation des besoins métiers prioritaires : centralisation des KPI, suivi objectif/réalisé, analyse par processus, détection des risques et traçabilité des actions.
- Première architecture logique de la solution : base opérationnelle, Data Warehouse, backend, frontend et pipeline Machine Learning.
- Définition des principaux profils utilisateurs : administrateur, responsable, pilote et utilisateur simple.
- Définition du périmètre du dashboard : visualisation des KPI, comparaison objectif/réalisé, filtres par processus et suivi des plans d'action.

**Difficultés rencontrées :**

- Compréhension progressive du sens métier de certains indicateurs, dont l'interprétation dépend du processus concerné et du sens d'amélioration attendu.
- Nécessité de distinguer les besoins purement descriptifs des besoins prédictifs afin d'éviter une solution limitée à un simple tableau de bord.
- Hétérogénéité des données et besoin de clarifier les relations entre indicateurs, objectifs, réalisations et actions correctives.

**Suggestions / prochaines activités :**

- Valider le périmètre retenu avec l'encadrant professionnel.
- Formaliser le modèle décisionnel cible et préparer la structure de l'entrepôt de données.
- Démarrer le développement des premiers écrans de l'application : connexion, dashboard KPI et espace d'administration.

### Mois 2 : Développement des fondations, dashboard et espaces utilisateurs

**Activités réalisées :**

- Conception du modèle décisionnel selon une logique de schéma en étoile, avec identification des tables de faits et des dimensions.
- Structuration des données autour des dimensions indicateur, processus, temps, utilisateur et action.
- Mise en place de l'architecture backend avec Node.js et Express pour exposer les API nécessaires à l'application.
- Développement des mécanismes d'authentification par JWT, de contrôle d'accès et de gestion des rôles utilisateurs.
- Création du tableau de bord React pour la visualisation des KPI, la comparaison objectif/réalisé, les filtres par processus et l'affichage des statuts visuels.
- Développement des espaces utilisateurs : interface de connexion, profil utilisateur, espace administrateur et vues adaptées aux responsables, pilotes et utilisateurs simples.
- Mise en place de la gestion des utilisateurs : création, consultation, modification des comptes, attribution des rôles et affectation des permissions.
- Préparation des routes liées aux indicateurs, aux réalisations, aux objectifs, aux actions et aux permissions.

**Résultats obtenus :**

- Base technique fonctionnelle permettant la communication entre le frontend, le backend et la base de données.
- Modèle de données cohérent pour l'analyse des KPI et la consultation par processus.
- Dashboard décisionnel opérationnel permettant de suivre les indicateurs, les objectifs, les réalisés, les écarts et les plans d'action.
- Espaces utilisateur et administrateur opérationnels avec authentification, gestion des rôles, permissions et accès sécurisés.
- Mise en place d'un socle sécurisé pour limiter l'accès aux données selon les rôles et les permissions attribuées.

**Difficultés rencontrées :**

- Gestion fine des permissions, car l'accès aux KPI doit dépendre à la fois du rôle de l'utilisateur et de son périmètre métier.
- Harmonisation des formats de données transmis entre le backend et le frontend.
- Nécessité de maintenir une interface lisible malgré la richesse des informations liées aux indicateurs.

**Suggestions / prochaines activités :**

- Finaliser les écrans d'administration, de profil et de gestion des utilisateurs.
- Ajouter les notifications et les emails liés aux événements importants : réinitialisation du mot de passe, alertes KPI et informations aux responsables.
- Préparer les données nécessaires aux traitements prédictifs en Python.

### Mois 3 : Notifications email, intégration des données et IA/ML

**Activités réalisées :**

- Préparation des données historiques des KPI pour l'analyse prédictive : nettoyage, structuration, calcul des écarts et création de variables temporelles.
- Développement du pipeline Machine Learning en Python avec des bibliothèques telles que pandas, scikit-learn et joblib.
- Mise en place de modèles permettant la prédiction des réalisations, l'évaluation du risque, la détection d'anomalies et la priorisation des suggestions d'action.
- Intégration des résultats prédictifs dans les API backend et dans les vues frontend.
- Développement du module d'emails et de notifications pour la réinitialisation du mot de passe, les alertes KPI, les notifications internes et l'escalade vers les responsables ou les pilotes.
- Intégration d'une logique d'IA appliquée au pilotage des KPI : détection d'anomalies, scoring de risque, suggestions d'actions correctives et chatbot/copilot d'assistance.
- Amélioration des tableaux de bord : filtres, statuts visuels, comparaison objectif/réalisé et affichage des indicateurs critiques.

**Résultats obtenus :**

- Pipeline prédictif fonctionnel capable d'exploiter l'historique des indicateurs et de produire des résultats utiles à l'aide à la décision.
- Visualisation des alertes, risques et anomalies directement dans l'application web.
- Renforcement de la sécurité et de l'autonomie des utilisateurs grâce au module de réinitialisation du mot de passe par email.
- Meilleure réactivité opérationnelle grâce aux notifications envoyées aux profils concernés.
- Intégration d'une aide à la décision basée sur l'IA, combinant pipeline ML, recommandations d'actions et assistance conversationnelle.

**Difficultés rencontrées :**

- Interprétation prudente des résultats Machine Learning afin de conserver une lecture métier fiable et compréhensible.
- Gestion des valeurs manquantes et des cas où certains indicateurs disposent d'un historique moins riche.
- Équilibre à trouver entre performance technique, lisibilité des résultats et simplicité d'utilisation pour les profils non techniques.

**Suggestions / prochaines activités :**

- Tester les scénarios utilisateurs complets : administrateur, responsable, pilote et utilisateur simple.
- Vérifier la cohérence des alertes, des notifications internes et des emails générés par l'application.
- Optimiser les interfaces et corriger les anomalies détectées pendant les tests.

### Mois 4 : Tests, validation, optimisation et finalisation

**Activités réalisées :**

- Réalisation de tests fonctionnels sur les modules principaux : authentification, gestion des utilisateurs, permissions, KPI, actions, notifications, emails et prédictions.
- Vérification de la cohérence des données affichées dans les tableaux de bord et de la pertinence des statuts visuels.
- Validation des scénarios complets liés aux espaces utilisateurs : connexion, profil, administration, permissions, accès dashboard et réception des notifications.
- Vérification de la stabilité des emails et des notifications : réinitialisation du mot de passe, alertes KPI, suivi interne et remontée vers les profils concernés.
- Amélioration de l'ergonomie de l'application afin de rendre la consultation des indicateurs plus claire et plus rapide.
- Correction des erreurs identifiées lors des tests et stabilisation des échanges entre frontend, backend, base de données et pipeline ML.
- Préparation des éléments de rapport : contexte, problématique, méthodologie, architecture, conception, réalisation, résultats et perspectives.
- Présentation des résultats obtenus et consolidation des livrables du projet.

**Résultats obtenus :**

- Plateforme web cohérente et exploitable pour le suivi centralisé des KPI d'AAF Production.
- Intégration réussie des fonctionnalités fondamentales : dashboard décisionnel, espaces utilisateurs, notifications email et IA/ML intégrée.
- Mise à disposition d'un outil facilitant la lecture des écarts, l'identification des indicateurs critiques et la priorisation des actions correctives.
- Rapport de stage structuré, aligné avec la démarche de réalisation et les résultats techniques obtenus.

**Difficultés rencontrées :**

- Nécessité de valider plusieurs scénarios pour s'assurer que les droits d'accès et les notifications correspondent bien aux responsabilités métier.
- Ajustements successifs de l'interface pour éviter la surcharge d'informations dans les vues KPI.
- Besoin de formuler clairement les résultats Machine Learning dans le rapport afin qu'ils restent compréhensibles pour un lecteur académique et professionnel.

**Suggestions / prochaines activités :**

- Prévoir, à moyen terme, un enrichissement de l'historique des données pour améliorer la précision des modèles prédictifs.
- Ajouter de nouveaux indicateurs et de nouvelles visualisations selon les besoins futurs d'AAF Production.
- Mettre en place un réentraînement périodique des modèles Machine Learning afin de maintenir leur pertinence dans le temps.

## 3. Évaluation par l'encadrant professionnel

| Critère | Appréciation proposée |
|---|---|
| Facilité d'intégration | Le stagiaire s'est intégré rapidement dans l'environnement professionnel d'AAF Production. Il a su comprendre les attentes de l'entreprise, adopter une posture respectueuse et solliciter les échanges nécessaires avec les personnes concernées. |
| Ponctualité et assiduité | Le stagiaire a fait preuve d'une présence régulière et d'un sérieux constant. Les travaux confiés ont été réalisés avec rigueur et dans un rythme compatible avec les exigences du stage de fin d'études. |
| Capacité d'apprentissage | Le stagiaire a démontré une très bonne capacité d'assimilation, notamment dans la compréhension des indicateurs industriels, de la logique décisionnelle, des mécanismes d'authentification et des traitements Machine Learning. |
| Motivation et implication | Le stagiaire s'est montré très impliqué dans la réalisation du projet. Il a cherché à dépasser une simple application de consultation en proposant une solution intégrant analyse prédictive, alertes et aide à la décision. |
| Gestion du temps | Le travail a été organisé de manière progressive : cadrage, conception, développement, intégration, tests et finalisation. Cette organisation a permis d'aboutir à un résultat structuré et cohérent. |
| Autonomie | Le stagiaire a travaillé avec une autonomie appréciable. Il a su rechercher des solutions, comparer différentes approches et prendre des décisions techniques adaptées au contexte du projet. |
| Qualité du travail | Le travail réalisé est de très bonne qualité. La solution développée couvre les besoins essentiels : suivi des KPI, gestion des utilisateurs, permissions, tableaux de bord, notifications, emails et analyse prédictive. |
| Relations interpersonnelles | Le stagiaire a entretenu des relations professionnelles correctes et constructives. Il a su écouter les remarques, demander des clarifications et intégrer les retours reçus. |
| Travail d'équipe | Le stagiaire a montré une bonne capacité à collaborer avec son encadrant et à tenir compte des contraintes de l'environnement métier. Son travail s'est inscrit dans une logique utile à l'entreprise. |
| Communication écrite | La communication écrite est claire, structurée et adaptée au contexte académique. Le rapport présente correctement la problématique, la méthodologie, l'architecture et les résultats obtenus. |
| Communication orale | Le stagiaire est capable d'expliquer son travail de manière ordonnée, en reliant les choix techniques aux besoins métiers de l'entreprise. |
| Attitude face à la supervision | Le stagiaire a adopté une attitude réceptive et professionnelle. Les remarques formulées lors de l'encadrement ont été prises en considération et intégrées dans l'amélioration du projet. |

## 4. Principales forces du stagiaire

- Bonne capacité à comprendre un besoin métier industriel et à le traduire en fonctionnalités logicielles concrètes.
- Maîtrise progressive d'une architecture full-stack combinant React, Node.js/Express, base de données relationnelle et traitements Python.
- Esprit analytique développé, particulièrement visible dans la modélisation décisionnelle, l'analyse des écarts et l'intégration du Machine Learning.
- Sens de l'organisation dans la conduite du projet, avec une progression cohérente depuis l'étude de l'existant jusqu'aux tests et à la finalisation.
- Capacité à proposer une solution utile pour l'entreprise, dépassant le simple affichage des données grâce aux alertes, aux notifications et aux prédictions.
- Autonomie, sérieux et persévérance face aux difficultés liées aux données, aux permissions et à l'interprétation des indicateurs.
- Bonne qualité rédactionnelle dans la présentation de la démarche, de l'architecture et des résultats.

## 5. Points à améliorer

- Approfondir davantage les méthodes de validation des modèles Machine Learning, notamment par l'utilisation d'historiques plus longs et de jeux de test plus représentatifs.
- Renforcer la documentation technique du code afin de faciliter la maintenance future par d'autres développeurs.
- Développer encore la capacité à prioriser les fonctionnalités lorsque plusieurs besoins sont exprimés simultanément.
- Continuer à améliorer la présentation orale des résultats en mettant davantage en avant les impacts métier avant les détails techniques.
- Prévoir des tests automatisés plus systématiques pour sécuriser les évolutions futures du backend et du frontend.

## 6. Commentaires sur le rapport de stage

Le rapport de stage présente un travail de très bonne qualité, à la fois sur le plan technique et méthodologique. La problématique est clairement formulée autour du besoin de centralisation, d'analyse et d'anticipation des indicateurs de performance d'AAF Production. La démarche adoptée est cohérente : elle commence par l'étude de l'existant, se poursuit par la définition des besoins, la modélisation décisionnelle, l'architecture technique, puis la réalisation de la solution.

Le rapport met correctement en valeur les choix technologiques effectués, notamment l'utilisation de React pour l'interface utilisateur, de Node.js/Express pour les API sécurisées, de SQL Server pour les données opérationnelles et décisionnelles, ainsi que de Python pour les traitements Machine Learning. Les résultats obtenus démontrent une bonne capacité à relier le développement logiciel, la Business Intelligence et l'intelligence artificielle dans une solution applicative cohérente.

L'autonomie du stagiaire apparaît clairement dans la manière dont les différentes composantes du projet ont été articulées : tableaux de bord, gestion des utilisateurs, permissions, notifications, emails, analyse des écarts et prédictions. Le rapport reflète un travail sérieux, bien structuré et pertinent par rapport aux attentes d'un stage de fin d'études en Génie Logiciel.

## 7. Appréciation globale

**Appréciation globale :** Supérieur aux attentes.

Le stagiaire a réalisé un travail complet, ambitieux et adapté aux besoins de l'entreprise. La solution proposée répond à une problématique réelle de pilotage des performances industrielles et combine de manière pertinente développement web, sécurité, gestion des données, Business Intelligence et Machine Learning. Le niveau d'implication, la qualité des livrables et la progression observée justifient pleinement une appréciation supérieure aux attentes.

## 8. Notes finales

| Évaluation | Note |
|---|---:|
| Note de l'encadrant professionnel | 5/5 |
| Note de l'encadrant universitaire | 5/5 |
| Moyenne finale | 5/5 |
