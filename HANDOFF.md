# Relais — mise à jour EXPO Japon 2026

## Lot A — Infrastructure vue jour par jour — terminé sans commit ni push

- Plan exécuté : `/home/jd/Plans/2026-09-27-plan-vue-jour-par-jour-expo.md`.
- Modèle/niveau déclarés par le plan : GPT-5.6 Luna / raisonnement `high`.
- Le contrat des journées Japon est maintenant collecté, validé et trié par date dans `src/build.js`.
- Les validations refusent une journée mal typée, une date ISO invalide/hors voyage, un doublon, un champ structurel manquant ou un statut inconnu.
- Nouveau template `src/templates/day-index.njk` pour `/japon/jours/`.
- Navigation précédent/suivant ajoutée aux pages de type `Journée` via `src/templates/concept.njk`.
- Timeline et navigation responsive ajoutées à `src/assets/style.css`.
- Trois journées témoins seulement créées : `2026-09-30`, `2026-10-02` et `2026-10-05`.
- Lien « jour par jour » ajouté à `bundles/japon/index.md`.

### Contrôles du lot A

- `npm run build` réussi : **167 concepts dans 4 bundles**.
- `/japon/jours/` contient exactement 3 cartes triées : 30 septembre, 2 octobre, 5 octobre.
- Navigation vérifiée : 30 → 2 → 5, avec les extrémités sans lien inexistant.
- Les cinq nouvelles cibles de journée attendues (index + 3 pages) existent dans `dist/`.
- `git diff --check` propre.
- `dist/` reste généré et ignoré; aucun commit, push ou déploiement effectué.

### État et relais

- Les modifications non commitées antérieures de JD ont été préservées.
- Les nouveaux fichiers du lot A sont `bundles/japon/jours/**` et `src/templates/day-index.njk`; les modifications de code sont limitées à `src/build.js`, `src/templates/concept.njk`, `src/assets/style.css` et le lien de `bundles/japon/index.md`.
- Risque restant : seules trois dates existent volontairement; la validation de la série complète de 30 dates appartient au lot B.
- **Prochain lot : B — Contenu complet.** Ne pas le commencer dans cette session.

ARRÊT DE SESSION OBLIGATOIRE
Lot terminé: A
Prochain lot: B
Nouvelle session: GPT-5.6 Luna / raisonnement high
Prompt de reprise:
Lis `/home/jd/src/expo/AGENTS.md`, `/home/jd/Plans/2026-09-27-plan-vue-jour-par-jour-expo.md` et `/home/jd/src/expo/HANDOFF.md`. Exécute uniquement le lot B. Respecte toutes ses portes d'arrêt, préserve les changements non commités et n'entame pas le lot C.

## Session 2 — terminée sans commit ni push

- Dépôt : `/home/jd/src/expo`, branche `main`, synchronisée avec `origin/main`.
- Source consultée : Google Doc **Japan V2**, document ID `1lGRMYlnpWc1ittvIEIdtwyTHQjzu4hFvaZ5W8NmN9Vc`, en lecture seule.
- Règle de provenance : pour l'itinéraire, les dates, logements, réservations, coûts et transports, **Japan V2 est la source de vérité**. Les informations externes ne doivent pas les remplacer; elles servent seulement de repères jusqu'à confirmation dans le document.

## Décisions confirmées

- Kawazu du 21 au 23 octobre;
- Izu Imaihama Tokyu Hotel;
- 351 $;
- ferry le 23 octobre à 9 h 30;
- Shikinejima du 23 au 26 octobre;
- Shimoda/Suzaki retiré de l'itinéraire actif.

## Modifications appliquées

- `bundles/japon/index.md`
  - itinéraire étendu à 8 segments;
  - Kawazu et Shikinejima ajoutés;
  - second séjour à Tokyo décalé au 26–29 octobre;
  - total des logements connus : 4 148,65 $ pour 29 nuits, hors coût de Shikinejima;
  - ancien segment Shimoda/Suzaki indiqué comme archive;
  - compteur Japon mis à jour à 93 concepts, dont 11 archivés.
