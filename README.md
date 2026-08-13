# 📋 Eqnovia Facturation

> Application web complète de facturation : devis, factures, bons de commande, bons de livraison et factures pro forma — avec sauvegarde automatique en local, sur le Bureau et dans le cloud.

---

## 🎯 À propos

**Eqnovia Facturation** est une application **100 % web** (sans installation serveur) qui fonctionne directement dans le navigateur. Elle permet à une entreprise de gérer toute sa chaîne de facturation : création des documents, suivi des paiements, gestion des clients/fournisseurs/produits, export PDF et Excel, le tout avec **3 niveaux de sauvegarde automatique** (navigateur, dossier local, cloud).

---

## 🧭 Comment fonctionne l'application

L'application est organisée en **sections** accessibles depuis la barre de navigation :

| Section | Rôle |
|--------|------|
| 📊 **Tableau de bord** | Statistiques du mois : nombre de factures, devis en attente, chiffre d'affaires, factures impayées, activité récente |
| 📄 **Factures** | Création, modification, paiements (partiels/totaux), verrouillage par mot de passe, pièces jointes |
| 📋 **Devis** | Création et suivi des devis, **conversion en facture** en un clic |
| 🛒 **Commandes** | Bons de commande (clients ou fournisseurs), **conversion en bon de livraison** |
| 🚚 **Livraisons** | Bons de livraison, conversion en facture |
| 📑 **Pro forma** | Factures pro forma, conversion en facture |
| 👥 **Contacts** | Carnet de contacts (clients + fournisseurs) |
| 🏢 **Clients** | Fiche client (ICE, RC, adresse, ville…) |
| 🏭 **Fournisseurs** | Fiche fournisseur |
| 📦 **Produits** | Catalogue des services/produits (prix, TVA, unité) |

### Flux de travail typique

1. **Créer un devis** pour un client → l'envoyer en PDF
2. **Convertir le devis en facture** (les lignes, le client et les totaux sont repris automatiquement)
3. **Suivre les paiements** sur la facture (le statut passe automatiquement de *Impayée* → *Partiellement payée* → *Payée*)
4. **Convertir la facture en bon de livraison ou pro forma** si besoin
5. Consulter le **tableau de bord** pour suivre le chiffre d'affaires et les impayés

### Points clés

- **Numérotation automatique** : chaque document reçoit une référence unique (`F2026-08-001`, `D2026-08-001`, `C2026-08-001`…)
- **Totaux automatiques** : HT, TVA et TTC recalculés en direct sur chaque ligne
- **Pièces jointes** 📎 : photos/PDF sur les factures (compressées automatiquement ; les grosses pièces sont stockées à part en IndexedDB)
- **Protection par mot de passe** 🔒 pour modifier/supprimer une facture
- **Export PDF** (multi-pages, avec cachet et coordonnées bancaires) et **export Excel**
- **Raccourcis** : Ctrl+Z / Ctrl+Shift+Z (annuler/rétablir) dans la saisie des lignes
- **Import de listes** (clients/produits) via `import-liste.js`

---

## 💾 Comment fonctionne la sauvegarde

La sauvegarde se fait à **3 niveaux indépendants**. Si l'un échoue, les autres continuent de fonctionner : aucun document n'est perdu.

### 1️⃣ Sauvegarde locale dans le navigateur (toujours active)

Toutes les données (clients, factures, devis, commandes, fournisseurs, produits, compteurs, société…) sont enregistrées dans le **`localStorage`** du navigateur (module `js/database.js`).

- À chaque création, modification ou suppression, la collection entière est réécrite instantanément.
- Les **pièces jointes volumineuses** (trop lourdes pour le localStorage) sont stockées en **IndexedDB** (`AttachmentStore`) — le document ne garde qu'un identifiant (`storeKey`).

⚠️ **Limite** : ces données sont propres au navigateur et à l'appareil. C'est pourquoi les niveaux 2 et 3 existent.

### 2️⃣ Copies PDF automatiques dans un dossier local (Bureau)

À chaque **création ou modification** d'un document (facture, devis, commande…), une **copie PDF est enregistrée automatiquement** dans un dossier de votre choix (module `FileStorage` dans `js/utils.js`), typiquement sur le **Bureau** :

