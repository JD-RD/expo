---
type: Projet
title: EXPO — Portail de connaissances statique
description: Générateur de site statique Node.js pour bundles OKF. Navigation arborescente, recherche Lunr.js, dark theme.
tags: [expo, nodejs, okf, static-site]
timestamp: 2026-07-02
resource: https://github.com/JD-RD/expo
statut: actif
stack: Node.js, Nunjucks, Lunr.js, marked, gray-matter
---

Générateur de site statique qui transforme des **bundles OKF** (markdown + frontmatter YAML) en portail de connaissances navigable.

## Stack

| Couche | Technologie |
|--------|-------------|
| Build | Node.js custom |
| Templates | Nunjucks |
| Search | Lunr.js (client-side) |
| Markdown | marked + gray-matter |
| Déploiement | Vercel (git push → auto) |

## Bundles

- 🇯🇵 [Voyage Japon 2026](/japon/) — 131 concepts, 23 villes
- 🛠 Projets — ce bundle

## Liens

- Code source : [github.com/JD-RD/expo](https://github.com/JD-RD/expo)
- Site live : [expo-jd.vercel.app](https://expo-jd.vercel.app)
