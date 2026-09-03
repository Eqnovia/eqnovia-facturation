/**
 * FILE STORAGE - Save exported files to local folders on the Desktop
 * Uses the File System Access API (showDirectoryPicker) + IndexedDB persistence
 */
const FileStorage = {
    _rootHandle: null,
    _initialized: false,

    // Mapping between document types and subfolder names
    FOLDER_MAP: {
        'FACTURE': 'Factures',
        'DEVIS': 'Devis',
        'BON DE COMMANDE': 'Commandes',
        'BON DE LIVRAISON': 'Livraisons',
        'FACTURE PRO FORMA': 'Factures Pro Forma',
        'CLIENT': 'Contacts Clients',
        'FOURNISSEUR': 'Fournisseurs'
    },

    /**
     * Initialize: try to load a previously saved directory handle from IndexedDB
     */
    async init() {
        const handle = await this._loadHandle();
        if (handle) {
            try {
                // Verify the handle is still valid
                const permission = await handle.queryPermission({ mode: 'readwrite' });
                if (permission === 'granted') {
                    this._rootHandle = handle;
                    this._initialized = true;
                } else {
                    // Try to request permission again
                    const result = await handle.requestPermission({ mode: 'readwrite' });
                    if (result === 'granted') {
                        this._rootHandle = handle;
                        this._initialized = true;
                    }
                }
            } catch (e) {
                console.warn('FileStorage: handle invalide, reconfiguration nécessaire');
            }
        }
        this._updateStatusDot();
    },

    /**
     * Reconfigurer le dossier de sauvegarde depuis la barre d'outils :
     * réinitialise l'éventuel refus de session puis ouvre le sélecteur de dossier.
     */
    async reconfigurerDossier() {
        this._demandeRefusee = false;
        return this.setupFolder();
    },

    /**
     * Open directory picker and let the user select or create the "Facturation Eqnovia" folder
     */
    async setupFolder() {
        if (!window.showDirectoryPicker) {
            Toast.error('Votre navigateur ne supporte pas la sauvegarde locale. Utilisez Chrome ou Edge.');
            return false;
        }

        try {
            this._rootHandle = await window.showDirectoryPicker({
                id: 'eqnovia-facturation',
                mode: 'readwrite',
                startIn: 'desktop'
            });

            // Request write permission
            const permission = await this._rootHandle.queryPermission({ mode: 'readwrite' });
            if (permission !== 'granted') {
                const result = await this._rootHandle.requestPermission({ mode: 'readwrite' });
                if (result !== 'granted') {
                    Toast.error('Permission refusée pour le dossier');
                    return false;
                }
            }

            // Save the handle for future sessions
            await this._saveHandle(this._rootHandle);
            this._initialized = true;
            this._updateStatusDot();
            Toast.success('✅ Dossier configuré ! Les copies seront sauvegardées automatiquement.');
            return true;
        } catch (e) {
            if (e.name !== 'AbortError' && e.name !== 'SecurityError') {
                console.error('Erreur configuration dossier:', e);
                Toast.error('Erreur lors de la configuration du dossier');
            }
            return false;
        }
    },

    /**
     * S'assure qu'un dossier de sauvegarde est configuré :
     * - si déjà configuré → true immédiat ;
     * - sinon ouvre le sélecteur de dossier (démarrant sur le Bureau) pour
     *   créer/choisir un dossier. IMPORTANT : doit être appelé pendant une
     *   action utilisateur (avant toute génération PDF asynchrone).
     * @returns {Promise<boolean>} true si un dossier est prêt
     */
    async assurerDossier() {
        if (this.isReady()) return true;
        // Si l'utilisateur a déjà refusé/annulé pendant cette session, on ne redemande pas
        if (this._demandeRefusee) return false;
        if (!window.showDirectoryPicker) return false;

        try {
            this._rootHandle = await window.showDirectoryPicker({
                id: 'eqnovia-facturation',
                mode: 'readwrite',
                startIn: 'desktop'
            });

            const permission = await this._rootHandle.queryPermission({ mode: 'readwrite' });
            if (permission !== 'granted') {
                const result = await this._rootHandle.requestPermission({ mode: 'readwrite' });
                if (result !== 'granted') {
                    this._demandeRefusee = true;
                    return false;
                }
            }

            await this._saveHandle(this._rootHandle);
            this._initialized = true;
            this._updateStatusDot();
            Toast.success('✅ Dossier configuré ! Les copies seront sauvegardées automatiquement.');
            return true;
        } catch (e) {
            // Annulation ou erreur : on ne redemande plus pendant cette session
            this._demandeRefusee = true;
            if (e.name !== 'AbortError' && e.name !== 'SecurityError') {
                console.error('Erreur configuration dossier:', e);
            }
            return false;
        }
    },

    /**
     * Save a blob (PDF or Excel) to the appropriate subfolder
     */
    async saveFile(blob, docType, filename) {
        if (!this._initialized || !this._rootHandle) {
            await this.init();
            if (!this._initialized) return false;
        }

        try {
            // Re-verify permission (may have been revoked)
            const permission = await this._rootHandle.queryPermission({ mode: 'readwrite' });
            if (permission !== 'granted') {
                const result = await this._rootHandle.requestPermission({ mode: 'readwrite' });
                if (result !== 'granted') {
                    this._initialized = false;
                    Toast.warning('⚠️ Permission perdue. Reconfigurez le dossier.');
                    return false;
                }
            }

            // Determine the subfolder
            const folderName = this.FOLDER_MAP[docType];
            if (!folderName) {
                console.warn('FileStorage: type de document inconnu:', docType);
                return false;
            }

            // Get or create the subfolder
            let subFolderHandle;
            try {
                subFolderHandle = await this._rootHandle.getDirectoryHandle(folderName, { create: true });
            } catch (e) {
                console.error('FileStorage: impossible de créer le dossier', folderName, e);
                return false;
            }

            // Create the file (overwrite if exists)
            const fileHandle = await subFolderHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable({ keepExistingData: false });
            await writable.write(blob);
            await writable.close();

            return true;
        } catch (e) {
            console.error('FileStorage: erreur sauvegarde fichier:', e);
            return false;
        }
    },

    /**
     * Check if the storage is configured and ready
     */
    isReady() {
        return this._initialized;
    },

    /**
     * Update the status indicator dot AND the toolbar button label in the header
     */
    _updateStatusDot() {
        const dot = document.getElementById('folder-status-dot');
        if (dot) {
            dot.className = 'folder-dot ' + (this._initialized ? 'folder-dot-active' : 'folder-dot-inactive');
            dot.title = this._initialized ? '✅ Dossier configuré - Les PDF sont sauvegardés automatiquement' : '❌ Dossier non configuré';
        }
        // Le bouton de la barre d'outils change de libellé selon l'état
        const btn = document.getElementById('folder-config-btn');
        if (btn) {
            btn.title = this._initialized
                ? 'Changer le dossier de sauvegarde (reconfigurer)'
                : 'Configurer le dossier de sauvegarde sur le Bureau';
            const label = btn.querySelector('.folder-config-label');
            if (label) {
                label.textContent = this._initialized ? 'Reconfigurer dossier' : 'Dossier local';
            }
        }
    },

    // ─── IndexedDB persistence ───

    _getDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('EqnoviaFileStorage', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('handles')) {
                    db.createObjectStore('handles');
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async _saveHandle(handle) {
        try {
            const db = await this._getDB();
            const tx = db.transaction('handles', 'readwrite');
            tx.objectStore('handles').put(handle, 'rootHandle');
            return new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
            });
        } catch (e) {
            console.warn('FileStorage: impossible de sauvegarder le handle:', e);
        }
    },

    async _loadHandle() {
        try {
            const db = await this._getDB();
            const tx = db.transaction('handles', 'readonly');
            const request = tx.objectStore('handles').get('rootHandle');
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    }
};

