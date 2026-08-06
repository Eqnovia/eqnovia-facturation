/**
 * DATABASE - Gestion du LocalStorage
 */
const Database = {
    KEYS: {
        CLIENTS: 'eqnovia_clients',
        FOURNISSEURS: 'eqnovia_fournisseurs',
        CONTACTS: 'eqnovia_contacts',
        PRODUITS: 'eqnovia_produits',
        FACTURES: 'eqnovia_factures',
        DEVIS: 'eqnovia_devis',
        COMMANDES: 'eqnovia_commandes',
        LIVRAISONS: 'eqnovia_livraisons',
        PROFORMA: 'eqnovia_proforma',
        COUNTERS: 'eqnovia_counters',
        COMPANY: 'eqnovia_company'
    },
    init() {
        if (!this.get(this.KEYS.COUNTERS)) {
            this.set(this.KEYS.COUNTERS, {
                facture: 0,
                devis: 0,
                commande: 0,
                livraison: 0,
                proforma: 0
            });
        }
        if (!this.get(this.KEYS.COMPANY)) {
            this.set(this.KEYS.COMPANY, {
                nom: 'Eqnovia',
                adresse: '20 rue Moussa Bnou Noussair',
                ville: 'Casablanca',
                website: 'www.eqnovia.ma',
                ice: '001445583000022',
                rc: '236357',
                if: '40397283',
                tp: '35546302',
                capital: '2 000 000 Dhs'
            });
        }
        Object.values(this.KEYS).forEach(key => {
            if (key !== this.KEYS.COUNTERS && key !== this.KEYS.COMPANY && !this.get(key)) {
                this.set(key, []);
            }
        });
    },
    get(key) { const data = localStorage.getItem(key); return data ? JSON.parse(data) : null; },
    set(key, data) { localStorage.setItem(key, JSON.stringify(data)); },
    add(key, item) { const col = this.get(key) || []; item.id = Date.now(); item.createdAt = new Date().toISOString(); col.unshift(item); this.set(key, col); return item; },
    update(key, id, updates) {
        const col = this.get(key) || [];
        const numericId = Number(id);
        const idx = col.findIndex(i => Number(i.id) === numericId);
        if (idx !== -1) {
            col[idx] = { ...col[idx], ...updates, updatedAt: new Date().toISOString() };
            this.set(key, col);
            return col[idx];
        }
        return null;
    },
    delete(key, id) {
        const col = this.get(key) || [];
        const numericId = Number(id);
        this.set(key, col.filter(i => Number(i.id) !== numericId));
    },
    findById(key, id) {
        const col = this.get(key) || [];
        if (id === undefined || id === null || id === '') return null;
        // Compare en tant que chaîne ET en tant que nombre : couvre les ids numériques, chaînes
        // et les très grands nombres (Date.now()) sans perte de précision.
        const stringId = String(id);
        return col.find(i => {
            if (i.id === undefined || i.id === null) return false;
            if (String(i.id) === stringId) return true;
            if (String(i.id).trim() === stringId.trim()) return true;
            // Fallback numérique uniquement si les deux sont des nombres sûrs
            const n1 = Number(i.id), n2 = Number(id);
            return Number.isFinite(n1) && Number.isFinite(n2) && n1 === n2;
        }) || null;
    },
    getNextNumber(type) {
        const counters = this.get(this.KEYS.COUNTERS);
        const today = new Date();
        const annee = today.getFullYear();
        const mois = String(today.getMonth() + 1).padStart(2, '0');
        counters[type]++;
        this.set(this.KEYS.COUNTERS, counters);
        const prefixes = { facture: 'F', devis: 'D', commande: 'C', livraison: 'L', proforma: 'PRO' };
        const prefix = prefixes[type] || 'X';
        const numero = String(counters[type]).padStart(3, '0');
        return `${prefix}${annee}-${mois}-${numero}`;
    }
};
Database.init();
