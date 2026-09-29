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

# Builder le site (validation de data/japon.yaml incluse)
npm run build-expo

# Alias historique du build
npm run build

# Valider uniquement l’itinéraire
npm run validate:japan

# Exécuter tous les contrôles avant un commit
npm run pre-commit

# Activer le hook Git versionné pour ce clone (une seule fois)
git config core.hooksPath .githooks

# Préparer une synchronisation Google Doc (dry-run par défaut)
EXPO_GOOGLE_DOC_ID=<document-id> npm run sync-google-doc -- --dry-run

# Préparer un patch générique depuis un plan YAML (dry-run par défaut)
EXPO_GOOGLE_DOC_ID=<document-id> npm run sync-google-doc -- --plan <plan.yaml> --dry-run

# Tester un plan sans réseau avec une fixture JSON {id,title,body,revisionId}
npm run sync-google-doc -- --plan <plan.yaml> --document-file <document.json> --dry-run

# Écrire uniquement après revue explicite du plan
EXPO_GOOGLE_DOC_ID=<document-id> npm run sync-google-doc -- --plan <plan.yaml> --write

# Le mode historique EXPO:SYNC reste disponible
EXPO_GOOGLE_DOC_ID=<document-id> npm run sync-google-doc -- --write

# Prévisualiser
npm run preview    # → http://localhost:8000

# Déployer (push sur main)
git push origin main   # Vercel build automatique
```

### Workflow d’un patch générique

1. **Extraire** le document en lecture seule avec `--dry-run`. Les credentials
   restent gérés hors du dépôt par Hermes; aucun plan réel contenant des données
   privées ne doit être versionné.
2. **Planifier** une opération littérale explicite dans un YAML : texte ancien,
   texte nouveau, ancre ou marqueurs, cardinalité attendue et source de revue.
   Les recherches ne sont pas des expressions régulières.
3. **Prévisualiser** d’abord sur une fixture locale. L’exemple désensibilisé
   [`examples/google-doc-change-plan.example.yaml`](examples/google-doc-change-plan.example.yaml)
   s’exécute avec
   [`examples/google-doc-fixture.example.json`](examples/google-doc-fixture.example.json) :

   ```bash
   npm run sync-google-doc -- \
     --plan examples/google-doc-change-plan.example.yaml \
     --document-file examples/google-doc-fixture.example.json \
     --dry-run
   ```

4. **Revoir** le résumé : document ciblé, action, cardinalités, tailles et
   empreintes avant/après. Une cible absente ou ambiguë, un titre inattendu ou
   une fixture mal associée arrête le dry-run avec un diagnostic exploitable.
5. **Préparer le dry-run distant** en conservant le plan réel dans un fichier
   temporaire ou ignoré par Git, puis en fournissant l’identifiant attendu :

   ```bash
   EXPO_GOOGLE_DOC_ID=<document-id> npm run sync-google-doc -- \
     --plan /chemin/temporaire/plan-revu.yaml --dry-run
   ```

   Cette commande relit le Google Doc et n’appelle jamais `batchUpdate`.
6. **Appliquer puis relire** uniquement après une revue et une confirmation
   explicites, avec `--write`. Le relais revalide alors le type de document,
   `canEdit`, l’empreinte de base et la `revisionId`, puis vérifie le texte
   final. Le lot D ne réalise aucune écriture distante.

### Contrôles avant commit

`npm run pre-commit` exécute dans l’ordre la validation de `data/japon.yaml`,
le build EXPO, `check-arrival`, la suite de tests et
`git diff --cached --check`. Il s’arrête au premier échec et affiche un résumé
de chaque contrôle. Si aucun changement n’est indexé, le contrôle du diff
indexé est indiqué comme ignoré; il sera exécuté par le hook lorsqu’un commit
est préparé.

Le hook versionné se trouve dans `.githooks/pre-commit`. Il n’est pas activé
automatiquement par Git : après clonage, activez-le avec
`git config core.hooksPath .githooks`. Pour revenir au comportement Git par
défaut dans ce clone, utilisez `git config --unset core.hooksPath`.

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
