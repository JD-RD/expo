# Projet EXPO — Portail de connaissances statique (OKF)

> **Portail de connaissances publiques.** Des bundles OKF rendus en site statique HTML, navigables et partageables.

État: **Spécification v0.1** — Prête pour implémentation.

---

## 1. Résumé

Un générateur de site statique Node.js qui lit des **bundles OKF** (dossiers de markdown + frontmatter YAML) et produit un site HTML public. Le site liste les bundles disponibles, permet de naviguer dans l'arborescence des concepts, affiche les liens entre concepts, et offre une recherche full-text.

Le pipeline :

```
Obsidian Vault ──┐
Agent Hermes ────┤──→ bundles/ (OKF .md) ──→ src/build.js ──→ dist/ ──→ Vercel
Manuel ──────────┘                                  ↑
                                              templates/ + assets/
```

---

## 2. Stack technique

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Source | OKF v0.1 (markdown + YAML frontmatter) | Standard ouvert, versionnable, portable |
| Build | Node.js 18+ custom script | JD maîtrise, pas de framework SSG opaque |
| Parser | `gray-matter` + `marked` | Frontmatter YAML + rendu markdown |
| Templates | Nunjucks | Layouts, includes, héritage de templates |
| Search | Lunr.js (client-side) | Index JSON généré au build, zéro serveur |
| Graph | D3.js force-directed | Vue interactive des liens entre concepts |
| CSS | Custom dark (compatible Vault) | Cohérence avec l'existant, personnalisable |
| Déploiement | Vercel (gratuit) ou Cloudflare Pages | `git push` → build → en ligne |
| Search crawl | robots.txt + sitemap.xml | Référencement Google si désiré |

### Dépendances Node.js

```json
{
  "dependencies": {},
  "devDependencies": {
    "gray-matter": "^4.0.3",
    "marked": "^14.0.0",
    "nunjucks": "^3.2.4"
  }
}
```

Zéro runtime. Tout est build-time. Le site déployé est du HTML/CSS/JS pur.

---

## 3. Arborescence du projet

```
~/src/expo/
├── SPECS.md                    ← Ce document
├── AGENTS.md                   ← Instructions OpenCode
├── package.json
├── .gitignore
├── vercel.json                 ← Config Vercel (ou cloudflare pages)
├── robots.txt                  ← Pour SEO (bundles publics)
│
├── bundles/                    ← SOURCE : bundles OKF
│   ├── index.md                ← Page d'accueil du portail (listing bundles)
│   │
│   ├── japon/                  ← Bundle Voyage Japon 2026
│   │   ├── index.md            ← Accueil du bundle
│   │   ├── log.md              ← Historique
│   │   ├── tokyo/
│   │   │   ├── index.md
│   │   │   ├── restaurants/
│   │   │   │   ├── index.md
│   │   │   │   ├── ichiran-shibuya.md
│   │   │   │   └── ...
│   │   │   ├── attractions/
│   │   │   │   ├── index.md
│   │   │   │   └── ...
│   │   │   └── shopping/
│   │   │       └── ...
│   │   ├── kyoto/
│   │   │   └── ...
│   │   ├── kanazawa/
│   │   │   └── ...
│   │   ├── kiso-matsumoto/
│   │   │   └── ...
│   │   ├── kusatsu/
│   │   │   └── ...
│   │   └── _people/
│   │       └── meggie-lennon.md
│   │
│   └── projets/                ← Bundle Projets (futur)
│       ├── index.md
│       └── ...
│
├── src/                        ← BUILD : code source du générateur
│   ├── build.js                ← Script principal (entry point)
│   ├── lib/
│   │   ├── bundle-reader.js    ← Parcourt un dossier OKF, parse tout
│   │   ├── graph-builder.js    ← Construit le graphe des liens
│   │   ├── renderer.js         ← Rend les templates Nunjucks
│   │   └── search-index.js     ← Génère l'index Lunr.js
│   ├── templates/              ← Templates Nunjucks
│   │   ├── layouts/
│   │   │   └── base.njk        ← Layout HTML de base
│   │   ├── portal.njk          ← Page d'accueil du portail
│   │   ├── concept.njk         ← Page d'un concept
│   │   ├── index-page.njk      ← Page index d'un répertoire
│   │   ├── tag-index.njk       ← Page de tous les tags
│   │   └── 404.njk             ← Page 404
│   └── assets/                 ← Static copié tel quel dans dist/
│       ├── style.css
│       ├── search.js           ← Lunr.js client-side
│       └── graph.js            ← D3.js graph view
│
├── dist/                       ← OUTPUT : site généré (gitignoré)
│
├── scripts/                    ← Outils d'authoring
│   ├── vault-export.mjs        ← Convertit notes Obsidian → OKF
│   └── maps-list-import.mjs    ← Importe google-maps-list → OKF
│
└── data/                       ← Données auxiliaires
    └── emoji-map.json          ← Mapping type → emoji pour l'affichage
```

