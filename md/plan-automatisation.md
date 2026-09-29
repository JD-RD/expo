# Plan d’automatisation des mises à jour EXPO

## Objectif

Réduire les tokens utilisés et les erreurs lors des mises à jour conjointes
d’EXPO et du Google Doc de voyage.

## Architecture proposée

```text
data/japon.yaml
        ↓
validation
        ↓
EXPO + Google Doc
        ↓
tests + résumé des changements
```

Le fichier YAML deviendrait la source de vérité pour les informations
structurées du voyage. L’agent n’aurait ensuite besoin de recevoir que le
résumé des erreurs et des modifications, plutôt que de relire tout le projet
et le document.

## Scripts à créer dans `scripts/`

- `validate-itinerary` : vérifier les adresses, dates, chambres, gares, liens
  internes et informations contradictoires.
- `build-expo` : reconstruire les pages et bundles depuis les données validées.
- `sync-google-doc` : mettre à jour le Google Doc depuis les données validées,
  avec un mode `--dry-run`.
- `check-arrival` : contrôler l’itinéraire aéroport → logement, la station,
  la sortie, la distance et les instructions de clé.
- `pre-commit` : lancer automatiquement le build, les validations,
  `git diff --check` et les tests avant chaque commit.

## Exemple de source structurée

```yaml
accommodation:
  name: CATS-2
  room: "502"
  address_en: "2-chōme-24-5 Tabatashinmachi, Kita City, Tokyo 114-0012"
  station: "Akado-shōgakkōmae"
  exit: "West exit"
  walking_distance_m: 400
  key_instruction: "Key on the table; leave it in the room at checkout."
```

## Premier lot recommandé

1. Ajouter la source YAML.
2. Créer le validateur.
3. Ajouter les tests de cohérence.
4. Ajouter la commande unique `npm run sync:japan`.
5. Produire un résumé clair des changements et des erreurs.

## Garde-fous

- Les identifiants OAuth et secrets restent hors du dépôt.
- La synchronisation Google Doc doit être idempotente.
- Le mode `--dry-run` doit être activé par défaut pour les premières versions.
- Toute modification doit être vérifiée avant le commit et le push.
