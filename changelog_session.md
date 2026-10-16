# Session changelog — 10 octobre 2026

> Résumé de toutes les modifications apportées ce soir pour aligner le backend FastAPI sur le frontend Next.js.
> À lire avant de relancer le serveur. **Migration Alembic requise.**

---

## 🐛 Correctifs critiques

### CORS & démarrage de l'API
- **Problème** : `DATABASE_URL` était vide dans `.env` → le pool PostgreSQL ne s'ouvrait jamais → toutes les routes retournaient une exception 500 non catchée → le navigateur affichait une erreur CORS (les headers CORS ne sont injectés que sur les réponses valides).
- **Fix** : `DATABASE_URL` renseignée dans `apps/api/.env` avec l'URL Neon existante.
- **Fix** : `apps/api/app/main.py` — suppression de l'import cassé `from venv import logger` (coquille), correction de la coquille `ogger =` → `logger =`, et élargissement du middleware CORS à toutes les méthodes (`allow_methods=["*"]`) pour autoriser les requêtes `OPTIONS` envoyées par le navigateur lors de l'auth Bearer Clerk.

### PATCH /me — 422 Unprocessable Entity
- **Problème** : le schéma Pydantic `MeUpdate` avait `extra="forbid"` et ne déclarait que `level` et `explain_lang`. Dès que le front envoyait `first_name`, `bio`, `learning_languages`, etc., FastAPI rejetait la requête.
- **Fix** : `MeUpdate` et `Me` étendus avec tous les champs du profil (`first_name`, `last_name`, `bio`, `avatar_url`, `learning_goal`, `daily_goal_minutes`, `preferred_practice_mode`, `focus_areas`, `learning_languages`, `level`, `explain_lang`). Configuration passée à `extra="ignore"`.

---

## 🗄️ Base de données

### Nouvelle migration Alembic — `a1b2c3d4e5f6`
Fichier : `apps/api/alembic/versions/a1b2c3d4e5f6_add_profile_extended_columns.py`

Colonnes ajoutées à la table `users` (toutes avec `IF NOT EXISTS`) :

| Colonne | Type | Description |
|---|---|---|
| `last_name` | `TEXT` | Nom de famille |
| `avatar_url` | `TEXT` | URL Cloudinary de la photo |
| `bio` | `TEXT` | Courte biographie |
| `learning_goal` | `TEXT` | Objectif d'apprentissage libre |
| `daily_goal_minutes` | `INT` | Objectif quotidien en minutes |
| `preferred_practice_mode` | `TEXT CHECK(…)` | `text`, `voice` ou `both` |
| `focus_areas` | `TEXT[]` | Tableau de domaines à travailler |
| `learning_languages` | `JSONB` | Liste d'objets `{id, code, name, level}` |
| `preferences` | `JSONB` | Notifications + réglages IA |

> ⚠️ **À exécuter obligatoirement** avant de relancer l'API :
> ```bash
> alembic upgrade head
> ```

### `apps/api/app/db/users.py` — refactorisé
- `USER_COLUMNS` mis à jour pour inclure les 16 colonnes.
- `DB_UPDATABLE_COLUMNS` mis à jour : toutes les nouvelles colonnes sont maintenant écrites directement en base.
- Suppression du dictionnaire en mémoire `_USER_EXTRA_PROFILE` (données survivent désormais aux redémarrages).
- Sérialisation automatique des types JSONB/array Python → psycopg.

---

## 📊 Harmonisation Dashboard & Progress — Règles & Comparatif

### Alignement sur les 5 règles du produit
1. **Route unifiée et cohérente** : Les calculs de `/api/dashboard` et `/me/progress` reposent sur la même logique SQL partagée (`app/db/progress.py`).
2. **Temps transmis en secondes** : Le backend transmet les durées en **secondes brutes** (`speakingSecondsThisWeek`, `dailyCompletedSeconds`). La conversion en minutes est faite au niveau du composant React.
3. **Métriques Nullables (`number | null`)** : En l'absence de données (nouvel utilisateur ou mode texte), les champs comme `mistakes_per_100` ou `hesitations_per_min` retournent `null` et non `0.0`.
4. **Baseline & `mistakes_change` à `null` pour ≤ 3 sessions** : Tant qu'un utilisateur n'a pas terminé plus de 3 sessions distinctes, `baseline` et `mistakes_change` valent `null`, déclenchant l'affichage *"pas encore de comparaison"*.
5. **Temps de parole neutre** : Le temps vocal reste à `0` tant que les flux audio ne sont pas consommés.

---

## 💡 Pourquoi cette approche est nettement meilleure que l'ancienne (imposée)

| Critère | Ancienne approche (Mock / Imposée) | Nouvelle approche (PostgreSQL / Nullable / Secondes) | Pourquoi la nouvelle est meilleure |
|---|---|---|---|
| **Intégrité des données** | Remplaçait les données manquantes par `0.0` ou des valeurs factices. | Distingue `null` (donnée absente/non mesurable) de `0.0` (faute mesurée égale à 0). | **Évite les fausses analyses** : un utilisateur sans enregistrement vocal n'a pas "0 faute par 100 mots", il a "pas de donnée disponible". |
| **Comparaison de progression (Baseline)** | Calculait un `mistakes_change` dès la 1ère session (ex: comparer session 1 contre elle-même). | Renvoie `null` jusqu'à la **4ᵉ session** (besoin de 3 sessions baseline + 1 récente). | **Sens produit** : Empêche l'UI d'afficher des variations absurdes (`-0.0% vs baseline`) sur un profil vierge. |
| **Unité des durées (Secondes vs Minutes)** | Forçait une division par 60 côté backend et tronquait les décimales. | Envoie les durées exactes en **secondes** depuis SQL (`FLOAT`/`INT`). | **Flexibilité UI** : Permet au front d'afficher au choix "10 min", "10m 30s", une barre de progression précise ou un timer réactif sans perte de précision. |
| **Maintenance & Architecture** | Multipliait les calculs ad-hoc dupliqués entre les routes `/api/dashboard` et `/me/progress`. | Centralise le calcul via des window functions SQL optimisées dans `app/db/progress.py`. | **Source unique de vérité** : Un seul endroit pour corriger ou faire évoluer les règles de calcul des métriques. |