---

## 4. Format OKF — Concepts

Chaque fichier `.md` non-réservé est un **concept**. Exemple pour un restaurant :

```markdown
---
type: Restaurant
title: Ichiran Shibuya
description: Ramen tonkotsu emblématique, ouvert 24h. Parfait pour lunch solo.
tags: [tokyo, shibuya, ramen, lunch]
resource: https://maps.google.com/... (optionnel)
timestamp: 2026-06-01
note: "Arriver avant 11h30 pour éviter la file"
prix: "¥1500-2500"
quartier: Shibuya
adresse: "〒150-0002 Tokyo, Shibuya, 1-24-10"
coords: "35.6580,139.7014"
---

Ichiran est une chaîne de ramen tonkotsu reconnue pour ses boxes individuels.
Idéal pour un repas rapide en solo.

## À savoir

- Commandes via distributeur automatique à l'entrée
- Chaque box individuelle (counter seat)
- Niveau d'épice personnalisable

## Liens

- Voisin du [Shibuya Crossing](/japon/tokyo/attractions/shibuya-crossing)
- Recommandé par [Meggie](/japon/_people/meggie-lennon)
- Quartier [Shibuya](/japon/tokyo/index)

## Citations

[1] [Google Maps](https://maps.google.com/...)
```

**Règles :**
- `type:` REQUIS — détermine l'icône et le rendu
- `title:` recommandé — sinon dérivé du filename
- `description:` recommandé — utilisé dans les index et previews
- `tags:` optionnel — catégorisation cross-bundle
- Lients en markdown standard → résolus en HTML statique
- Chemins absolus (`/japon/...`) relatifs à la racine du portail

---

## 5. Pipeline du Build

Le script `src/build.js` s'exécute en une passe :

```
1. Lire bundles/index.md → métadonnées du portail
2. Pour chaque sous-dossier de bundles/ :
   a. Parcourir récursivement les .md (sauf index.md, log.md — traités à part)
   b. Parser frontmatter + body (gray-matter + marked)
   c. Indexer les liens sortants (tout markdown link vers un autre .md)
   d. Résoudre les liens : valider les targets, construire le graphe
3. Générer les pages HTML :
   a. Portal : bundles/index.md
   b. Bundle index : chaque index.md
   c. Concept : chaque concept .md
   d. Tags : une page /tags/ avec tous les tags
   e. 404
4. Générer les données :
   a. search-index.json (titre, description, url, tags, body text)
   b. graph-data.json (nodes + edges pour D3.js)
5. Copier assets/ → dist/assets/
6. Copier CNAME, robots.txt, sitemap.xml → dist/
```

**Build time** attendu : < 2s pour 200 concepts.

---

## 6. Layout des pages

### 6.1 Structure HTML commune

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Concepts · KAI</title>
  <link rel="stylesheet" href="/assets/style.css">
  <link rel="icon" href="data:image/svg+xml,...">