- Le PDF est généré et placé dans un **sous-dossier par type** : `Factures/`, `Devis/`, `Commandes/`, `Livraisons/`, `Factures Pro Forma/`, `Contacts Clients/`, `Fournisseurs/`.
- La première fois, le navigateur ouvre un **sélecteur de dossier** (API File System Access, Chrome/Edge requis). Le dossier choisi est mémorisé pour les prochaines sessions.
- En cas de succès, un badge **📁** apparaît dans la liste du document.
- Le bouton **📁 Dossier local** de la barre d'outils permet de configurer ou de **reconfigurer** le dossier (le libellé devient « Reconfigurer dossier » une fois actif ; le point vert indique l'état).
- Si l'utilisateur annule le sélecteur, l'application continue normalement : le document est conservé et un message l'invite à le télécharger manuellement.

### 3️⃣ Sauvegarde en ligne (cloud Supabase) — facultative mais recommandée

Le module `CloudSync` (`js/sync.js`) synchronise automatiquement les données avec une base **Supabase (PostgreSQL)** :

- **Chaque modification locale** est envoyée vers le cloud (table `eqnovia_data`, UPSERT, avec un léger délai pour regrouper les écritures).
- **Au démarrage**, les données du cloud sont récupérées si elles existent (`pullAll`).
- **Temps réel** : si un autre utilisateur modifie des données, l'affichage se met à jour automatiquement (`postgres_changes`).
- **Pièces jointes volumineuses** : synchronisées via la table dédiée `eqnovia_attachments` (téléchargées à la demande sur les autres appareils, puis mises en cache).
- **Bouton ☁️ « Cloud »** : force une synchronisation manuelle (aller-retour complet).
- Le point **☁️** de l'en-tête est **vert** si le cloud est configuré et connecté, **rouge** sinon.

> 📖 Guide d'activation complet (gratuit, sans carte bancaire) : voir **`SUPABASE.md`**.

### Résumé : que se passe-t-il quand je crée une facture ?

```
Création de la facture
   │
   ├─ 1. Écriture locale dans le localStorage (instantané)
   ├─ 2. Génération PDF + copie dans le dossier local (Bureau/Factures/) 📁
   └─ 3. Quelques centaines de ms plus tard : envoi vers Supabase ☁️ (si configuré)
```

**Hors ligne ?** Aucun problème : l'application fonctionne en local et resynchronise le cloud dès que la connexion revient.

---

## 🚀 Démarrage rapide

L'application est **statique** : il suffit d'ouvrir le fichier `index.html` dans un navigateur moderne (Chrome ou Edge recommandés — nécessaires pour la sauvegarde dans un dossier local).

```bash
# Option 1 : ouvrir directement
index.html

# Option 2 : serveur local simple
python -m http.server 8080
# puis ouvrir http://localhost:8080
```

### Prérequis

- Navigateur **Chrome** ou **Edge** (pour l'API de sauvegarde dans un dossier local)
- Aucune installation, aucun serveur, aucune base de données à configurer (sauf pour le cloud optionnel)

---

## 📁 Structure du projet

```
eqnovia-facturation/
├── index.html              # Page principale (sections + scripts)
├── css/styles.css          # Styles de l'application
├── js/
│   ├── app.js              # Initialisation, navigation, tableau de bord
│   ├── database.js         # Couche de stockage local (localStorage)
│   ├── utils.js            # FileStorage (dossier local) + AttachmentStore (IndexedDB) + utilitaires
│   ├── pdf-export.js       # Génération des PDF (factures, devis, commandes…)
│   ├── sync.js             # CloudSync — synchronisation Supabase (auto + temps réel)
│   ├── supabase-config.js  # ⚙️ Configuration Supabase (URL + clé)
│   ├── factures.js         # Module Factures
│   ├── devis.js            # Module Devis
│   ├── commandes.js        # Module Bons de commande
│   ├── livraisons.js       # Module Bons de livraison
│   ├── proforma.js         # Module Factures pro forma
│   ├── clients.js          # Module Clients
│   ├── fournisseurs.js     # Module Fournisseurs
│   ├── contacts.js         # Module Contacts
│   ├── produits.js         # Module Produits
│   ├── import-liste.js     # Import de listes
│   └── logo_loader.js      # Chargement du logo
├── cache_loader.js         # Cache base64 du logo
├── SUPABASE.md             # 📖 Guide d'activation du cloud (gratuit)
└── README.md               # Ce fichier
```

---

## 🔗 Liens utiles

- 📌 [Repository GitHub](https://github.com/Eqnovia/eqnovia-facturation)
- 🌐 Site Web: https://eqnovia.github.io/eqnovia-facturation/

---

## 👥 Contribution

Les contributions sont bienvenues ! Pour contribuer :

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

---

## 📄 License

Ce projet est sous license [À définir].

---

<div align="center">

### Fait avec ❤️ par l'équipe Eqnovia

⭐ Si vous trouvez ce projet utile, n'hésitez pas à le mettre en favori !

</div>