/**
 * ATTACHMENT STORE - Stockage IndexedDB des pièces jointes volumineuses
 * Le localStorage (limité à ~5 Mo) ne peut pas contenir de gros fichiers en
 * base64. Les pièces jointes volumineuses (PDF ou images lourdes) sont donc
 * stockées ici ; le document ne conserve qu'un identifiant (storeKey).
 * Les petites pièces restent en dataUrl dans le document (affichage + PDF).
 */
const AttachmentStore = {
    DB_NAME: 'EqnoviaAttachments',
    STORE: 'files',

    _getDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE)) {
                    db.createObjectStore(this.STORE);
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    /** Stocke un dataUrl volumineux. Retourne true en cas de succès. */
    async put(key, dataUrl) {
        try {
            const db = await this._getDB();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE, 'readwrite');
                tx.objectStore(this.STORE).put(dataUrl, key);
                tx.oncomplete = () => resolve(true);
                tx.onerror = (e) => reject(e.target.error);
            });
        } catch (e) {
            console.error('AttachmentStore: impossible de stocker la pièce jointe', e);
            return false;
        }
    },

    /** Récupère un dataUrl stocké. Retourne null si absent. */
    async get(key) {
        try {
            const db = await this._getDB();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE, 'readonly');
                const req = tx.objectStore(this.STORE).get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.warn('AttachmentStore: lecture impossible', e);
            return null;
        }
    },

    /**
     * Récupère un dataUrl : d'abord en local (IndexedDB), puis depuis le cloud
     * Supabase si absent (pièce ajoutée par un autre appareil). Le résultat du
     * cloud est mis en cache localement pour les prochains accès.
     */
    async getWithCloud(key) {
        let dataUrl = await this.get(key);
        if (!dataUrl && typeof CloudSync !== 'undefined' && CloudSync.enabled) {
            dataUrl = await CloudSync.fetchAttachment(key);
            if (dataUrl) await this.put(key, dataUrl); // cache local
        }
        return dataUrl;
    },

    /** Supprime un dataUrl stocké. */
    async remove(key) {
        try {
            const db = await this._getDB();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE, 'readwrite');
                tx.objectStore(this.STORE).delete(key);
                tx.oncomplete = () => resolve(true);
                tx.onerror = (e) => reject(e.target.error);
            });
        } catch (e) {
            return false;
        }
    }
};

