/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CONFIGURATION SUPABASE (PostgreSQL en ligne)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Pour activer la synchronisation en ligne (données visibles par TOUS les
 *  utilisateurs et appareils), remplissez ces 2 valeurs avec celles de VOTRE
 *  projet Supabase. Le tout est GRATUIT et SANS carte bancaire.
 *
 *  Étapes (détaillées dans le fichier SUPABASE.md) :
 *  1. Allez sur https://supabase.com et créez un compte (gratuit, sans carte).
 *  2. Créez un projet (ex : eqnovia-facturation).
 *  3. Dans le menu : Settings (⚙️) → API → copiez le "Project URL" et la
 *     clé "anon public" ci-dessous.
 *  4. Dans SQL Editor, exécutez le script de création de la table
 *     (fourni dans SUPABASE.md, section "Étape 3").
 *  5. Activez le temps réel : Database → Replication → activez la table
 *     eqnovia_data (voir SUPABASE.md).
 *
 *  ⚠️ Tant que url contient "VOTRE_PROJET", la synchronisation est
 *     DÉSACTIVÉE et l'application fonctionne en local (localStorage),
 *     exactement comme avant. L'indicateur ☁️ dans l'en-tête est alors rouge.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const SUPABASE_CONFIG = {
    url: "https://iwwrcisqunylthsizwrf.supabase.co",
    anonKey: "sb_publishable_X-39Gc4hsjaUfMbtShMscQ_RkFAeMlT"
};
