# ☁️ Synchronisation en ligne avec Supabase

Vos données (clients, fournisseurs, services, factures, devis, commandes,
livraisons, pro forma) peuvent être **enregistrées en ligne et visibles par
tous les utilisateurs et appareils**, gratuitement, grâce à **Supabase**
(PostgreSQL hébergé).

✅ **Aucune carte bancaire** — le plan gratuit suffit.
✅ **Temps réel** — les changements des autres utilisateurs apparaissent
automatiquement.
✅ Aucun serveur à installer : l'application communique directement avec
Supabase depuis le navigateur.

---

## 🚀 Activation en 5 étapes (15 minutes)

### Étape 1 — Créer un compte et un projet Supabase

1. Allez sur **https://supabase.com** et cliquez sur **« Start your project »**.
2. Connectez-vous avec **GitHub** ou un **e-mail** (gratuit, sans carte).
3. Cliquez sur **« New project »**.
4. **Name** : tapez `eqnovia-facturation` (ou le nom que vous voulez).
5. **Database Password** : créez un mot de passe et **conservez-le précieusement**
   (il sert uniquement à l'administration de la base).
6. **Region** : choisissez `EU Central` (ou `EU West`) pour l'Europe/le Maroc.
7. Cliquez sur **« Create new project »** et attendez ~2 minutes.

### Étape 2 — Récupérer l'URL et la clé

1. Dans le menu de **gauche**, cliquez sur **⚙️ Settings → API Keys**
   (ou `Project Settings → API Keys`).
2. Copiez deux valeurs :
   - **Project URL** : `https://XXXXXXXX.supabase.co`
   - La clé **publishable** (nouveau format `sb_publishable_...`) ou la clé
     **anon public** (ancien format `eyJhbGciOi...`) — les deux fonctionnent.
3. Collez ces 2 valeurs dans le fichier **`js/supabase-config.js`** :

```js
const SUPABASE_CONFIG = {
    url: "https://XXXXXXXX.supabase.co",
    anonKey: "sb_publishable_xxxxxxxxxxxx"
};
```

### Étape 3 — Créer la table de synchronisation

1. Dans le menu de gauche : **SQL Editor → New query**.
2. Collez le script suivant :

```sql
-- Table de synchronisation Eqnovia
create table if not exists public.eqnovia_data (
  key text primary key,
  data jsonb not null
);

-- Autoriser l'accès public (lecture/écriture) pour tous les utilisateurs
alter table public.eqnovia_data enable row level security;

create policy "public read" on public.eqnovia_data
  for select using (true);

create policy "public insert" on public.eqnovia_data
  for insert with check (true);

create policy "public update" on public.eqnovia_data
  for update using (true);

create policy "public delete" on public.eqnovia_data
  for delete using (true);
```

3. Cliquez sur **« Run »**. Vous devez voir « Success. No rows returned ».

### Étape 4 — Activer le temps réel

1. Dans le menu de gauche : **Database → Replication**.
2. Dans la section **Publications**, table `supabase_realtime`, cochez
   **eqnovia_data** (activez INSERT, UPDATE, DELETE).
3. Enregistrez.

### Étape 5 — Recharger l'application

1. Rechargez la page avec **Ctrl + F5**.
2. Le point **☁️** dans l'en-tête doit devenir **vert** : la synchronisation
   est active.
3. Cliquez sur **☁️ Cloud** → « Données synchronisées avec le cloud ».
4. Vérifiez dans Supabase : **Table Editor → eqnovia_data** — vos collections
   (`eqnovia_clients`, `eqnovia_factures`…) apparaissent.

---

## 🔄 Comment ça marche

| Moment | Action |
|--------|--------|
| **Ouverture de l'app** | Récupère les données du cloud (si le cloud n'est pas vide) |
| **Chaque modification** | Envoie automatiquement la collection modifiée (UPSERT) |
| **Un autre utilisateur modifie** | L'affichage se met à jour **en temps réel** |
| **Bouton ☁️** | Force une synchronisation manuelle (aller-retour complet) |

Toutes les données restent **aussi** dans le navigateur (localStorage) :
l'application fonctionne donc même hors ligne, et se resynchronise dès
qu'une connexion revient.

---

## 🔒 Sécurité (optionnel)

Le script ci-dessus autorise la lecture/écriture publique — adapté à une
équipe interne de confiance.

Pour un usage plus sûr, vous pourrez plus tard :
- créer une table `utilisateurs` et exiger un mot de passe,
- restreindre les politiques aux utilisateurs connectés (`auth.uid() = ...`),
- ou utiliser l'**authentification Supabase** (e-mail/Google) dans
  l'application.

---

## ⚠️ Limites connues

- **Taille** : Supabase stocke les données sans limite de taille par document
  (contrairement à Firestore). Les pièces jointes sont déjà compressées par
  l'application.
- **Numérotation des références** : la numérotation (F2026-08-001…) reste
  locale à chaque appareil. Si deux utilisateurs créent une facture au même
  moment, les numéros peuvent coïncider. Relancez une synchronisation ☁️
  après coup pour harmoniser.

---

## 🧹 Désactiver la synchronisation

Remettez les valeurs d'exemple dans `js/supabase-config.js`
(url = `https://VOTRE_PROJET.supabase.co`) et rechargez la page :
l'application repasse en mode 100 % local.
