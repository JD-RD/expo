# EXPO — plan d’exécution : synchronisation Google Docs générique

> Source de vérité pour l’implémentation multiphase. Ce plan complète
> `md/plan-automatisation.md` sur la synchronisation de contenu libre et
> structurée; il ne constitue pas une autorisation d’écrire dans Google Docs.

## Objectif

Permettre à EXPO de préparer et d’appliquer des mises à jour très variées du
Google Doc de voyage — arrivée, logement, transport, activité, restaurant,
réservation, note éditoriale ou correction — avec un même moteur explicite,
auditable et réutilisable.

Le système doit accepter un plan de changements contenant des opérations
génériques (`replace_exact`, `insert_after`, `insert_before`, `delete_exact`,
`append` et remplacement de bloc marqué), produire un dry-run lisible, refuser
les correspondances ambiguës et protéger le document contre les modifications
concurrentes.

## Décisions validées

- Le moteur est **générique**; aucun script ne sera créé pour un domaine
  particulier comme les vols ou les restaurants.
- Les données structurées validées dans `data/japon.yaml` continuent
  d’alimenter EXPO et la section `EXPO:SYNC` du Google Doc.
- Le contenu éditorial libre n’est pas remplacé automatiquement depuis le
  dépôt. Il est modifié par un plan de changements explicite contenant un
  ancien texte, un nouveau texte et une opération déterminée.
- Un plan est évalué contre un document précis et une empreinte de base. Une
  écriture est refusée si le document a changé depuis le dry-run.
- Le mode dry-run reste la valeur par défaut; `--write` est la seule voie
  d’écriture distante.
- Les credentials Hermes, tokens, secrets et copies complètes du Google Doc
  restent hors du dépôt.

## Format de plan de changements

Le format initial sera YAML, car le dépôt dispose déjà de `js-yaml` et le
format reste lisible pour une revue humaine. Les plans contenant des données
privées seront créés dans un emplacement temporaire ou ignoré par Git; seuls
les exemples désensibilisés pourront être versionnés.

Exemple conceptuel :

```yaml
version: 1
document:
  id: "<google-doc-id>"
  title: "Japan V2"
  base_sha256: "<empreinte produite par le dry-run>"
operations:
  - id: arrival-update
    type: replace_exact
    old: "15 h 25, terminal 2–3"
    new: "15 h 07, terminal 1, porte 43"
    expected_matches: 1
    source: "capture de vol fournie par JD"
```

Règles du contrat :

- `version` est obligatoire et vaut `1`.
- `document.id` est obligatoire; le titre sert uniquement de contrôle humain.
- `base_sha256` est obligatoire en mode écriture et doit correspondre au texte
  lu pendant la préparation du plan.
- Chaque opération possède un identifiant unique, un type et un texte cible.
- Les recherches sont littérales et sensibles aux caractères; aucune regex ne
  sera exécutée par défaut.
- Une opération textuelle doit trouver exactement une occurrence, sauf si le
  plan déclare explicitement une autre cardinalité autorisée.
- Le moteur peut reconnaître un état déjà appliqué comme `noop` seulement si
  le texte nouveau est présent de manière non ambiguë; il ne doit jamais
  deviner une résolution de conflit.

### Contrat concret du moteur pur (lot A)

Le chargeur `scripts/doc-change-plan.mjs` accepte la structure YAML suivante;
les opérations sont appliquées dans l’ordre déclaré :

| `type` | Champs obligatoires | Sémantique |
|---|---|---|
| `replace_exact` | `old`, `new` | Remplace toutes les occurrences si `expected_matches` correspond; cette cardinalité vaut 1 par défaut. |
| `insert_after` | `anchor`, `text` | Insère `text` immédiatement après chaque ancre littérale attendue. |
| `insert_before` | `anchor`, `text` | Insère `text` immédiatement avant chaque ancre littérale attendue. |
| `delete_exact` | `old` | Supprime les occurrences littérales attendues; `expected_matches: 0` est requis pour déclarer explicitement une absence déjà conforme. |
| `append` | `text` | Ajoute exactement `text` en fin de document. |
| `replace_block` | `start_marker`, `end_marker`, `text` | Remplace le bloc délimité, ou ajoute le bloc complet si les deux marqueurs sont absents. |

`id` doit être unique, `version` vaut `1` et `document.id` est obligatoire.
`document.title` est un contrôle humain facultatif. `base_sha256` est facultatif
pour le moteur pur, mais devient obligatoire et est comparé au texte lu dès
qu’un appelant active le mode exigeant avant écriture. Les ancres, marqueurs et
textes sont littéraux, sensibles aux caractères et jamais interprétés comme des
expressions régulières. `replace_marked_block` est accepté comme alias de
chargement de `replace_block`, mais les plans produits utilisent le nom
canonique `replace_block`.