</head>
<body>
  <nav>
    <a href="/" class="logo">⚡ KAI</a>
    <input type="search" id="search" placeholder="Rechercher...">
    <span id="bundle-nav">🇯🇵 Voyage Japon 2026</span>
  </nav>

  <aside class="sidebar">
    <ul class="tree">
      <li><a href="/japon/">🇯🇵 Japon</a>
        <ul>
          <li><a href="/japon/tokyo/">🗼 Tokyo</a>
            <ul>
              <li><a href="/japon/tokyo/restaurants/">🍜 Restaurants</a></li>
              <li><a href="/japon/tokyo/attractions/">🗿 Attractions</a></li>
            </ul>
          </li>
          <li><a href="/japon/kyoto/">⛩ Kyoto</a></li>
        </ul>
      </li>
    </ul>
  </aside>

  <main>
    <nav class="breadcrumb">
      <a href="/">Accueil</a> / <a href="/japon/">Japon</a> / <span>Ichiran Shibuya</span>
    </nav>

    <article>
      <header>
        <span class="type-badge">🍜 Restaurant</span>
        <h1>Ichiran Shibuya</h1>
        <p class="description">Ramen tonkotsu emblématique...</p>
        <div class="tags">
          <a href="/tags/tokyo">#tokyo</a>
          <a href="/tags/ramen">#ramen</a>
        </div>
      </header>

      <div class="content">
        <!-- Markdown body rendu -->
      </div>

      <footer class="links-graph">
        <h3>🔗 Liens</h3>
        <ul>
          <li>→ <a href="/japon/tokyo/attractions/shibuya-crossing">Shibuya Crossing</a></li>
          <li>→ <a href="/japon/_people/meggie-lennon">Meggie</a></li>
        </ul>

        <div id="graph" style="height:300px"></div>
        <script src="/assets/graph.js"></script>
      </footer>
    </article>
  </main>

  <script src="/assets/search.js"></script>
</body>
</html>
```

### 6.2 Palette / Thème

Sombre (comme Vault), avec accents couleur par type de concept :

```css
:root {
  --bg: #0d1117;
  --bg-card: #161b22;
  --bg-hover: #1c2333;
  --text: #e6edf3;
  --text-muted: #8b949e;
  --border: #30363d;
  --accent: #58a6ff;
  --accent2: #3fb950;
  --accent3: #d2a8ff;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Cascadia Code', monospace;
}

