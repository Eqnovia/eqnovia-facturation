/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CLOUDSYNC — Synchronisation Supabase (PostgreSQL en ligne)
 * ─────────────────────────────────────────────────────────────────────────────
 *  Synchronise automatiquement les données locales (localStorage) avec une
 *  base Supabase afin que TOUTES les données soient enregistrées en ligne et
 *  visibles par tous les utilisateurs et appareils.
 *
 *  Modèle de données : deux tables.
 *    - eqnovia_data (collections) :
 *        key  (text, clé primaire) : le nom de la collection locale
 *        data (jsonb)              : le contenu complet de la collection
 *    - eqnovia_attachments (pièces jointes volumineuses, stockées en IndexedDB) :
 *        id  (text, clé primaire = storeKey de la pièce)
 *        data (text) : contenu base64 du fichier (dataUrl)
 *        nom, type    : métadonnées d'affichage
 *
 *  Fonctionnement :
 *   • Au démarrage : init() + pullAll() récupèrent les données du cloud.
 *   • À chaque modification locale : la collection est envoyée (push
 *     automatique via UPSERT, avec un léger délai pour regrouper).
 *   • Les pièces jointes volumineuses sont poussées/téléchargées vers la table
 *     dédiée ; si une pièce est absente localement, elle est rapatriée depuis
 *     le cloud à la demande (getWithCloud).
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
    ATTACH_TABLE: 'eqnovia_attachments',

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
            // Vérification non bloquante : la table des pièces jointes volumineuses
            // (les collections fonctionnent même si elle est absente)
            try {
                const { error: attErr } = await this._client.from(this.ATTACH_TABLE).select('id').limit(1);
                if (attErr) {
                    console.warn('☁️ CloudSync : table ' + this.ATTACH_TABLE + ' absente — les pièces jointes volumineuses ne seront pas synchronisées. Exécutez le script SQL de l\'étape 3 (SUPABASE.md).');
                }
            } catch (e) { /* silencieux */ }
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

    /** Envoie toutes les collections + les pièces jointes volumineuses. */
    async pushAll() {
        for (const key of Object.values(Database.KEYS)) {
            await this.pushCollection(key);
        }
        await this.pushAllAttachments();
    },

    /** Envoie toutes les pièces jointes volumineuses locales vers le cloud. */
    async pushAllAttachments() {
        if (!this.enabled) return;
        const factures = Database.get(Database.KEYS.FACTURES) || [];
        for (const f of factures) {
            for (const a of (f.attachments || [])) {
                if (!a.storeKey) continue;
                const dataUrl = await AttachmentStore.get(a.storeKey);
                if (dataUrl) {
                    await this.pushAttachment(a.storeKey, dataUrl, { nom: a.nom, type: a.type });
                }
            }
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
            await this.pullAllAttachments();
        } catch (e) {
            console.warn('☁️ CloudSync : lecture du cloud impossible', e);
        } finally {
            this._applyingRemote = false;
        }
    },

    /** Télécharge les pièces jointes volumineuses manquantes (référencées par les factures locales). */
    async pullAllAttachments() {
        if (!this.enabled) return;
        try {
            // Les pièces jointes n'existent que sur les factures
            const keys = new Set();
            (Database.get(Database.KEYS.FACTURES) || []).forEach(f =>
                (f.attachments || []).forEach(a => { if (a.storeKey) keys.add(a.storeKey); })
            );
            if (keys.size === 0) return;
            // Ne télécharger que celles absentes en IndexedDB (évite de retélécharger les gros fichiers)
            const missing = [];
            for (const k of keys) {
                if (!(await AttachmentStore.get(k))) missing.push(k);
            }
            if (missing.length === 0) return;
            const { data, error } = await this._client
                .from(this.ATTACH_TABLE)
                .select('id, data')
                .in('id', missing);
            if (error) throw error;
            for (const row of (data || [])) {
                if (row && row.id && row.data) await AttachmentStore.put(row.id, row.data);
            }
        } catch (e) {
            console.warn('☁️ CloudSync : lecture des pièces jointes impossible', e);
        }
    },

    // ─── Pièces jointes volumineuses (table dédiée) ───
    // Les petites pièces (dataUrl dans le document) sont synchronisées avec la
    // collection eqnovia_factures. Les volumineuses (IndexedDB) utilisent la
    // table eqnovia_attachments : id = storeKey, data = dataUrl base64.

    /** Envoie une pièce jointe volumineuse vers le cloud. */
    async pushAttachment(storeKey, dataUrl, meta = {}) {
        if (!this.enabled || !storeKey || !dataUrl) return;
        try {
            const { error } = await this._client
                .from(this.ATTACH_TABLE)
                .upsert({
                    id: storeKey,
                    data: dataUrl,
                    nom: meta.nom || null,
                    type: meta.type || null
                }, { onConflict: 'id' });
            if (error) throw error;
        } catch (e) {
            console.error('☁️ CloudSync : échec d\'envoi de la pièce jointe', storeKey, e);
            Toast.warning('⚠️ Synchronisation de la pièce jointe impossible (connexion ou table ' + this.ATTACH_TABLE + ' manquante — voir SUPABASE.md)');
        }
    },

    /** Supprime une pièce jointe volumineuse du cloud. */
    async deleteAttachment(storeKey) {
        if (!this.enabled || !storeKey) return;
        try {
            const { error } = await this._client
                .from(this.ATTACH_TABLE)
                .delete()
                .eq('id', storeKey);
            if (error) throw error;
        } catch (e) {
            console.warn('☁️ CloudSync : suppression cloud de la pièce jointe impossible', storeKey, e);
        }
    },

    /** Récupère une pièce jointe volumineuse depuis le cloud (dataUrl). Retourne null si absente. */
    async fetchAttachment(storeKey) {
        if (!this.enabled || !storeKey) return null;
        try {
            const { data, error } = await this._client
                .from(this.ATTACH_TABLE)
                .select('data')
                .eq('id', storeKey)
                .maybeSingle();
            if (error) throw error;
            return data && data.data ? data.data : null;
        } catch (e) {
            console.warn('☁️ CloudSync : lecture cloud de la pièce jointe impossible', storeKey, e);
            return null;
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