/**
 * UTILS - Helper functions for formatting, modal, toast, etc.
 */
const Utils = {
    // Format a number as Moroccan Dirham
    formatMoney(amount) {
        return new Intl.NumberFormat('fr-MA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount) + ' Dhs';
    },
    // Format a date for display (dd/mm/yyyy)
    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    },
    // Format a date for <input type="date">
    formatDateInput(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    },
    // Clean a string to be used as a filename
    cleanFileName(name) {
        if (!name) return '';
        return name.trim()
            .replace(/[\\/]/g, '-')
            .replace(/[:*?"<>|]/g, '');
    },
    // Calculate totals for document lines (HT, TVA, TTC)
    calculateTotals(lines) {
        let totalHT = 0, totalTVA = 0;
        lines.forEach(l => {
            const qty = parseFloat(l.quantite) || 0;
            const price = parseFloat(l.prixUnitaire) || 0;
            const tva = parseFloat(l.tva) || 0;
            const lineHT = qty * price;
            const lineTVA = lineHT * (tva / 100);
            totalHT += lineHT;
            totalTVA += lineTVA;
        });
        return { totalHT, totalTVA, totalTTC: totalHT + totalTVA };
    },
    // Simple unique id generator (not cryptographic)
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    // Escape HTML to avoid injection
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    // Read a file as a data URL
    fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
            reader.readAsDataURL(file);
        });
    },
    // Compress an image file into a JPEG data URL (resize + quality) to save storage space
    compressImage(file, maxDim = 1400, quality = 0.75) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = () => reject(new Error('Image invalide'));
                img.src = reader.result;
            };
            reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
            reader.readAsDataURL(file);
        });
    },
    // Ordered unit list for all document lines
    UNITES: ['Unité', 'ml', 'Ens.', 'kg', 'Pièce', 'Jours-homme', 'Heures', 'Forfait', 'Jour'],

    // Auto-incrementing ID counter for datalist elements
    _uniteDatalistCounter: 0,

    /**
     * Generate an <input> with a <datalist> for units.
     * Users can type freely or pick from the dropdown suggestions.
     * @param {string} currentValue - the unit to pre-fill
     * @param {string} nameAttr - the name attribute for the input
     * @returns {string} HTML string
     */
    uniteSelectHtml(currentValue, nameAttr = 'unite') {
        const id = `unite-list-${++this._uniteDatalistCounter}`;
        const val = Utils.escapeHtml(currentValue || '');
        const options = this.UNITES.map(u => `<option value="${u}">`).join('');
        return `<input type="text" list="${id}" name="${nameAttr}" class="line-unite" value="${val}" placeholder="— Choisir —" autocomplete="off" title="Sélectionnez une unité ou saisissez-en une nouvelle">` +
            `<datalist id="${id}">${options}</datalist>`;
    },

    /**
     * Generate an <input> with datalist for units (standalone, for product forms etc.)
     */
    uniteInputHtml(currentValue, nameAttr = 'unite') {
        return this.uniteSelectHtml(currentValue, nameAttr);
    },

    // Format a data-URL length (in chars) as a readable file size (~0.75 bytes per char)
    formatBytes(dataUrlLength) {
        const bytes = Math.round((dataUrlLength || 0) * 0.75);
        if (bytes < 1024) return bytes + ' o';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' Ko';
        return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
    },

    // ─── Protection par mot de passe ───
    /** Mot de passe requis pour modifier / supprimer / déverrouiller une facture. */
    MOT_DE_PASSE: 'eqnovia-2026',

    /**
     * Demande le mot de passe (fenêtre de saisie) pour une action sensible.
     * Retourne true uniquement si la saisie correspond au mot de passe.
     * @param {string} raison Description de l'action (ex: « Modifier la facture F2026-07-009 »)
     */
    verifierMotDePasse(raison) {
        const saisie = prompt(`🔒 Action protégée par mot de passe\n\n${raison}\n\nVeuillez saisir le mot de passe :`);
        if (saisie === null) return false; // annulé
        if (String(saisie).trim() === this.MOT_DE_PASSE) return true;
        Toast.error('❌ Mot de passe incorrect');
        return false;
    }
};

