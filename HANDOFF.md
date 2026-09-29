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
- ancien segment insulaire et ferry retirés de l'itinéraire actif;
- Shimoda/Suzaki retiré de l'itinéraire actif.

## Modifications appliquées

- `bundles/japon/index.md`
  - itinéraire ramené à 7 segments;
  - Kawazu ajouté;
  - second séjour à Tokyo décalé au 26–29 octobre;
  - total des logements connus : 3 819,65 $ pour 23 nuits tarifées;
  - ancien segment Shimoda/Suzaki indiqué comme archive;
  - compteur Japon mis à jour à 93 concepts, dont 11 archivés.
- Nouveau `bundles/japon/kawazu/`
  - guide de l'étape;
  - fiche `Izu Imaihama Tokyu Hotel` avec les données confirmées; adresse et réservation laissées en attente de Japan V2.
- L'ancien segment insulaire, son logement et son transport ont été retirés; les dates du 23 au 25 octobre restent à redéfinir dans Japan V2.
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

1. Les informations d'adresse et de réservation de Kawazu seront complétées uniquement depuis Japan V2 lorsqu'elles y apparaîtront.
2. Redéfinir les dates du 23 au 25 octobre dans Japan V2.
3. Session 3 : enrichissement des guides et contrôles éditoriaux supplémentaires.

Ne pas lancer de commit/push avant revue du diff final par JD.

## Lot B — Contenu complet — terminé sans commit ni push

- Les 27 journées manquantes ont été créées dans `bundles/japon/jours/`, pour compléter exactement la série du `2026-09-30` au `2026-10-29`.
- Les programmes déjà établis ont été migrés vers les fiches quotidiennes : Tokyo (1–4 et 29 octobre), Yamanouchi (5–7), Kyoto (11–13) et Hamamatsu (19 octobre).
- Les dates moins documentées restent explicitement `partiel` ou `a-confirmer`; aucune réservation, heure de trajet ou activité nouvelle n'a été inventée.
- Les informations sensibles conservées comprennent l'arrivée à Narita, Yamaha et le concert Jazz Week du 19 octobre.
- Les blocs quotidiens détaillés ont été retirés des index Tokyo, Yamanouchi, Toyama et Kyoto après migration; ces index restent des guides et pointent vers la vue jour par jour. Des liens d'accès ont aussi été ajoutés aux index Hamamatsu et Kawazu.
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
- Incertitudes toujours visibles dans le contenu : dates et programme du 23 au 25 octobre.
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
- Incertitudes éditoriales inchangées : dates et programme du 23 au 25 octobre.
- **Prochain lot : D — livraison optionnelle**, uniquement après revue explicite du diff par JD.

ARRÊT DE SESSION OBLIGATOIRE
Lot terminé: C
Prochain lot: D optionnel
Nouvelle session: GPT-5.6 Luna / raisonnement high
Prompt de reprise:
Lis `/home/jd/src/expo/AGENTS.md`, `/home/jd/Plans/2026-09-27-plan-vue-jour-par-jour-expo.md` et `/home/jd/src/expo/HANDOFF.md`. N'exécute le lot D que si JD demande explicitement le commit et le déploiement après revue du diff; sinon ne modifie rien et n'effectue aucun commit, push ou déploiement.

## Session 4 — Kanazawa et achats ciblés — terminé localement, sans commit ni push

- L'étape active du **8 au 11 octobre** a été remplacée de Toyama par **Kanazawa**, conformément à Japan V2.
- Nouveau logement : **HOTEL MYSTAYS Kanazawa Katamachi**, 1-10-18 Katamachi, Kanazawa, Ishikawa 920-0981; prix encore à confirmer. Le lien officiel et le lien Booking.com de Japan V2 sont repris dans la fiche.
- Les anciennes fiches Toyama ont été déplacées sous `bundles/japon/toyama-archive/` et ne sont plus présentées comme une étape active.
- Les journées du 8, 9, 10 et 11 octobre ont été réécrites pour Kanazawa, avec le trajet de travail Yamanouchi → Nagano → Kanazawa, les activités Japan V2 et les éléments encore à confirmer clairement marqués.
- Une stratégie d'achats ciblés a été ajoutée à Tokyo : Chrono Trigger sur Super Famicom à Akihabara le 27 octobre; synthés à Five G le 28 octobre; vinyle Little Tempo & Yoko Fujita, `茶の味 / Cha no Aji`, 7 pouces Kedaco Sounds KS-004, avec recherche Discogs et HMV Record Shop Shibuya; Clockface Modular uniquement sur rendez-vous.
- Contrôles : build réussi à **199 concepts dans 4 bundles**; **226 liens internes contrôlés, 0 cible manquante**; `git diff --check` propre; aucun commit, push ou déploiement.
- À confirmer avant livraison : prix et réservation Kanazawa, horaires définitifs du trajet du 8 octobre, horaires/rendez-vous des magasins et stock réel du KS-004 et de Chrono Trigger.

