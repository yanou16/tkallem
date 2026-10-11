# Proposition : système de crédits

*Mis à jour le 11 octobre 2026. **Option A choisie** (mode invité + connexion). Implémenté en local sur la branche `credits/local`, pas poussé.*

## 0. Ce qui est construit (Option A)
- **Invité** : `POST /guests` crée un compte invité (`clerk_user_id = guest:<uuid>`, niveau B1 par défaut) avec **40 crédits**, et renvoie un jeton signé (HMAC, secret `GUEST_SECRET`). Le front l'envoie en en-tête `Authorization: Guest <jeton>` (pas de cookie : Safari bloque les cookies tiers).
- **Connexion** : `POST /me/claim-guest` ajoute les crédits restants de l'invité une fois par compte, plus le bonus de **+60**, et déplace ses sessions. Le jeton ne peut pas être rejoué pour recréer des crédits.
- **Quota quotidien** : +15 par jour, cumulable jusqu'à 45, calculé à la demande (pas de tâche planifiée). Les invités n'en ont pas.
- **Garde-fous** : 30 invités par IP et par jour, 2000 par jour au total, plafond global de dépense gratuite. Débit atomique, crédit rendu si le coach échoue.
- **Tests** : 33 tests de crédits (dont 10 threads en parallèle sur un solde de 3 : exactement 3 réussissent), 143 tests API, parcours vérifié dans Chrome (40 → 39 → écran « plus de crédits »).

---
*Texte original de la proposition ci-dessous.*

## 1. Ce que tu veux (reformulé)
- Un étudiant qui **arrive sans compte** reçoit **40 crédits** pour essayer.
- Quand il **se connecte**, il en reçoit davantage pour continuer.
- Ensuite, il reçoit **chaque jour** un quota gratuit de crédits.

## 2. Combien coûte un crédit ?
**1 crédit = 1 réponse de l'étudiant** (texte ou voix). Une session de 6 questions coûte 6 crédits. Le bilan est gratuit (il coûte moins de 0,0001 $), mais il faut avoir répondu au moins une fois.

Coût réel d'une réponse (le modèle de langage est **mesuré** sur une vraie session ; la transcription et la voix sont calculées avec les tarifs vérifiés) :

| Poste | Réponse écrite | Réponse vocale, voix Orpheus (Groq) | Réponse vocale, voix Kokoro (DeepInfra) |
|---|---|---|---|
| Modèle de langage (coach + correcteur) | 0,00024 $ | 0,00024 $ | 0,00024 $ |
| Transcription (Groq, 10 s facturées au minimum) | 0 | 0,00011 $ | 0,00011 $ |
| Voix du coach (environ 120 caractères) | 0 | 0,0026 $ | 0,00012 $ |
| **Total par crédit** | **0,00024 $** | **0,0030 $** | **0,00047 $** |

## 3. Les chiffres que je propose

| Réglage | Valeur proposée | Coût pour toi (Kokoro / Orpheus) |
|---|---|---|
| Crédits d'un visiteur sans compte | **40** (une fois) | 0,02 $ / 0,12 $ |
| Bonus à la connexion | **+60** (une fois) | 0,03 $ / 0,18 $ |
| Quota quotidien après connexion | **+15 par jour**, cumulable jusqu'à **45** | 0,007 $ / 0,045 $ par jour et par étudiant actif |
| **Plafond global de dépense gratuite** | **5 $ par jour** (interrupteur) | borne le risque quoi qu'il arrive |

Ce que ça donne pour un étudiant : environ 6 sessions à l'essai, 16 au total à l'inscription, puis environ 2 sessions par jour.

**À chiffrer avec réalisme** : 1 000 étudiants actifs qui consomment tout leur quota quotidien coûtent environ **7 $/jour avec Kokoro** (210 $/mois) mais **45 $/jour avec Orpheus** (1 350 $/mois). Orpheus ne passe donc pas à grande échelle avec un quota généreux. D'où le plafond global : quand il est atteint, les crédits gratuits s'arrêtent jusqu'au lendemain avec un message clair.

## 4. Comment ça marche techniquement

**Une table de comptes de crédits et un journal** (migration Alembic, côté Zaki) :
- `credit_wallets` : un solde par étudiant (ou par visiteur) ;
- `credit_ledger` : chaque mouvement avec sa raison (`guest_grant`, `login_bonus`, `daily_refill`, `turn_spent`, `refund`), sans jamais modifier une ligne.

