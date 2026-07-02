# ⚡ EXPO — Portail de connaissances statique (OKF)

Transforme des bundles **[OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)** (Open Knowledge Format) en un site web statique, navigable et partageable.

> **🇯🇵 Voyage Japon 2026** — Premier bundle en ligne. Tokyo, Kyoto, Kanazawa, Kiso Valley, Kusatsu.

---

## ✨ Fonctionnalités

- **Bundles OKF** — Répertoires de markdown + YAML frontmatter, standard ouvert
- **Navigation arborescente** — Parcours hiérarchique des concepts
- **Liens cross-concept** — Graphe de connaissances avec forward/backlinks
- **Recherche full-text** — Client-side (Lunr.js), zéro serveur
- **Tags** — Catégorisation transverse
- **Statique** — HTML pur, déploiement Vercel/Cloudflare, rapide et gratuit
- **Dark theme** — Lecture confortable

## 🏗 Stack

| Couche | Technologie |
|--------|-------------|
| Source | OKF v0.1 (markdown + YAML frontmatter) |
| Build | Node.js custom script |
| Templates | Nunjucks |
| Search | Lunr.js (client-side) |
| CSS | Dark theme custom |
| Déploiement | Vercel (git push → auto) |

## 📁 Structure

```
bundles/           ← SOURCE : dossiers OKF
├── index.md       ← Portail — page d'accueil du site
└── japon/         ← Bundle Voyage Japon
    ├── index.md
    ├── tokyo/restaurants/ichiran-shibuya.md
    ├── tokyo/attractions/shibuya-crossing.md
    └── …

src/               ← BUILD : générateur de site
├── build.js       ← Script principal
├── templates/     ← Nunjucks
└── assets/        ← CSS + JS

dist/              ← OUTPUT : site HTML statique (gitignored)
```

## 🚀 Déploiement

```bash
# Cloner
git clone git@github.com:JD-RD/expo.git
cd expo

# Installer les dépendances
npm install

# Builder le site
node src/build.js

# Prévisualiser
npm run preview    # → http://localhost:8000

# Déployer (push sur main)
git push origin main   # Vercel build automatique
```

## 🧭 Branches

```
main       ← Production. Ce que Vercel déploie. Protégée.
develop    ← Intégration des changements. Protection partielle.
feature/*  ← Nouveaux bundles ou fonctionnalités majeures.
fix/*      ← Corrections.
```

**Workflow recommandé :**
1. Pour une mise à jour rapide (1-2 concepts) : commit direct sur `main`
2. Pour un nouveau bundle ou restructuration : branche `feature/*` → PR → `develop` → `main`
3. Pour une correction urgente : branche `fix/*` → PR → `main`

## 🔒 Sécurité

Ce dépôt est **public** — les bundles qu'il contient sont destinés à être partagés.

- **Aucun secret, mot de passe ou token** ne doit être commité
- Les informations personnelles (adresses, notes privées) doivent être revues avant publication
- Un bundle peut être retiré du site en le supprimant simplement de `bundles/`
- Voir `SECURITY.md` pour les pratiques recommandées

## 📖 Licence

MIT