/* Type badges */
.type-Restaurant { background: #3fb95022; color: #3fb950; }
.type-Attraction { background: #d2a8ff22; color: #d2a8ff; }
.type-Lieu      { background: #58a6ff22; color: #58a6ff; }
```

---

## 7. Exemples concrets de rendu

### Page d'accueil du portail : `bundles/index.md`

```markdown
---
title: KAI — Knowledge Explorer
description: Portail de connaissances partagées
---

# ⚡ KAI

Des bundles de connaissances, explorables et partageables.

## 🇯🇵 Voyage Japon 2026

Tout ce qu'il faut savoir pour le voyage : restaurants, attractions, shopping,
hébergement — à Tokyo, Kyoto, Kanazawa, Kiso Valley, Matsumoto, Kusatsu.

[Explorer le bundle →](/japon/)

## 🛠 Projets

Les projets en cours : LaFaceB, tracks-dl, Calendar, Factures, Vault, et plus.

[Voir les projets →](/projets/)

## Tags

Parcourir par tag : [Japon](/tags/japon), [tech](/tags/tech), [bouffe](/tags/bouffe)...
```

Rendu : une page avec cartes de présentation des bundles, chacune avec titre, description, icône, et un lien "Explorer".

### Page d'index d'un répertoire : `bundles/japon/tokyo/restaurants/index.md`

```markdown
# 🍜 Restaurants — Tokyo

* [Ichiran Shibuya](ichiran-shibuya) - Ramen tonkotsu, ouvert 24h
* [Tsukiji Sushi Dai](tsukiji-sushi-dai) - Sushi frais au marché
* [Katsukura Shinjuku](katsukura-shinjuku) - Tonkatsu croustillant
* ...
```

Rendu : liste stylée avec émojis, descriptions, liens.

### Page d'erreur 404

```markdown
---
type: _404
---

# 🌊 Page non trouvée

Ce concept n'existe pas (encore) dans ce bundle.

[Retour à l'accueil](/)
```

---

## 8. Vault Export Script

`scripts/vault-export.mjs` :

Convertit des notes Obsidian en concepts OKF. Logique :

1. Lit les fichiers `.md` du vault
2. Extrait le frontmatter (Obsidian `---` blocks)
3. Mappe les champs Obsidian → OKF
4. Nettoie : enlève les notes privées, les embeds internes `![[...]]`
5. Convertit les `[[wikilinks]]` en markdown links `/chemin/vers/concept`
6. Écrit dans `bundles/<bundle>/`

```bash
node scripts/vault-export.mjs \
  --vault ~/obsidian/jd-vault \
  --bundle japon \
  --filter "Japon/"
```

## 9. Agent Hermes — Intégration

Un skill Hermes qui permet à l'agent d'écrire des concepts OKF directement dans `~/src/expo/bundles/`.

**Commandes possibles pendant une conversation :**

- "Enregistre ce restaurant comme concept Japon"
- "Ajoute un lien entre ce concept et le projet X"
- "Met à jour la description du concept Ichiran"
- "Génère les index.md pour tout le bundle Japon"

L'agent utilise `write_file` pour créer/mettre à jour les `.md` directement, puis après la session, exécute le build pour voir le rendu.

---

## 10. Déploiement (Vercel)

`vercel.json` :

```json
{
  "buildCommand": "node src/build.js",
  "outputDirectory": "dist",
  "framework": null,
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

**Domaine** : À définir (ex: `kai.jd.xyz`, `share.jd.xyz`, `expo.jd.xyz`).

**Workflow** :
```bash
git add bundles/ src/
git commit -m "feat: ajout concept Ichiran Shibuya"
git push origin main   # → déploiement automatique Vercel
```

---

## 11. Phases d'implémentation

### Phase 1 — P0 : Build system + bundle Japon

**Livrable :** Site live avec le bundle Japon navigable

| Tâche | Dépendance | Effort |
|-------|-----------|--------|
| Scaffold projet (package.json, dirs, .gitignore, vercel.json) | — | Petit |
| Build script : lire bundles/, parser .md, output HTML | — | Moyen |
| Template concept.njk (rendu d'un concept) | Build script | Petit |
| Template index-page.njk (listing de répertoire) | Build script | Petit |
| Template portal.njk (page d'accueil) | Build script | Petit |
| Template base.njk (layout HTML, nav, sidebar) | — | Petit |
| CSS dark theme basique | — | Moyen |
| Importer les données Japon (155 lieux → concepts OKF) | — | Grand |
| Sidebar arborescence (navigation hiérarchique) | Build script | Petit |
| Breadcrumbs | Build script | Petit |
| Déploiement Vercel + domaine | — | Petit |

### Phase 2 — P1 : Navigation & recherche

**Livrable :** Site pleinement fonctionnel avec recherche et tags

| Tâche | Dépendance | Effort |
|-------|-----------|--------|
| Lunr.js search index + UI client-side | Phase 1 | Moyen |
| Résolution des liens cross-concept (valides → href) | Phase 1 | Petit |
| Pages de tags (/tags/tokyo, /tags/ramen, etc.) | Phase 1 | Petit |
| Type badges avec couleurs (Restaurant, Attraction, etc.) | Phase 1 | Petit |
| Responsive design (mobile) | Phase 1 | Moyen |
| Sitemap.xml + robots.txt | Phase 2 | Petit |

### Phase 3 — P1 : Authoring tools

**Livrable :** Pipeline complet Vault → OKF → site

| Tâche | Dépendance | Effort |
|-------|-----------|--------|
| Script vault-export.mjs (Obsidian → OKF) | Phase 1 | Moyen |
| Script maps-list-import.mjs (google-maps-list → OKF) | — | Moyen |
| Skill Hermes pour agent-writer | Phase 1 | Petit |
| Bundle Projets : créer concepts depuis les projets existants | Phase 1 | Moyen |
| Bundle Pêche : créer concepts depuis ~/peche/ | Phase 1 | Moyen |

### Phase 4 — P2 : Graph view & polish

**Livrable :** Site visuellement riche

| Tâche | Dépendance | Effort |
|-------|-----------|--------|
| D3.js force-directed graph view | Phase 2 | Grand |
| Dark/light mode toggle | Phase 2 | Petit |
| Animations douces (transitions pages) | Phase 2 | Petit |
| Typographie améliorée (fontes variables) | Phase 2 | Petit |
| Page 404 personnalisée | Phase 1 | Petit |
| OpenGraph meta tags (partage social) | Phase 2 | Petit |

### Phase 5 — P2 : Extras

**Livrable :** Fonctionnalités avancées

| Tâche | Dépendance | Effort |
|-------|-----------|--------|
| Embed Google Maps / images dans les concepts | Phase 1 | Petit |
| RSS/Atom feed des mises à jour du bundle | Phase 1 | Petit |
| Export PDF d'un concept ou bundle | Phase 4 | Moyen |
| Statistiques du bundle (# concepts, liens, tags) | Phase 2 | Petit |
| Table of contents automatique pour longs concepts | Phase 4 | Petit |

---

## 12. Bundle Japon — Spécification des données

Source : `~/japon/google-maps-list/` (12 fichiers par ville, tableaux par type).

### Mapping Google Maps List → OKF

Chaque entrée d'un tableau existant devient un concept `.md` :

| Champ Google Maps | Champ OKF | Exemple |
|------------------|-----------|---------|
| Nom | `title` (frontmatter) | Ichiran Shibuya |
| Adresse | `adresse` (frontmatter) | 〒150-0002 Tokyo... |
| Notes personnelles | `description` + body | "Arriver avant 11h30" |
| URL Maps | `resource` | https://maps.google.com/... |
| Type (colonne) | `type:` + dossier | Restaurant → `type: Restaurant`, dossier `restaurants/` |
| Ville | Dossier parent | `tokyo/restaurants/` |

### Arborescence par ville

```
japon/
├── _people/                    ← Personnes (Meggie, guides, etc.)
├── tokyo/
│   ├── index.md
│   ├── restaurants.md          ← ! Converti en dossier si >5 entrées
│   ├── attractions/
│   ├── shopping/
│   ├── cafés/
│   └── transport/
├── kyoto/ (idem tokyo)
├── kanazawa/
├── kiso-matsumoto/
├── kusatsu/
└── index.md                    ← Sommaire du bundle
```

### Convention de nommage

- Fichiers : `kebab-case.md` (ex: `ichiran-shibuya.md`)
- Dossiers : `kebab-case` (ex: `petanque-clubs/`)
- Personnes : `_prefix` pour concepts non-lieux (ex: `_people/meggie-lennon.md`)
- Tags : lowercase, sans accents (ex: `tokyo`, `ramen`, `shibuya`)

---

## 13. Bundle Projets (futur)

Chaque projet JD deviendrait un concept OKF :

```markdown
---
type: Projet
title: LaFaceB
description: Outil Node.js + ffprobe pour analyser des fichiers audio.
tags: [tech, nodejs, audio]
resource: ~/src/la-face-b/
timestamp: 2026-06-15
status: en_cours
---

# LaFaceB

[GitHub](https://github.com/jd/...)

## Stack
- Node.js + Express
- ffprobe (analyse audio)
- ...

## Notes
- ...
```

Avec liens vers les concepts liés (technos, personnes, etc.)

---

## 14. Questions ouvertes

Avant de commencer l'implémentation :

1. ✅ **Nom du projet ?** (KAI, EXPO, SHARE — ou autre idée ?)
2. ❓ **Domaine ?** (kai.jd.xyz, expo.jd.xyz, ou nouveau ?)
3. ❓ **Bundle Japon en premier ?** Ou commencer par un bundle plus petit pour tester ?
4. ❓ **Vercel ou Cloudflare Pages ?** Les deux sont gratuits — Vercel a un meilleur DX pour Node.js build
5. ❓ **Contenu initial du bundle Japon :** Importer les 155 lieux d'un coup, ou commencer par une ville (Tokyo) pour valider le format ?
6. ❓ **Github public ou privé ?** Le site est public, mais le repo pourrait être privé
