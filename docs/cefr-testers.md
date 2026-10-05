# Fiche testeur : estimation du niveau d'anglais (F10)

Objectif : mesurer si l'estimation du niveau fonctionne sur de vrais étudiants. 10 testeurs minimum, 40 échantillons idéalement, répartis de A2 à C1.

## Avant de commencer
- Le testeur **connaît son niveau officiel** : score IELTS, TOEFL, TOEIC, ou niveau d'un test de niveau reconnu. Noter la source (« IELTS 6.0 », « test de niveau X, B1 »).
- Convertir en niveau CEFR (A2, B1, B2, C1) avec le tableau officiel du test. En cas de doute, ne pas inclure l'échantillon.
- Le testeur donne son accord : on garde **uniquement le texte**, sous un identifiant anonyme (t01, t02…). Pas de nom, pas d'audio conservé, pas de partage hors de l'équipe.

## Ce que fait le testeur (5 minutes)
1. **Écrit 5 lignes** sur ses études (« Write 5 lines about your studies »), sans traducteur ni IA.
2. **Parle 1 minute** sur le sujet de son choix (sa journée, un problème au travail), enregistré sur son téléphone.
3. Le texte est transcrit avec Whisper (pour l'oral), puis relu uniquement pour supprimer les noms propres.

## Ce que l'équipe enregistre
Un tableau avec 3 colonnes : `id` (t01), `level` (A2, B1, B2 ou C1), `text`. Ajouter une colonne `type` (écrit ou oral) pour comparer.
Un fichier modèle est dans `packages/agent/evals/cefr/samples_template.csv`.

## Lancer le test
```bash
cd packages/agent
../../apps/api/.venv/bin/python evals/cefr/import_samples.py chemin/testeurs.csv --source testers
../../apps/api/.venv/bin/python evals/cefr/run_cefr_eval.py hf --data evals/cefr/real_testers.json
```
Le fichier produit (`real_*.json`) reste sur l'ordinateur et n'est jamais commité (il est dans `.gitignore`).

## Lire le résultat
- Regarder le niveau **exact** et la matrice, pas seulement « à un niveau près » (un modèle qui répond toujours B1 aurait environ 75 %).
- Comparer l'écrit et l'oral : le modèle a été entraîné sur de l'écrit.
- Règle de la spec : l'estimation n'est affichée que si elle dépasse 85 % à un niveau près ; elle est toujours marquée « Estimated » et modifiable par l'étudiant.