- Nouveau `bundles/japon/kawazu/`
  - guide de l'étape;
  - fiche `Izu Imaihama Tokyu Hotel` avec les données confirmées; adresse et réservation laissées en attente de Japan V2.
- Nouveau `bundles/japon/shikinejima/index.md`
  - ferry confirmé dans l'itinéraire;
  - Hidabun conservé comme possibilité non confirmée;
  - retour vers Tokyo explicitement laissé à organiser plus tard;
  - contradiction « taxi around 8pm » / ferry à 9 h 30 signalée au lieu d'être corrigée silencieusement.
- Tokyo : dates et durée d'Alo BnB 15 mises à jour à 26–29 octobre, 3 nuits.
- Shimoda/Suzaki : ancienne page et ancien hôtel marqués comme archive; la fiche Shimoda a été déplacée de `restaurants/` vers `lieux/` et recatégorisée.
- Kyoto : lien Tokito corrigé vers sa fiche wishlist, avec incertitude explicitement indiquée.

## Contrôles

- Build local réussi : **164 concepts dans 4 bundles**.
- Répartition : Japon 93, projets 1, vins 8, wishlist 62.
- Liens internes contrôlés : **146**; liens manquants : **0**.
- `git diff --check` : propre.
- Aucun commit, push ou déploiement effectué.

## Points restant ouverts

1. Confirmer si Hidabun est réservé et fournir son lien, ou le retirer.
2. Les informations d'adresse et de réservation de Kawazu seront complétées uniquement depuis Japan V2 lorsqu'elles y apparaîtront.
3. Déterminer le trajet Shikinejima → Tokyo le 26 octobre.
4. Confirmer l'heure réelle du taxi vers Shimoda Port le 23 octobre matin.
5. Session 3 : enrichissement des guides et contrôles éditoriaux supplémentaires.

Ne pas lancer de commit/push avant revue du diff final par JD.

## Lot B — Contenu complet — terminé sans commit ni push

- Les 27 journées manquantes ont été créées dans `bundles/japon/jours/`, pour compléter exactement la série du `2026-09-30` au `2026-10-29`.
- Les programmes déjà établis ont été migrés vers les fiches quotidiennes : Tokyo (1–4 et 29 octobre), Yamanouchi (5–7), Kyoto (11–13) et Hamamatsu (19 octobre).
- Les dates moins documentées restent explicitement `partiel` ou `a-confirmer`; aucune réservation, heure de trajet ou activité nouvelle n'a été inventée.
- Les informations sensibles conservées comprennent l'arrivée à Narita, le ferry du 23 octobre à 9 h 30, le conflit d'heure du taxi vers Shimoda Port, le retour Shikinejima → Tokyo à organiser, Yamaha et le concert Jazz Week du 19 octobre.
- Les blocs quotidiens détaillés ont été retirés des index Tokyo, Yamanouchi, Toyama et Kyoto après migration; ces index restent des guides et pointent vers la vue jour par jour. Des liens d'accès ont aussi été ajoutés aux index Hamamatsu, Kawazu et Shikinejima.
- `src/build.js` vérifie maintenant que la série complète contient exactement les 30 dates attendues, sans trou, en plus des validations de type, date, doublon, champs et statut du lot A.

### Contrôles du lot B

- `npm run build` réussi : **194 concepts dans 4 bundles**, soit 27 concepts de plus que le relais du lot A.
- `/japon/jours/` contient exactement **30 cartes** dans l'ordre chronologique.
- Navigation vérifiée sur les extrémités et une journée centrale : 30 septembre sans précédent, 15 octobre avec les deux liens, 29 octobre sans suivant.
- Tous les liens internes Markdown contrôlés contre `dist/` : **aucune cible manquante**.
- `git diff --check` propre.
- `dist/` reste généré et ignoré; aucun commit, push, déploiement ou QA visuelle finale effectué.

