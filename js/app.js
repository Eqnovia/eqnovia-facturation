/**
 * APP - Initialisation, navigation et tableau de bord
 */
const App = {
    currentSection: 'dashboard',

    async init() {
        Modal.init();
        this.setupNavigation();

        // Synchronisation cloud (Supabase) — silencieuse si non configuré
        await this.initialiserCloud();

        this.initialiserDonneesDemo();
        this.afficherTableauBord();
        
        // Initialize FileStorage (restore saved folder handle)
        FileStorage.init();

        // Auto-refresh totals on input change (delegated)
        document.addEventListener('input', (e) => {
            if (e.target.closest('.line-row') && (e.target.classList.contains('line-qty') || e.target.classList.contains('line-price') || e.target.classList.contains('line-tva'))) {
                // Find the active document module
                const modalBody = document.getElementById('modal-body');
                if (modalBody) {
                    const form = modalBody.querySelector('form');
                    if (form) {
                        const id = form.id;
                        if (id === 'facture-form' && typeof Factures?.actualiserTotaux === 'function') Factures.actualiserTotaux();
                        else if (id === 'devis-form' && typeof Devis?.actualiserTotaux === 'function') Devis.actualiserTotaux();
                        else if (id === 'commande-form' && typeof Commandes?.actualiserTotaux === 'function') Commandes.actualiserTotaux();
                        else if (id === 'proforma-form' && typeof ProForma?.actualiserTotaux === 'function') ProForma.actualiserTotaux();
                    }
                }
            }
        });

        // Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo)
        // Only intercept when focus is inside the lines container to avoid
        // blocking native Ctrl+Z in other inputs (client name, date, etc.)
        document.addEventListener('keydown', (e) => {
            const inLinesArea = e.target.closest('.document-lines');
            if (!inLinesArea) return; // let native shortcuts work elsewhere

            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                LineHistory.undo();
            } else if (e.ctrlKey && (e.key === 'Z' || e.key === 'z') && e.shiftKey) {
                e.preventDefault();
                LineHistory.redo();
            } else if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                LineHistory.redo();
            }
        });
    },

    /**
     * Active la synchronisation Supabase (si configurée).
     * Récupère les données du cloud, puis écoute les changements en temps réel.
     */
    async initialiserCloud() {
        try {
            const ok = await CloudSync.init();
            if (!ok) return;
            await CloudSync.pullAll();
            CloudSync.startRealtime();
        } catch (e) {
            console.error('Erreur initialisation cloud:', e);
        }
    },

    /** Re-rend la section actuellement affichée (utilisé par la synchro temps réel). */
    rafraichirSection() {
        this.naviguerVers(this.currentSection);
    },

    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.section;
                this.naviguerVers(section);
            });
        });
    },

    naviguerVers(section) {
        // Update active nav button
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.nav-btn[data-section="${section}"]`)?.classList.add('active');

        // Show section
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(section)?.classList.add('active');

        this.currentSection = section;

        // Refresh data display
        switch (section) {
            case 'dashboard': this.afficherTableauBord(); break;
            case 'factures': Factures.afficher(); break;
            case 'devis': Devis.afficher(); break;
            case 'commandes': Commandes.afficher(); break;
            case 'livraisons': Livraisons.afficher(); break;
            case 'proforma': ProForma.afficher(); break;
            case 'contacts': Contacts.afficher(); break;
            case 'clients': Clients.afficher(); break;
            case 'fournisseurs': Fournisseurs.afficher(); break;
            case 'produits': Produits.afficher(); break;
        }
    },

    afficherTableauBord() {
        const factures = Database.get(Database.KEYS.FACTURES) || [];
        const devis = Database.get(Database.KEYS.DEVIS) || [];
        const commandes = Database.get(Database.KEYS.COMMANDES) || [];
        const clients = Database.get(Database.KEYS.CLIENTS) || [];

        // Calculate stats
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const facturesMois = factures.filter(f => {
            const d = new Date(f.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const caMois = facturesMois.reduce((sum, f) => sum + (f.totalTTC || 0), 0);
        const impayees = factures.filter(f => Factures.getStatutReel(f) !== 'Payée').length;

        document.getElementById('stat-factures').textContent = facturesMois.length;
        document.getElementById('stat-devis').textContent = devis.filter(d => d.statut === 'En attente' || !d.statut).length;
        document.getElementById('stat-ca').textContent = Utils.formatMoney(caMois);
        document.getElementById('stat-impayees').textContent = impayees;

        // Recent activity
        const allDocs = [
            ...factures.map(d => ({ ...d, type: 'Facture', prefix: '📄' })),
            ...devis.map(d => ({ ...d, type: 'Devis', prefix: '📋' })),
            ...commandes.map(d => ({ ...d, type: 'Commande', prefix: '🛒' }))
        ].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
            .slice(0, 10);

        const recentList = document.getElementById('recent-list');
        if (allDocs.length === 0) {
            recentList.innerHTML = '<div class="activity-item">Aucune activité récente</div>';
            return;
        }

        recentList.innerHTML = allDocs.map(d => `
            <div class="activity-item">
                <span class="activity-icon">${d.prefix}</span>
                <div class="activity-info">
                    <strong>${d.type} ${d.reference || ''}</strong>
                    <span>${Utils.escapeHtml(d.clientNom || '')} - ${Utils.formatMoney(d.totalTTC || 0)}</span>
                </div>
                <span class="activity-date">${Utils.formatDate(d.date)}</span>
            </div>
        `).join('');
    },

    initialiserDonneesDemo() {
        // Add demo data if no data exists
        const clients = Database.get(Database.KEYS.CLIENTS);
        let demoClientAkwelId = null;
        if (!clients || clients.length === 0) {
            const akwel = Database.add(Database.KEYS.CLIENTS, {
                nom: 'AKWEL EL JADIDA MOROCCO',
                adresse: 'Zone industrielle El Jadida, lot. 108',
                ville: '24040 El Jadida',
                ice: '000089736000091',
                telephone: '0523 45 67 89',
                email: 'contact@akwel.ma',
                rc: '123456',
                if: '98765432'
            });
            demoClientAkwelId = akwel.id;

            Database.add(Database.KEYS.CLIENTS, {
                nom: 'H&P PROTECTION',
                adresse: '77 rue Mohammed Smiha, étg 10 Apt 57',
                ville: 'Casablanca',
                ice: '003630679000061',
                telephone: '0522 33 44 55',
                email: 'info@hpprotection.ma'
            });

            Database.add(Database.KEYS.FOURNISSEURS, {
                nom: 'Fournisseur Pro SARL',
                ice: '001234567890123',
                adresse: '15 Rue de la Liberté',
                ville: 'Rabat',
                telephone: '0537 66 77 88',
                email: 'contact@fournisseurpro.ma'
            });

            Database.add(Database.KEYS.PRODUITS, {
                designation: 'Audit énergétique',
                reference: 'AUD-001',
                prixUnitaire: 76720,
                tva: 20,
                unite: 'Forfait'
            });

            Database.add(Database.KEYS.PRODUITS, {
                designation: 'Gilet Fluo avec logo',
                reference: 'EPI-001',
                prixUnitaire: 45,
                tva: 20,
                unite: 'Pièce'
            });

            Database.add(Database.KEYS.PRODUITS, {
                designation: 'Casque avec logo',
                reference: 'EPI-002',
                prixUnitaire: 55,
                tva: 20,
                unite: 'Pièce'
            });

            Database.add(Database.KEYS.PRODUITS, {
                designation: 'Gants de sécurité',
                reference: 'EPI-003',
                prixUnitaire: 20,
                tva: 20,
                unite: 'Pièce'
            });

            Database.add(Database.KEYS.PRODUITS, {
                designation: 'Lunette de sécurité',
                reference: 'EPI-004',
                prixUnitaire: 25,
                tva: 20,
                unite: 'Pièce'
            });
        }

        const factures = Database.get(Database.KEYS.FACTURES);
        if (!factures || factures.length === 0) {
            // Add sample invoice (clientId references the real AKWEL client id)
            const demoClient = demoClientAkwelId ? { id: demoClientAkwelId } : (Database.get(Database.KEYS.CLIENTS)?.[0] || null);
            const f = Database.add(Database.KEYS.FACTURES, {
                clientId: demoClient ? demoClient.id : 1,
                clientNom: 'AKWEL EL JADIDA MOROCCO',
                clientAdresse: 'Zone industrielle El Jadida, lot. 108',
                clientVille: '24040 El Jadida',
                clientIce: '000089736000091',
                date: '2026-07-13',
                reference: 'F2026-07-009',
                objet: 'Audit énergétique du site AKWEL - règlement de 70% du montant global HT',
                lignes: [{ designation: 'Audit énergétique du site AKWEL - règlement de 70% du montant global HT', quantite: 1, prixUnitaire: 76720, tva: 20, unite: 'Pièce' }],
                totalHT: 76720,
                totalTVA: 15344,
                totalTTC: 92064,
                statut: 'Impayée'
            });
            // Override counter to match example
            const counters = Database.get(Database.KEYS.COUNTERS);
            counters.facture = 9;
            Database.set(Database.KEYS.COUNTERS, counters);

            // Add sample order (bon de commande fournisseur)
            const demoFournisseur = Database.get(Database.KEYS.FOURNISSEURS)?.[0];
            const demoFournNom = demoFournisseur ? (demoFournisseur.nom || demoFournisseur.raisonSociale || 'Fournisseur Pro SARL') : 'Fournisseur Pro SARL';
            const demoFournAdresse = demoFournisseur ? (demoFournisseur.adresse || '') : '15 Rue de la Liberté';
            const demoFournVille = demoFournisseur ? (demoFournisseur.ville || '') : 'Rabat';
            const demoFournIce = demoFournisseur ? (demoFournisseur.ice || '') : '001234567890123';
            const c = Database.add(Database.KEYS.COMMANDES, {
                type: 'fournisseur',
                clientId: demoFournisseur ? `fournisseur_${demoFournisseur.id}` : 'fournisseur_1',
                clientNom: demoFournNom,
                clientAdresse: demoFournAdresse,
                clientVille: demoFournVille,
                clientIce: demoFournIce,
                fournisseurNom: demoFournNom,
                fournisseurAdresse: demoFournAdresse,
                fournisseurVille: demoFournVille,
                fournisseurIce: demoFournIce,
                date: '2026-06-25',
                reference: 'C2026-06-016',
                objet: '',
                lignes: [
                    { designation: 'Gilet Fluo avec logo eqnovia', quantite: 20, prixUnitaire: 45, tva: 20, unite: 'Pièce' },
                    { designation: 'Casque avec logo eqnovia', quantite: 5, prixUnitaire: 55, tva: 20, unite: 'Pièce' },
                    { designation: 'Gants de sécurité', quantite: 5, prixUnitaire: 20, tva: 20, unite: 'Pièce' },
                    { designation: 'Lunette de sécurité', quantite: 5, prixUnitaire: 25, tva: 20, unite: 'Pièce' }
                ],
                totalHT: 1400,
                totalTVA: 280,
                totalTTC: 1680,
                statut: 'En cours'
            });
            const counters2 = Database.get(Database.KEYS.COUNTERS);
            counters2.commande = 16;
            Database.set(Database.KEYS.COUNTERS, counters2);
        }
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