ARRÊT DE SESSION — revue explicite de JD requise avant commit/push.

## Session 6 — synchronisation Japan V2 — terminée localement, sans commit ni push

- Japan V2 relu en lecture seule le 28 septembre 2026; document retenu : **Japan V2**, ID `1lGRMYlnpWc1ittvIEIdtwyTHQjzu4hFvaZ5W8NmN9Vc`.
- Le résumé actuel retient Minamiizu du 21 au 24 octobre (449 $), Gora du 24 au 26 octobre (273 $), puis Tokyo du 26 au 29 octobre (Alo BnB 15 à 543 $). Kanazawa est maintenant chiffré à 329 $.
- EXPO présente Minamiizu et Gora comme étapes actives; quatre nouvelles fiches ont été ajoutées. Les adresses, réservations et trajets restent explicitement à compléter.
- La proposition détaillée Kawazu/Imaihama est conservée comme scénario non actif, car elle entre en conflit avec le résumé Minamiizu/Gora de Japan V2.
- Les journées du 21 au 26 octobre, l'arrivée du 30 septembre et le départ du 29 octobre ont été synchronisés; le vol retour à 18 h 45 est désormais marqué confirmé, avec terminal encore à vérifier.
- Contrôles : `npm run build` réussi — **201 concepts dans 4 bundles**; **30 journées** générées; **238 fichiers Markdown** analysés pour les liens internes, **0 cible manquante**; `git diff --check` propre.
- Aucun commit, push, déploiement ou écriture dans Google Docs n'a été effectué dans cette session.

### Portes restantes

- Revoir le diff final avant tout commit ou push.
- Décider explicitement si Minamiizu/Gora ou Kawazu/Imaihama devient la version définitive avant d'ajouter des trajets réservables.

## Session 7 — adresse Tokyo et instructions du propriétaire — terminée localement

- Japan V2 a été mis à jour en écriture ciblée avec l'adresse complète **CATS-2, chambre 502**, 2-24-5 Tabatashinmachi, Kita City, Tokyo 114-0012, ainsi que sa version japonaise.
- La section d'arrivée reprend maintenant le trajet du propriétaire : Terminal 2–3 → Skyliner → Nippori → Nippori–Toneri Liner → Akado-shōgakkōmae, sortie ouest, environ 400 m / 5–6 min de marche.
- Les consignes de clé sont documentées : porte du logement non verrouillée selon le propriétaire, clé sur la table à l'arrivée, clé laissée dans la chambre au check-out.
- EXPO est synchronisé avec ces informations dans la fiche d'hébergement Tokyo et la journée du 30 septembre.
- Contrôles : `npm run build` réussi — **201 concepts dans 4 bundles**; **238 fichiers Markdown** analysés pour les liens internes, **0 cible manquante**; `git diff --check` propre.
- Les modifications EXPO restent locales et non commitées; aucun push n'a été effectué pour cette session.

## Session 5 — propositions de transport Japan V2 — terminée localement

- Section **« Propositions »** relue dans le Google Doc Japan V2 en lecture seule.
- Les propositions de transport ont été intégrées aux journées du 5, 11, 18, 21 et 29 octobre dans `bundles/japon/jours/`; les journées du 23 au 26 ont ensuite été vidées du segment retiré.
- L'index Kawazu reprend l'arrivée depuis Hamamatsu; les journées du 23 au 25 restent à planifier.
- Le 29 octobre ne présente plus 18 h 45 comme un départ confirmé : l'ambiguïté vol/arrivée à Narita est visible.
- Contrôles : `node src/build.js` réussi — **199 concepts dans 4 bundles**; **30 journées** générées; **321 fichiers HTML** contrôlés; **0 lien interne manquant**; `git diff --check` propre.
- Aucun commit, push ou déploiement effectué; revue explicite de JD requise.