**Débit atomique, avant l'appel aux fournisseurs** : une seule requête SQL du type `UPDATE ... SET balance = balance - 1 WHERE balance >= 1 RETURNING balance`. Deux réponses envoyées en même temps ne peuvent pas dépenser le même crédit. Si la transcription ou le modèle échoue (erreurs 422 ou 502), le crédit est **rendu** : l'étudiant ne paie jamais une panne.

**Recharge quotidienne paresseuse** : pas de tâche planifiée. À chaque requête, le serveur calcule combien de jours ont passé depuis la dernière recharge et crédite la différence (une ligne unique par jour, donc jamais en double).

**Réponse à l'écran** : la réponse de `/turn` contient le solde restant, et une route `GET /me/credits` donne le solde et l'heure de la prochaine recharge. Quand le solde est à 0, `/turn` répond **402** avec le code `no_credits` et l'heure du prochain crédit.

## 5. Le point délicat : les visiteurs sans compte
Aujourd'hui **toutes les pages sont protégées par Clerk** : sans compte, on ne voit rien. Les 40 crédits « avant connexion » demandent donc :
1. d'ouvrir une partie de l'app sans connexion (côté front) ;
2. que l'API accepte un **jeton de visiteur** (un cookie signé avec un identifiant aléatoire), puisque Clerk n'a pas de mode anonyme ;
3. que les crédits restants et les sessions du visiteur soient **transférés** à son compte à la connexion.

**Le risque** : effacer ses cookies donne 40 nouveaux crédits. Les garde-fous sont : une limite de nouveaux visiteurs par adresse IP et par jour, et le plafond global de dépense. Attention : en Algérie, beaucoup d'étudiants partagent la même adresse IP d'opérateur (translation d'adresse partagée), donc la limite par IP doit rester large (par exemple 30 par jour) et ne pas être ta seule protection.

## 6. Deux options

| | **Option A : visiteurs + connexion** (ce que tu décris) | **Option B : connexion obligatoire** |
|---|---|---|
| Parcours | Essai immédiat avec 40 crédits, puis connexion pour 60 de plus | Connexion avec Google en un clic, puis 100 crédits d'un coup |
| Travail en plus | Mode visiteur, cookie signé, transfert des crédits, protections contre l'abus, pages publiques | Aucun mode visiteur |
| Risque de coût | Plus élevé (abus possible sans compte) | Faible (un compte Google par personne) |
| Effet « wow » devant le jury | Fort : ils essaient sans rien créer | Bon : un clic |

**Mon avis** : commence par **l'option B** (100 crédits à l'inscription + recharge quotidienne). C'est 3 à 4 fois moins de travail et de risque. Le mode visiteur s'ajoute ensuite sans rien jeter : le portefeuille, le journal et le débit sont les mêmes.

## 7. Qui fait quoi (si tu valides)

| Qui | Travail | Estimation |
|---|---|---|
| **Zaki** (back) | Migration (2 tables), service de crédits (débit, remboursement, recharge), `/turn` et `GET /me/credits`, tests | environ 2 jours |
| **Les trois** | PR de contrat : `credits` dans la réponse de `/turn`, erreur 402 `no_credits`, `GET /me/credits` | 1 PR |
| **Akram** (front) | Compteur de crédits dans l'en-tête, écran « plus de crédits » avec minuteur, messages | environ 1 jour |
| **Rayane** | Rien dans l'agent. Je peux écrire le service de crédits et ses tests en PR pour Zaki si tu veux | |

## 8. À décider
1. **Option A ou B** pour la première version ?
2. Les chiffres : 40 / +60 / +15 par jour (plafond 45) / 5 $ par jour. Trop ou pas assez ?
3. Une réponse vocale doit-elle coûter plus qu'une réponse écrite (par exemple 2 crédits contre 1) ? Utile seulement si tu restes sur Orpheus.
4. Les crédits du quota quotidien s'accumulent-ils (plafond 45) ou sont-ils perdus à minuit ?
5. Un achat de crédits plus tard (paiement) : à garder en tête, mais pas dans cette version.

## 9. Comment font les autres (sources de blogs, à prendre avec prudence)
- **Duolingo** : depuis juillet 2025, 25 points d'énergie pour les utilisateurs gratuits, dépensés à chaque exercice et rechargés avec le temps ; illimité pour les abonnés.
- **Speak** : d'après des blogs concurrents, environ 5 à 10 minutes de conversation par jour gratuites, puis un essai de 7 jours avant l'abonnement. Les chiffres se contredisent selon les sources.
- **ELSA** : formule gratuite avec limites quotidiennes, jeu de rôle avec l'IA limité. Je n'ai pas trouvé le plafond exact.

Un quota qui se recharge chaque jour est donc la norme du domaine. Ta proposition est cohérente avec ce que font les autres.
