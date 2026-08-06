# 📋 Eqnovia Facturation

> Système de facturation moderne et efficace pour gérer vos invoices et transactions commerciales

---

## 🎯 À propos du projet

**Eqnovia Facturation** est une application web complète dédiée à la gestion des factures et de la facturation. Elle offre une interface intuitive et performante pour simplifier votre processus de facturation.

---

## 🛠️ Technologies Utilisées

<div align="center">

| Technologie | Utilisation | Pourcentage |
|:---:|:---:|:---:|
| ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black) | Logique applicative | 74.4% |
| ![HTML5](https://img.shields.io/badge/HTML5-E34C26?style=for-the-badge&logo=html5&logoColor=white) | Structure & Markup | 17.4% |
| ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white) | Styling & Design | 7.2% |

</div>

### Stack Technique Détaillé

```
├── Frontend
│   ├── JavaScript (74.4%)
│   ├── HTML5 (17.4%)
│   └── CSS3 (7.2%)
└── Autres (1%)
```

---

## ✨ Fonctionnalités Principales

- 📄 Création et gestion de factures (avec suivi des paiements 💰)
- 🔀 Conversions entre documents : Devis → Facture, Facture → Pro Forma, Facture → Bon de Livraison
- 🧰 Gestion des services (ex-produits), clients et fournisseurs
- 🔍 Recherche par nom, ville ou ICE
- 💾 Export PDF (multi-pages) et Excel
- 📎 Pièces jointes (photos/PDF) sur les factures
- ☁️ **Synchronisation en ligne** avec Supabase (données visibles par tous les utilisateurs, sans carte bancaire) — voir `SUPABASE.md`
- 📊 Rapports et statistiques
- 🎨 Interface utilisateur moderne et responsive
- 📱 Compatible mobile

---

## 🚀 Démarrage Rapide

### Prérequis

- Node.js (v14 ou supérieur)
- npm ou yarn

### Installation

```bash
# Cloner le repository
git clone https://github.com/Eqnovia/eqnovia-facturation.git

# Accéder au dossier du projet
cd eqnovia-facturation

# Installer les dépendances
npm install

# Démarrer l'application
npm start
```

---

## 📖 Documentation

### Structure du Projet

```
eqnovia-facturation/
├── index.html              # Page principale
├── css/                    # Fichiers de style
├── js/                     # Fichiers JavaScript
│   ├── database.js          # Couche de stockage local (localStorage)
│   ├── supabase-config.js   # ⚙️ Configuration Supabase (à remplir)
│   ├── sync.js              # ☁️ Synchronisation Supabase (auto + temps réel)
│   └── ...
├── assets/                 # Ressources (images, fonts)
├── SUPABASE.md             # 🚀 Guide d'activation du cloud (gratuit)
└── README.md               # Ce fichier
```

### ☁️ Synchronisation en ligne (Supabase)

Pour que vos données soient **enregistrées et visibles par tous les
utilisateurs**, suivez le guide **`SUPABASE.md`** : création du projet
Supabase (gratuit, sans carte bancaire), copie de l'URL et de la clé dans
`js/supabase-config.js`, création de la table `eqnovia_data` (script SQL
fourni) et activation du temps réel. Une fois configuré, le point ☁️ de
l'en-tête devient vert et toutes les données se synchronisent
automatiquement et en temps réel entre les appareils.

---

## 🔗 Liens Utiles

- 📌 [Repository GitHub](https://github.com/Eqnovia/eqnovia-facturation)
- 📧 Support: [À configurer]
- 🌐 Site Web: [À configurer]

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

Ce projet est sous license [À définir]. Voir le fichier `LICENSE` pour plus de détails.

---

## 📞 Contact

**Eqnovia Facturation** - [@Eqnovia](https://github.com/Eqnovia)

---

<div align="center">

### Fait avec ❤️ par l'équipe Eqnovia

⭐ Si vous trouvez ce projet utile, n'hésitez pas à le mettre en favori !

</div>
