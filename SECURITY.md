# 🔒 Sécurité pour EXPO

Ce projet est **public** par conception. Les bundles OKF qu'il contient sont destinés à être partagés sur le web. Ce document définit les règles pour s'assurer que rien de sensible ne fuite.

## 🔴 Ce qui ne doit JAMAIS être commité

- **Mots de passe, tokens API, clés SSH** — aucune exception
- **Adresse personnelle complète** — les adresses de lieux publics (restaurants, musées) sont OK, pas ton domicile
- **Identifiants bancaires, numéros de carte, comptes**
- **Notes privées** — ex : "code porte 1234", "mot de passe WiFi X"
- **Fichiers de config locaux** — `.env`, `config.local.yaml`, credentials

## 🟡 Ce qui nécessite une relecture

- **Commentaires personnels** — "Arriver avant 11h30" = OK, "Ne pas inviter X" = NON
- **Coordonnées GPS d'un lieu privé** — domicile, chalet → brouiller ou omettre
- **Liens vers des ressources internes** — remplacer par des ressources publiques

## 🟢 Ce qui est OK

- Noms et adresses de lieux publics (restaurants, musées, parcs)
- URLs Google Maps publiques
- Notes de voyage anodines ("essayer le ramen", "belle vue")
- Tags, catégories, métadonnées descriptives
- Références à des personnes (avec leur consentement implicite pour un guide de voyage partagé)

## ✅ Checklist avant chaque push

- [ ] Je n'ai pas commité de fichier `.env`, `config.local.*`, ou credentials
- [ ] Les notes personnelles sont revues et appropriées pour le public
- [ ] Les liens et URLs sont des ressources publiques
- [ ] Le `.gitignore` est respecté

## 🛡️ Mécanismes de protection

- **`.gitignore`** — ignore `node_modules/`, `dist/`, `.env`, fichiers de config locaux
- **Secret scanning** — GitHub scanne automatiquement les tokens et clés commités
- **Branch protection** — `main` protégée : pas de push forcé, PR requise pour les changements majeurs
- **Dépendances** — `npm audit` avant chaque déploiement

## 📝 Politique de rétraction

Si un concept publié ne devrait pas l'être :

```bash
# Option 1 : Supprimer le fichier
git rm bundles/japon/tokyo/restaurants/concept-sensible.md
git commit -m "remove: concept sensible"
git push

# Option 2 : Remplacer le contenu par un placeholder
# (moins destructeur, garde l'URL)
```

## 🔐 Bonnes pratiques git

```bash
# Vérifier ce qui va être commité
git diff --cached

# Vérifier qu'aucun secret n'est dans le diff
git diff --cached | grep -i "password\|secret\|token\|key\|api"

# En cas de fuite accidentelle :
# 1. Ne pas push → amender le commit
# 2. Si déjà pushé → contacter GitHub support
#    (un rebase force-push ne suffit pas, le commit reste accessible)
```
