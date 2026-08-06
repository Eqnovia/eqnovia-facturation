/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CLOUDSYNC — Synchronisation Supabase (PostgreSQL en ligne)
 * ─────────────────────────────────────────────────────────────────────────────
 *  Synchronise automatiquement les données locales (localStorage) avec une
 *  base Supabase afin que TOUTES les données soient enregistrées en ligne et
 *  visibles par tous les utilisateurs et appareils.
 *
 *  Modèle de données : une table `eqnovia_data` avec 2 colonnes :
 *    - key  (text, clé primaire) : le nom de la collection locale
 *    - data (jsonb)              : le contenu complet de la collection
 *
 *  Fonctionnement :
 *   • Au démarrage : init() + pullAll() récupèrent les données du cloud.
 *   • À chaque modification locale : la collection est envoyée (push
 *     automatique via UPSERT, avec un léger délai pour regrouper).
 *   • Écoute en temps réel (postgres_changes) : si un autre utilisateur
 *     modifie des données, l'affichage est rafraîchi automatiquement.
 *   • Bouton ☁️ "Synchroniser" : envoie et reçoit manuellement.
 *
 *  Activation : remplir js/supabase-config.js (voir SUPABASE.md).
 * ─────────────────────────────────────────────────────────────────────────────
 */
const CloudSync = {
    enabled: false,
    _initError: null, // 'config' | 'sdk' | 'table' | 'connexion'
    _client: null,
    _applyingRemote: false,
    _pushTimers: {},
    _lastLocalPush: {},
    _channel: null,

    /** La configuration Supabase a-t-elle été réellement remplie ? */
    isConfigured() {
        if (typeof SUPABASE_CONFIG === 'undefined' || !SUPABASE_CONFIG) return false;
        const url = String(SUPABASE_CONFIG.url || '');
        const anonKey = String(SUPABASE_CONFIG.anonKey || '');
        return url.includes('supabase.co') &&
            !url.includes('VOTRE_PROJET') &&
            anonKey.length > 40 &&
            !anonKey.includes('VOTRE_CLE');
    },

    /** Initialise Supabase. Retourne true si activé. */
    async init() {
        this._initError = null;
        if (!this.isConfigured()) {
            this._initError = 'config';
            console.info('☁️ CloudSync : Supabase non configuré — mode local uniquement.');
            this._updateStatus(false);
            return false;
        }
        if (typeof supabase === 'undefined') {
            this._initError = 'sdk';
            console.error('☁️ CloudSync : SDK Supabase non chargé (vérifiez index.html).');
            this._updateStatus(false);
            return false;
        }
        try {
            this._client = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            // Test de connexion : vérifie que la table existe
            const { error } = await this._client.from('eqnovia_data').select('key').limit(1);
            if (error) {
                this._initError = 'table';
                console.error('☁️ CloudSync : la table eqnovia_data est introuvable — exécutez le script SQL (voir SUPABASE.md).', error);
                this._updateStatus(false);
                return false;
            }
            this.enabled = true;
            this._updateStatus(true);
            console.info('☁️ CloudSync : connecté à Supabase (' + SUPABASE_CONFIG.url + ')');
            return true;
        } catch (e) {
            this._initError = 'connexion';
            console.error('☁️ CloudSync : erreur d\'initialisation', e);
            this._updateStatus(false);
            return false;
        }
    },

    // ─── Local → Cloud ───

    /** Planifie un envoi (regroupe les écritures rapprochées). */
    schedulePush(key) {
        if (!this.enabled) return;
        clearTimeout(this._pushTimers[key]);
        this._pushTimers[key] = setTimeout(() => this.pushCollection(key), 400);
    },

    /** Envoie une collection locale vers Supabase (UPSERT complet). */
    async pushCollection(key) {
        if (!this.enabled) return;
        const raw = localStorage.getItem(key);
        if (raw === null) return;
        // Marquer l'envoi AVANT l'await pour fermer la fenêtre de course avec le
        // temps réel (une écriture propre ne doit pas déclencher un re-rendu).
        this._lastLocalPush[key] = Date.now();
        try {
            const data = JSON.parse(raw);
            const { error } = await this._client
                .from('eqnovia_data')
                .upsert({ key, data }, { onConflict: 'key' });
            if (error) throw error;
        } catch (e) {
            console.error('☁️ CloudSync : échec d\'envoi de', key, e);
            Toast.warning('⚠️ Synchronisation impossible pour ' + key + ' (vérifiez votre connexion et la table eqnovia_data)');
        }
    },

    /** Envoie toutes les collections. */
    async pushAll() {
        for (const key of Object.values(Database.KEYS)) {
            await this.pushCollection(key);
        }
    },

    // ─── Cloud → Local ───

    /** Récupère les données du cloud (source de vérité si non vide). */
    async pullAll() {
        if (!this.enabled) return;
        this._applyingRemote = true;
        try {
            const { data, error } = await this._client.from('eqnovia_data').select('*');
            if (error) throw error;
            if (!data || data.length === 0) return; // rien dans le cloud → conserver le local

            data.forEach(row => {
                if (row && row.key && row.data !== undefined && row.data !== null) {
                    localStorage.setItem(row.key, JSON.stringify(row.data));
                }
            });
        } catch (e) {
            console.warn('☁️ CloudSync : lecture du cloud impossible', e);
        } finally {
            this._applyingRemote = false;
        }
    },

    // ─── Temps réel ───

    /** Écoute les changements effectués par les autres utilisateurs. */
    startRealtime() {
        if (!this.enabled || !this._client) return;
        this._channel = this._client
            .channel('eqnovia-sync')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'eqnovia_data' },
                payload => {
                    const key = payload.new?.key || payload.old?.key;
                    if (!key) return;
                    // Ignorer nos propres écritures (rafraîchies autrement)
                    if (Date.now() - (this._lastLocalPush[key] || 0) < 2500) return;
                    try {
                        this._applyingRemote = true;
                        if (payload.eventType === 'DELETE') return; // ne pas supprimer le local
                        if (payload.new && payload.new.data !== undefined) {
                            localStorage.setItem(key, JSON.stringify(payload.new.data));
                        }
                        // Rafraîchir la vue si aucun formulaire n'est ouvert
                        if (!document.getElementById('modal')?.classList.contains('active')) {
                            if (typeof App !== 'undefined' && App.rafraichirSection) {
                                App.rafraichirSection();
                            }
                        }
                    } catch (e) {
                        console.warn('☁️ CloudSync : mise à jour temps réel', key, e);
                    } finally {
                        this._applyingRemote = false;
                    }
                })
            .subscribe();
    },

    // ─── Action manuelle ───

    /** Bouton ☁️ : envoie puis reçoit. */
    async synchroniser() {
        if (!this.enabled) {
            if (this._initError === 'table') {
                Toast.warning('☁️ Table eqnovia_data introuvable : exécutez le script SQL (étape 3 de SUPABASE.md).');
            } else if (this._initError === 'connexion') {
                Toast.error('☁️ Connexion à Supabase impossible : vérifiez l\'URL et la clé dans js/supabase-config.js.');
            } else {
                Toast.warning('☁️ Supabase non configuré. Remplissez js/supabase-config.js (voir SUPABASE.md).');
            }
            return;
        }
        Toast.info('☁️ Synchronisation en cours...');
        await this.pushAll();
        await this.pullAll();
        if (typeof App !== 'undefined' && App.rafraichirSection) App.rafraichirSection();
        Toast.success('☁️ Données synchronisées avec le cloud');
    },

    _updateStatus(ok) {
        const dot = document.getElementById('cloud-status-dot');
        if (dot) {
            dot.className = 'folder-dot ' + (ok ? 'folder-dot-active' : 'folder-dot-inactive');
            dot.title = ok
                ? '☁️ Cloud connecté (Supabase) — données partagées entre tous les utilisateurs'
                : '☁️ Cloud non configuré — mode local uniquement (voir SUPABASE.md)';
        }
    }
};

// Hook : chaque écriture locale déclenche une synchronisation automatique.
// (CloudSync est défini après Database, donc on patche Database.set ici.)
const __dbSetOriginal = Database.set.bind(Database);
Database.set = function (key, data) {
    __dbSetOriginal(key, data);
    if (typeof CloudSync !== 'undefined' && CloudSync.enabled && !CloudSync._applyingRemote) {
        CloudSync.schedulePush(key);
    }
};
