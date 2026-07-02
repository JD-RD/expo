# EXPO — Instructions pour OpenCode

Ce fichier est lu automatiquement par OpenCode. Voir `SPECS.md` pour les specs complètes.

## Résumé

Générateur de site statique Node.js qui lit des bundles OKF (markdown + YAML frontmatter) et produit un site HTML public de connaissances navigables. Déploiement Vercel.

## Stack

- Node.js 18+ (custom build script, pas de framework SSG)
- Parser : `gray-matter` + `marked`
- Templates : Nunjucks
- Search : Lunr.js (client-side)
- Graph : D3.js (future)
- CSS : Dark theme custom

## Structure

```
~/src/expo/
├── bundles/          ← SOURCE : dossiers OKF (markdown + frontmatter)
│   ├── index.md      ← Page d'accueil du portail
│   └── japon/        ← Bundle Voyage Japon (premier bundle)
├── src/              ← BUILD : Node.js build script + templates + assets
│   ├── build.js      ← Entry point : lit bundles/, génère dist/
│   ├── templates/    ← Nunjucks templates
│   └── assets/       ← CSS + JS client-side
├── dist/             ← OUTPUT : site HTML statique (gitignoré)
└── scripts/          ← Outils d'authoring (vault-export, etc.)
```

## Commandes

```bash
cd ~/src/kai
npm install                      # Install deps
node src/build.js                # Build le site → dist/
npm run preview                  # Serveur de test sur :8000
npm run build                    # Build
```

## Conventions

- `type:` REQUIS dans chaque concept OKF
- Liens en markdown absolus `/japon/tokyo/restaurants/ichiran-shibuya`
- Fichiers en kebab-case
- Dossiers `_prefix` pour concepts non-lieux (people, etc.)
- Tags en minuscule sans accents

## Phases

Voir SPECS.md section 11. Priorité Phase 1 — build system + bundle Japon.

## Déploiement

`git push origin main` → build automatique Vercel. Ne pas commiter `dist/`.