Une cible absente ou ambiguë est une erreur, sauf lorsqu’un état final déjà
appliqué est démontrable sans ambiguïté (`noop`). Les marqueurs de bloc doivent
former une paire unique et dans le bon ordre; un seul marqueur, plusieurs
paires ou un texte contenant lui-même un marqueur sont refusés. Le résumé
dry-run expose l’identifiant du document, les actions et cardinalités par
opération, les tailles et les empreintes avant/après, sans accès réseau.

## Portée et hors portée

### Inclus

- Charge et validation d’un plan de changements YAML.
- Calcul pur d’un plan avant/après et rendu d’un diff résumé.
- Opérations littérales de remplacement, insertion, suppression et ajout.
- Remplacement sûr de blocs délimités par des marqueurs existants ou nouveaux.
- Conversion correcte des positions texte vers les index UTF-16 de Google Docs.
- Contrôle `mimeType`, `capabilities.canEdit`, hash du contenu et
  `revisionId` avant écriture.
- Relecture complète après écriture et vérification que toutes les opérations
  attendues sont dans l’état final.
- Compatibilité avec le synchroniseur actuel de la section `EXPO:SYNC`.
- Documentation, exemples désensibilisés et tests locaux sans appel Google.

### Exclu

- OCR automatique ou écriture directe à partir d’une photo sans revue du plan.
- Fusion bidirectionnelle automatique entre Markdown, YAML et Google Docs.
- Résolution sémantique de contradictions ou choix automatique entre deux
  itinéraires concurrents.
- Synchronisation des commentaires ancrés, suggestions, dessins ou mises en
  forme riches complexes.
- Modification des permissions, partage, suppression ou déplacement de Docs.
- Commit, push, déploiement ou écriture dans Japan V2 pendant les lots locaux.

## Architecture et invariants

```text
plan YAML
   ↓
validation + résolution littérale sur une copie du texte
   ↓
dry-run / diff lisible
   ↓  (--write explicite seulement)
relecture distante + canEdit + hash + revisionId
   ↓
batchUpdate atomique
   ↓
relecture distante + vérification finale
```

- `scripts/sync-google-doc.mjs` reste l’orchestrateur CLI et conserve son
  comportement actuel sans `--plan`.
- Un module Node pur, par exemple `scripts/doc-change-plan.mjs`, porte le
  contrat, la validation, l’application en mémoire et le résumé des opérations.
- `scripts/hermes-google-doc.py` reçoit une commande générique `patch` qui
  revalide le document distant juste avant l’écriture et construit le
  `batchUpdate` avec les index Google Docs.
- Une opération ne peut pas transformer silencieusement zéro ou plusieurs
  correspondances en écriture; elle s’arrête avec un diagnostic exploitable.
- Les opérations sont appliquées dans l’ordre déclaré sur une représentation
  textuelle unique, puis converties en requêtes Google Docs cohérentes.
- Le bloc `EXPO:SYNC` reste idempotent et continue de représenter les données
  structurées; les patches éditoriaux sont des changements ponctuels et
  explicitement revus.

## Critères d’acceptation

1. Une mise à jour quelconque du voyage peut être décrite par le même format,
   sans ajouter de code métier pour son domaine.
2. Le dry-run affiche le document ciblé, l’action, les opérations, les
   correspondances et un résumé avant/après sans écrire à distance.
3. Le moteur refuse une cible absente, ambiguë, un document différent, un
   `base_sha256` périmé, `canEdit=false` ou une révision distante modifiée.
4. Les opérations d’insertion, suppression et remplacement respectent les
   caractères Unicode et les index UTF-16 requis par Google Docs.
5. Une écriture réussie est relue et vérifie que le texte final correspond au
   plan; une relecture non conforme est signalée comme état distant incertain.
6. Le synchroniseur `EXPO:SYNC` existant reste compatible et inclut tous les
   champs structurés pertinents, notamment le terminal et la porte lorsqu’ils
   sont présents.
7. Les tests couvrent les cas nominaux, les cibles dupliquées, les marqueurs
   invalides, les opérations déjà appliquées, les conflits de hash et les
   séquences Unicode.
8. La documentation permet de préparer un plan, de le revoir, de l’appliquer
   et de vérifier le résultat sans exposer de secret.

## Risques et portes d’arrêt

- **Document éditorial ambigu** : arrêter si une ancre apparaît zéro ou
  plusieurs fois; demander un texte plus précis ou un marqueur stable.