ARRÊT DE SESSION — revue explicite de JD requise avant commit/push.

## Lot 2 — Validation YAML intégrée au build EXPO — terminé sans commit ni push

### Changements

- Nouvelle commande `scripts/build-expo.mjs` : valide `data/japon.yaml` avec le
  validateur du lot 1 avant d'invoquer `src/build.js`.
- `--data <chemin>` est accepté par `build-expo` pour tester une source YAML
  sans modifier `data/japon.yaml`; les autres arguments sont transmis au
  générateur.
- `npm run build` et `npm run dev` passent maintenant par `build-expo`;
  `npm run build-expo` est la commande canonique.
- Le dry-run `npm run sync:japan` utilise le même pipeline validé. Le mode
  `--write` reste indisponible et ne touche pas Google Docs.
- Vercel, `AGENTS.md`, `README.md`, `SPECS.md` et le message de
  `scripts/maps-list-import.mjs` documentent le pipeline validé.
- Tests ajoutés dans `test/build-expo.test.mjs` : YAML invalide bloqué avant
  génération/nettoyage de `dist`, build réussi sur la source actuelle et
  absence de modification des sources Markdown/YAML.

### Contrôles du lot 2

- `npm test` réussi : 6 tests.
- `npm run validate:japan` réussi.
- `npm run build` réussi : **201 concepts dans 4 bundles**.
- `npm run sync:japan` réussi en dry-run, sans écriture de source ni Google Doc.
- `git diff --check` propre.
- Aucun commit, push ou déploiement effectué.

### Décisions et risques

- Le générateur historique `src/build.js` reste inchangé pour préserver son
  comportement; les entrées documentées, `npm run build` et Vercel passent par
  `build-expo`. Une invocation manuelle directe de `node src/build.js` peut
  donc encore contourner cette validation.
- Aucun Markdown n'est généré, migré ou écrasé depuis le YAML dans ce lot.
- Les modifications non commitées des lots précédents et du lot 1 ont été
  préservées. `dist/` reste une sortie générée et ignorée.

ARRÊT DE SESSION OBLIGATOIRE
Lot terminé: 2
Prochain lot: 3 — sync-google-doc ou check-arrival, selon décision explicite
Nouvelle session: GPT-5.6 Luna / raisonnement high
Prompt de reprise:
Lis `AGENTS.md`, `md/plan-automatisation.md` et `HANDOFF.md`. Exécute
uniquement le lot 3 — `sync-google-doc` ou `check-arrival`, après décision
explicite sur lequel commencer. Respecte les garde-fous du plan, préserve les
modifications non commitées, ne modifie pas l'autre sous-lot et n'effectue
aucun commit, push ou déploiement.

## Lot 3 — `check-arrival` — terminé sans commit ni push

### Décision de périmètre

- Le sous-lot exécuté est **`check-arrival`**; `sync-google-doc` n'a pas été
  modifié et aucun accès ou appel Google Doc n'a été effectué.
- Le contrôle reste local et lit `data/japon.yaml`, sans recherche externe ni
  écriture de source distante.

### Changements

- Ajout d'une section structurée `arrival` pour l'arrivée du 30 septembre :
  Narita → Nippori par Keisei Skyliner → Akado-shōgakkōmae par
  Nippori–Toneri Liner → CATS-2.
- Ajout de `scripts/check-arrival.mjs`, avec `--data <chemin>` comme les
  autres commandes YAML.
- Le contrôle vérifie la date, l'aéroport, l'heure, le terminal et son statut,
  la correspondance des segments, le premier logement actif, l'adresse, la
  station, la sortie, la distance de marche et les instructions de clé.
- Ajout de `npm run check-arrival` et de tests couvrant le trajet valide, une
  mauvaise station finale et l'absence d'instructions de clé.

### Contrôles

- `npm test` réussi.
- `npm run check-arrival` réussi avec un seul avertissement attendu : le
  terminal Narita 2–3 reste à confirmer.
- `npm run validate:japan` réussi.
- `npm run build` réussi : **201 concepts dans 4 bundles**.
- `git diff --check` réussi.
- Aucun commit, push ou déploiement effectué; `dist/` reste généré et ignoré.

ARRÊT DE SESSION RECOMMANDÉ
Sous-lot terminé: 3 — `check-arrival`
Sous-lot non commencé: 3 — `sync-google-doc`
Ne pas commencer `sync-google-doc` dans cette session.