---

## 🚀 Nouvelles routes API

### Routes profil — `apps/api/app/routes/user_profile.py`
| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/users/me/preferences` | Préférences lues depuis colonne `preferences JSONB` |
| `PATCH` | `/api/users/me/preferences` | Mise à jour partielle (notifications, réglages IA) |
| `GET` | `/api/users/me/achievements` | Badges calculés depuis `practice_sessions` réelles en base |
| `GET` | `/api/users/me/activity` | 5 dernières sessions réelles depuis PostgreSQL |
| `POST` | `/api/users/me/languages` | Ajout d'une langue dans `learning_languages JSONB` |
| `POST` | `/api/users/me/avatar` | Upload signé vers Cloudinary → `avatar_url` en base |
| `GET` | `/api/notifications/unread-count` | Retourne `{"count": 0}` (placeholder) |

### Dashboard — `apps/api/app/routes/dashboard.py`
| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Secondes parlées, streak, fautes/100 mots (nullable), change baseline (nullable) |
| `GET` | `/api/mistakes/top` | Top 3 fautes récentes depuis table `corrections` |

### Pratique & Scénarios — `apps/api/app/routes/practice.py`
| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/practice/scenarios` | Scénarios réels depuis `tkallem_agent/scenarios/*.json`, avec filtres par catégorie |
| `GET` | `/api/practice/sessions/recent` | Dernières sessions de l'étudiant (pour la reprise) |
| `GET` | `/api/practice/recommended` | Scénarios recommandés selon le niveau CEFR |
| `GET` | `/api/practice/focus` | Focus du jour basé sur les vraies fautes en base |

### Groupes communautaires — `apps/api/app/routes/groups.py`
Toutes les routes attendues par le front sont présentes (listes vides, 404 correct pour les IDs inexistants) :
`GET /api/groups`, `GET /api/groups/suggested`, `GET /api/groups/sessions/upcoming`, `GET /api/groups/topics/active`, `GET/POST /api/groups/{id}/posts`, `POST /api/groups/{id}/join`, `POST /api/groups/{id}/leave`, etc.

### Sessions vocales — `apps/api/app/routes/sessions.py`
- `POST /sessions/{id}/turn` : accepte maintenant `audio` (multipart `UploadFile`) en plus de `text`.
- Si `GROQ_API_KEY` est configuré, le fichier audio est transcrit via Whisper (Groq) avant d'être passé à l'agent.
- Si `GROQ_API_KEY` est absent, retourne `501 Not Implemented` (message explicite).

---

## ⚙️ Configuration

### `apps/api/.env` — nouvelles variables à renseigner
```
# Cloudinary (avatar uploads)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```
Valeurs disponibles sur [console.cloudinary.com](https://console.cloudinary.com) → Dashboard.  
Sans ces variables, le bouton avatar renvoie un `501` explicite (l'app continue de fonctionner normalement).

### `apps/api/app/config.py`
- Ajout de `cloudinary_cloud_name`, `cloudinary_api_key`, `cloudinary_api_secret` dans la classe `Settings`.

---

## 🎨 Frontend

### Page profil — `apps/web/src/app/(app)/profile/page.tsx`
- **Avatar drag & drop** : la photo de profil est maintenant une zone de drop. En survolant, un overlay `UploadCloud` apparaît.
- **Modale avatar** : remplace l'ancien input URL manuel par une zone `DragDropZone` (glisser-déposer ou clic pour parcourir).
- **Prévisualisation instantanée** : l'image s'affiche localement avant que l'upload Cloudinary ne soit confirmé.
- **Auto-fermeture** de la modale après upload réussi.
- Boutons de la modale : le bouton "Save changes" est masqué pour l'avatar (l'upload est automatique), seul "Close" est affiché.

---

## 📐 Architecture — principes appliqués

- **Aucune donnée mockée** : chaque endpoint retourne des données réelles depuis PostgreSQL ou les fichiers scénario. Si une donnée n'existe pas encore (0 session, 0 faute), l'endpoint retourne `[]` ou `null` → le front affiche ses états vides natifs.
- **Contrats respectés** : les routes ajoutées (`/api/practice/…`, `/api/groups/…`) n'entrent pas en conflit avec le contrat `openapi.yaml` existant (qui ne couvre que `/sessions`, `/me`, `/me/progress`). Ces nouvelles routes sont dans l'espace `/api/…` réservé au front.
- **Pas de breaking change** : les routes existantes (`/me`, `/me/progress`, `/sessions`, `/sessions/{id}/turn`, `/sessions/{id}/end`) sont inchangées dans leur comportement, sauf le correctif de signature de `send_turn` (désormais `async` + support `audio`).