- **Dérive distante** : arrêter si le hash ou la révision ne correspond plus;
  relire le Doc et régénérer le plan.
- **Données privées dans un plan** : arrêter avant de le versionner; déplacer le
  fichier hors du dépôt et conserver seulement un résumé désensibilisé.
- **Migration de marqueurs dans Japan V2** : préparer un dry-run et arrêter
  avant toute écriture; une confirmation explicite de JD sera requise au début
  du lot de migration.
- **Régression de la synchronisation structurée** : arrêter avant toute
  migration éditoriale si `npm test`, `npm run build-expo` ou les tests du
  synchroniseur échouent.
- Aucun lot n’autorise implicitement un commit, un push, un déploiement ou une
  écriture Google Doc réelle.

## Lots d’exécution

| Lot | Portée exacte | Prérequis | Modèle | Raisonnement | Validation | Porte d’arrêt |
|---|---|---|---|---|---|---|
| A — Contrat et moteur pur | Ajouter le schéma de plan, le chargeur, la validation, les opérations en mémoire et le résumé dry-run; préserver le comportement existant sans accès réseau. | Ce plan; dépôt propre ou changements identifiés. | GPT-5.6 Luna | `high` | Tests Node du contrat, cardinalité, no-op et conflits; `npm test`; `git diff --check`. | Ne pas toucher à Hermes ni à un Google Doc. Arrêter si le format ne permet pas de distinguer un patch éditorial d’un bloc géré. |
| B — Transport Google Docs | Étendre `hermes-google-doc.py` avec le patch générique, les contrôles `canEdit`/hash/révision, les index UTF-16 et un `batchUpdate` atomique. | Lot A terminé; plan pur validé. | GPT-5.6 Luna | `high` | Tests hors ligne du calcul d’index et de la construction des requêtes; compilation Python; tests Node; aucune écriture distante. | Arrêter avant tout appel d’écriture réel. Un faux service ou une fixture doit suffire aux contrôles locaux. |
| C — CLI et compatibilité EXPO | Intégrer `--plan <fichier>` dans `sync-google-doc.mjs`, enrichir `renderManagedSection` avec terminal/porte, conserver le mode historique et ajouter les commandes/documentation nécessaires. | Lots A et B terminés. | GPT-5.6 Luna | `high` | Dry-run sur fixture documentaire; tests d’idempotence; `npm run validate:japan`, `npm run build-expo`, `npm run check-arrival`, `npm test`. | Ne pas migrer ni écrire Japan V2. Arrêter si le mode historique change son périmètre ou si des secrets deviennent nécessaires. |
| D — Exemple et revue locale | Ajouter un exemple de plan désensibilisé, documenter le workflow « extraire → planifier → dry-run → appliquer → relire », tester les erreurs utiles et préparer un dry-run contre Japan V2 sans `--write`. | Lot C terminé; credentials disponibles seulement si le dry-run réel est jugé utile. | GPT-5.6 Luna | `medium` | Exemple validé; dry-run local et, si autorisé, dry-run distant; inspection du diff et absence d’écriture distante. | Arrêter avant toute écriture, commit ou push. Produire le prompt de reprise du lot E. |
| E — Migration et première écriture contrôlée (optionnel) | Utiliser un plan explicite pour une ou plusieurs sections de Japan V2, obtenir une confirmation au moment de l’écriture, appliquer, relire et consigner le résultat. | Lot D terminé; confirmation explicite de JD; document et plan revus. | GPT-5.6 Luna | `high` | `canEdit`, hash, révision, `batchUpdate`, relecture et contrôle manuel des passages modifiés. | Arrêter avant chaque écriture supplémentaire si le document a dérivé ou si le résultat dépasse le plan. Aucun commit/push sans demande séparée. |

## Protocole de fin de session

1. Exécuter les validations du lot courant.
2. Inspecter le diff et l’état Git.
3. Mettre `HANDOFF.md` à jour sans secret ni copie sensible du Google Doc.
4. Ne pas commencer le lot suivant, même si le lot courant est terminé tôt.
5. Donner le modèle, le niveau et le prompt de reprise exacts.

```text
ARRÊT DE SESSION OBLIGATOIRE
Lot terminé: <lot>
Prochain lot: <lot>
Nouvelle session: <modèle exact> / raisonnement <niveau>
Prompt de reprise:
Lis AGENTS.md, md/plan-sync-google-doc-generique.md et HANDOFF.md. Exécute
uniquement le lot <lot>. Respecte toutes ses portes d’arrêt, préserve les
changements non committés et n’entame pas le lot suivant.
```