// Modal manager (singleton)
const Modal = {
    element: null,

    init() { this.element = document.getElementById('modal'); },

    ouvrir(title, content) {
        LineHistory.reset();
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = content;
        this.element.classList.add('active');
        // Initialize line history after modal renders
        requestAnimationFrame(() => {
            if (document.getElementById('lines-container')) {
                LineHistory.init();
            }
        });
    },

    fermer() {
        if (LineHistory.isDirty()) {
            if (!confirm('⚠️ Vous êtes sur le point de fermer cette fenêtre.\n\nLes modifications non enregistrées seront perdues.\n\nÊtes-vous sûr de vouloir continuer ?')) {
                return;
            }
        }
        LineHistory.reset();
        this.element.classList.remove('active');
    }
};

// Toast notifications manager
const Toast = {
    show(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-message">${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },
    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    warning(msg) { this.show(msg, 'warning'); },
    info(msg) { this.show(msg, 'info'); }
};

/**
 * LINE HISTORY - Undo/Redo manager for document line entries
 * Captures snapshots of the lines-container innerHTML and allows
 * Ctrl+Z (undo) and Ctrl+Shift+Z (redo) navigation.
 */
const LineHistory = {
    _history: [],
    _currentIndex: -1,
    _containerId: 'lines-container',

    init() {
        this._history = [];
        this._currentIndex = -1;
        this.saveState();
        this._updateButtons();
    },

    saveState() {
        const container = document.getElementById(this._containerId);
        if (!container) return;
        // Remove any future states (if we undid and now make a new change)
        this._history = this._history.slice(0, this._currentIndex + 1);
        this._history.push(container.innerHTML);
        this._currentIndex = this._history.length - 1;
        this._updateButtons();
    },

    undo() {
        if (this._currentIndex > 0) {
            this._currentIndex--;
            this._restore();
            return true;
        }
        return false;
    },

    redo() {
        if (this._currentIndex < this._history.length - 1) {
            this._currentIndex++;
            this._restore();
            return true;
        }
        return false;
    },

    _restore() {
        const container = document.getElementById(this._containerId);
        if (!container || this._currentIndex < 0 || this._currentIndex >= this._history.length) return;
        container.innerHTML = this._history[this._currentIndex];
        this._updateButtons();
        // Recalculate totals after restoring
        this._recalcTotals();
    },

    _recalcTotals() {
        const form = document.querySelector('form[id$="-form"]');
        if (form) {
            const id = form.id;
            if (id === 'facture-form' && typeof Factures?.actualiserTotaux === 'function') Factures.actualiserTotaux();
            else if (id === 'devis-form' && typeof Devis?.actualiserTotaux === 'function') Devis.actualiserTotaux();
            else if (id === 'commande-form' && typeof Commandes?.actualiserTotaux === 'function') Commandes.actualiserTotaux();
            else if (id === 'proforma-form' && typeof ProForma?.actualiserTotaux === 'function') ProForma.actualiserTotaux();
        }
    },

    _updateButtons() {
        const undoBtns = document.querySelectorAll('.undo-lines-btn');
        const redoBtns = document.querySelectorAll('.redo-lines-btn');
        undoBtns.forEach(btn => btn.disabled = !this.canUndo());
        redoBtns.forEach(btn => btn.disabled = !this.canRedo());
    },

    canUndo() {
        return this._currentIndex > 0;
    },

    canRedo() {
        return this._currentIndex < this._history.length - 1;
    },

    isDirty() {
        return this._history.length > 1;
    },

    reset() {
        this._history = [];
        this._currentIndex = -1;
    }
};