### État et relais

- Les changements non committés antérieurs de JD et ceux du lot A ont été préservés.
- Les changements du lot B portent sur `bundles/japon/jours/**`, les index d'étapes Japon concernés, la validation ciblée de `src/build.js` et ce relais.
- Incertitudes toujours visibles dans le contenu : confirmation de Hidabun, trajet de retour du 26 octobre et heure réelle du taxi vers Shimoda Port.
- **Prochain lot : C — QA et corrections.** Ne pas l'entamer dans cette session.

ARRÊT DE SESSION OBLIGATOIRE
Lot terminé: B
Prochain lot: C
Nouvelle session: GPT-5.6 Luna / raisonnement high
Prompt de reprise:
Lis `/home/jd/src/expo/AGENTS.md`, `/home/jd/Plans/2026-09-27-plan-vue-jour-par-jour-expo.md` et `/home/jd/src/expo/HANDOFF.md`. Exécute uniquement le lot C. Respecte toutes ses portes d'arrêt, préserve les changements non commités et ne lance aucun commit, push ou déploiement.

## Lot C — QA et corrections — terminé sans commit ni push

- Contrôle visuel effectué sur `/japon/`, `/japon/jours/` et les pages du 23 et du 29 octobre en desktop et à 375 px; la timeline, les cartes, les titres longs, les statuts, la sidebar, la recherche visible et la navigation précédent/suivant restent lisibles sans débordement horizontal observé.
- Les 30 journées ont été contrôlées automatiquement : dates consécutives, 30 cartes dans l'ordre, 29 relations adjacentées et extrémités sans lien inexistant.
- Les pages imposées par le lot C répondent toutes en HTTP 200 via le serveur local : index Japon, vue jour par jour, 30 septembre, 2, 5, 23, 26 et 29 octobre, un concept Tokyo non quotidien, un autre bundle, ainsi que les assets de recherche.
- `npm run build` réussi : **194 concepts dans 4 bundles**, sans disparition imprévue dans le périmètre contrôlé.
- `git diff --check` réussi; `dist/` reste généré et ignoré.

### Correction appliquée

- Les pages `Journée` affichaient des liens de tags (`#voyage`, `#kawazu`, etc.) vers des pages non générées, car le générateur de tags reste volontairement limité aux tags du bundle vins. Dans `src/templates/concept.njk`, ces tags sont maintenant des étiquettes non cliquables uniquement pour `Journée`; le comportement des autres concepts n'a pas changé.
- Les liens internes des nouvelles pages de journée, hors tags historiques des autres concepts, ont été vérifiés contre `dist/` sans cible manquante.

### État et risques restants

- Les changements non committés antérieurs de JD et ceux des lots A/B ont été préservés. `HANDOFF.md` et `src/templates/concept.njk` sont modifiés; aucun commit, push ou déploiement n'a été effectué.
- Le générateur conserve son comportement historique de pages de tags limitées au bundle vins; certains concepts non quotidiens existants ont donc encore des liens de tags vers des pages non générées. Ce point est hors du périmètre du lot C et n'a pas été élargi.
- Incertitudes éditoriales inchangées : confirmation de Hidabun, trajet de retour Shikinejima → Tokyo le 26 octobre et heure réelle du taxi vers Shimoda Port.
- **Prochain lot : D — livraison optionnelle**, uniquement après revue explicite du diff par JD.

ARRÊT DE SESSION OBLIGATOIRE
Lot terminé: C
Prochain lot: D optionnel
Nouvelle session: GPT-5.6 Luna / raisonnement high
Prompt de reprise:
Lis `/home/jd/src/expo/AGENTS.md`, `/home/jd/Plans/2026-09-27-plan-vue-jour-par-jour-expo.md` et `/home/jd/src/expo/HANDOFF.md`. N'exécute le lot D que si JD demande explicitement le commit et le déploiement après revue du diff; sinon ne modifie rien et n'effectue aucun commit, push ou déploiement.
