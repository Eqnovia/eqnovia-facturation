# ☁️ Synchronisation en ligne avec Supabase

Les données (clients, fournisseurs, services, factures, devis, commandes,
livraisons, pro forma) peuvent être **enregistrées en ligne et visibles par
tous les utilisateurs et appareils**, gratuitement, grâce à **Supabase**
(PostgreSQL hébergé).

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
-- Table de synchronisation Eqnovia (collections : clients, factures, ...)
create table if not exists public.eqnovia_data (
  key text primary key,
  data jsonb not null
);

-- Table dédiée aux pièces jointes volumineuses (PDF / images lourdes)
-- id = storeKey de la pièce, data = contenu base64
create table if not exists public.eqnovia_attachments (
  id text primary key,
  data text not null,
  nom text,
  type text,
  updated_at timestamptz default now()
);

-- Autoriser l'accès public (lecture/écriture) pour tous les utilisateurs
alter table public.eqnovia_data enable row level security;
alter table public.eqnovia_attachments enable row level security;

create policy "public read" on public.eqnovia_data
  for select using (true);

create policy "public insert" on public.eqnovia_data
  for insert with check (true);

create policy "public update" on public.eqnovia_data
  for update using (true);

create policy "public delete" on public.eqnovia_data
  for delete using (true);

create policy "public read" on public.eqnovia_attachments
  for select using (true);

create policy "public insert" on public.eqnovia_attachments
  for insert with check (true);

create policy "public update" on public.eqnovia_attachments
  for update using (true);

create policy "public delete" on public.eqnovia_attachments
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
| **Ouverture de l'app** | Récupère les données du cloud (si le cloud n'est pas vide) + les pièces jointes volumineuses manquantes |
| **Chaque modification** | Envoie automatiquement la collection modifiée (UPSERT) |
| **Ajout / suppression d'une pièce jointe volumineuse** | Envoie / supprime le fichier dans la table `eqnovia_attachments` |
| **Pièce jointe absente sur l'appareil** | Téléchargée depuis le cloud à la demande (ouverture, téléchargement, PDF) puis mise en cache locale |
| **Un autre utilisateur modifie** | L'affichage se met à jour **en temps réel** |
| **Bouton ☁️** | Force une synchronisation manuelle (aller-retour complet, pièces jointes comprises) |

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
  l'application ; les fichiers volumineux sont synchronisés via la table
  dédiée `eqnovia_attachments` (créée à l'étape 3).
- **Pièces jointes volumineuses** : elles restent **aussi** dans le navigateur
  (IndexedDB) : l'application fonctionne hors ligne et se resynchronise.
  Si vous aviez ajouté des pièces jointes volumineuses **avant** de créer la
  table `eqnovia_attachments`, lancez une synchronisation ☁️ manuelle pour les
  envoyer au cloud.
- **Numérotation des références** : la numérotation (F2026-08-001…) reste
  locale à chaque appareil. Si deux utilisateurs créent une facture au même
  moment, les numéros peuvent coïncider. Relancez une synchronisation ☁️
  après coup pour harmoniser.

---

## 🧹 Désactiver la synchronisation

Remettez les valeurs d'exemple dans `js/supabase-config.js`
(url = `https://VOTRE_PROJET.supabase.co`) et rechargez la page :
l'application repasse en mode 100 % local.

---

## 📎 Nouveau : pièces jointes volumineuses dans le cloud

Depuis cette version, les pièces jointes volumineuses (PDF et images lourdes,
stockées localement en IndexedDB) sont **aussi synchronisées dans le cloud**
grâce à la table dédiée `eqnovia_attachments` (créée dans le script SQL de
l'étape 3).

- Chaque appareil envoie ses nouvelles pièces volumineuses automatiquement.
- Une pièce absente sur un appareil est **téléchargée à la demande** (à
  l'ouverture 👁️, au téléchargement ⬇️ ou dans le PDF 📄) puis mise en cache
  locale pour les prochains accès.
- La suppression d'une pièce (ou d'une facture) supprime aussi le fichier du
  cloud.
- Les **petites** pièces jointes (≤ ~1,9 Mo, stockées dans la facture) restent
  synchronisées avec le reste des données, comme avant.
