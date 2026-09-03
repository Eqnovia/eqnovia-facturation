/**
 * AUTH - Gestion de l'authentification (Admin / Visiteur)
 */
const Auth = {
    PASSWORDS: {
        admin: 'eqnovia-admin-2026',
        comptable: 'eqnovia-comptable-2026',
        visitor: 'eqnovia-visitor'
    },

    togglePassword() {
        const input = document.getElementById('login-password');
        const btn = input?.nextElementSibling;
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            if (btn) btn.textContent = '🙈';
        } else {
            input.type = 'password';
            if (btn) btn.textContent = '👁️';
        }
    },

    isLoggedIn() {
        return sessionStorage.getItem('eqnovia_logged_in') === 'true';
    },

    getRole() {
        return sessionStorage.getItem('eqnovia_role') || null;
    },

    login() {
        const role = document.getElementById('login-role')?.value;
        const password = document.getElementById('login-password')?.value;
        const errorEl = document.getElementById('login-error');

        if (!password) {
            errorEl.textContent = 'Veuillez saisir le mot de passe';
            errorEl.style.display = 'block';
            return;
        }

        if (password === this.PASSWORDS[role]) {
            sessionStorage.setItem('eqnovia_logged_in', 'true');
            sessionStorage.setItem('eqnovia_role', role);
            errorEl.style.display = 'none';
            this.showApp(role);
        } else {
            errorEl.textContent = '❌ Mot de passe incorrect';
            errorEl.style.display = 'block';
            document.getElementById('login-password').value = '';
            document.getElementById('login-password').focus();
        }
    },

    logout() {
        sessionStorage.removeItem('eqnovia_logged_in');
        sessionStorage.removeItem('eqnovia_role');
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('login-password').value = '';
        document.getElementById('login-error').style.display = 'none';
    },

    async showApp(role) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';

        const badge = document.getElementById('header-role-badge');
        if (badge) {
            const badges = {
                admin: '<span class="role-badge role-admin">🔑 Admin</span>',
                comptable: '<span class="role-badge role-comptable">📊 Comptable</span>',
                visitor: '<span class="role-badge role-visitor">👁️ Visiteur</span>'
            };
            badge.innerHTML = badges[role] || badges.visitor;
        }

        App.currentRole = role;
        App.applyRole();

        // Initialize app data if not already done
        if (!App._initialized) {
            App._initialized = true;
            try {
                await App.initialiserCloud();
            } catch (e) { /* silent */ }
            App.initialiserDonneesDemo();
            FileStorage.init();
        }
        App.afficherTableauBord();
    }
};

/**
 * APP - Initialisation, navigation et tableau de bord
 */
const App = {
    currentSection: 'dashboard',
    currentRole: 'admin',
    _initialized: false,

    async init() {
        Modal.init();
        this.setupNavigation();

        // Check login status
        if (Auth.isLoggedIn()) {
            Auth.showApp(Auth.getRole());
        } else {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('app-container').style.display = 'none';
        }

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

    /**
     * Apply the current role (admin/visitor) to the UI
     */
    applyRole() {
        const body = document.body;
        body.classList.remove('visitor-mode', 'comptable-mode');

        if (this.currentRole === 'visitor') {
            body.classList.add('visitor-mode');
        } else if (this.currentRole === 'comptable') {
            body.classList.add('comptable-mode');
        }

        // Disable sync button for non-admin roles
        const syncBtn = document.querySelector('[onclick="CloudSync.synchroniser()"]');
        if (syncBtn) syncBtn.disabled = this.currentRole !== 'admin';

        // Show/hide PDF download section on dashboard
        const dlSection = document.getElementById('download-pdf-section');
        if (dlSection) {
            dlSection.style.display = (this.currentRole === 'admin') ? 'none' : 'block';
        }
    },

    /**
     * Check if current user can create/modify documents
     */
    canEdit() {
        return this.currentRole === 'admin';
    },

    /**
     * Check if current user can download PDFs
     */
    canDownloadPdf() {
        return this.currentRole === 'admin' || this.currentRole === 'comptable';
    },

    naviguerVers(section) {
        // Visitor: force dashboard only
        const visitorRestricted = ['factures','devis','commandes','livraisons','proforma','contacts','produits'];
        if (this.currentRole === 'visitor' && visitorRestricted.includes(section)) {
            section = 'dashboard';
        }
        // Comptable: can access documents but not contacts/produits
        const comptableRestricted = ['contacts','produits'];
        if (this.currentRole === 'comptable' && comptableRestricted.includes(section)) {
            section = 'dashboard';
        }

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

/**
 * EXCEL IMPORT - Import Excel files into document lines
 */
const ExcelImport = {
    /**
     * Import an Excel file and return parsed rows
     * @param {Function} callback - called with array of row objects
     */
    importerExcel(callback) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls,.csv';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                if (jsonData.length === 0) {
                    Toast.warning('Le fichier Excel est vide');
                    return;
                }
                callback(jsonData);
            } catch (err) {
                console.error('Erreur import Excel:', err);
                Toast.error('Erreur lors de la lecture du fichier Excel');
            }
        };
        input.click();
    },

    /**
     * Generate HTML for an import button
     */
    getImportButtonHtml(formType) {
        return `<button type="button" class="btn-import-excel" onclick="ExcelImport.importerDansFormulaire('${formType}')" title="Importer des lignes depuis un fichier Excel">📥 Importer Excel</button>`;
    },

    /**
     * Import Excel data into the current form's lines
     */
    importerDansFormulaire(formType) {
        this.importerExcel((rows) => {
            const container = document.getElementById('lines-container');
            if (!container) return;

            // Try to detect columns based on headers
            const keys = Object.keys(rows[0]);
            const designationKey = keys.find(k => /désignation|designation|description|article|produit/i.test(k)) || keys[0];
            const qtyKey = keys.find(k => /quantit|qty|qte|nombre/i.test(k));
            const priceKey = keys.find(k => /prix|price|montant|tarif|pu/i.test(k));
            const tvaKey = keys.find(k => /tva|tax|vat/i.test(k));
            const uniteKey = keys.find(k => /unit|mesure/i.test(k));

            let importedCount = 0;
            rows.forEach(row => {
                const designation = row[designationKey] || '';
                if (!designation) return; // skip empty rows

                const quantite = qtyKey ? (parseFloat(row[qtyKey]) || 1) : 1;
                const prixUnitaire = priceKey ? (parseFloat(row[priceKey]) || 0) : 0;
                const tva = tvaKey ? (parseInt(row[tvaKey]) || 20) : 20;
                const unite = uniteKey ? (row[uniteKey] || 'Pièce') : 'Pièce';

                // Create a new line row
                const row_el = document.createElement('tr');
                row_el.className = 'line-row';
                
                let tvaOptions = '';
                if (formType === 'livraison') {
                    tvaOptions = '';
                } else {
                    tvaOptions = `<select name="tva" class="line-tva">${[0,7,10,14,20].map(v => `<option value="${v}" ${tva==v?'selected':''}>${v}%</option>`).join('')}</select>`;
                }

                // Determine which module's supprimerLigne to call
                const removeFn = {
                    'facture': 'Factures',
                    'devis': 'Devis',
                    'commande': 'Commandes',
                    'proforma': 'ProForma',
                    'livraison': 'Livraisons'
                }[formType] || 'Factures';

                if (formType === 'livraison') {
                    row_el.innerHTML = `<td><input type="text" name="designation" class="line-designation" value="${Utils.escapeHtml(designation)}"></td>
                        <td><input type="number" name="quantite" class="line-qty" value="${quantite}" min="0.01" step="0.01"></td>
                        <td>${Utils.uniteSelectHtml(unite)}</td>
                        <td class="line-total">${Utils.formatMoney(quantite * prixUnitaire)}</td>
                        <td><button type="button" class="remove-line-btn" onclick="${removeFn}.supprimerLigne(this)">×</button></td>`;
                } else {
                    row_el.innerHTML = `<td><input type="text" name="designation" class="line-designation" value="${Utils.escapeHtml(designation)}"></td>
                        ${tvaOptions ? `<td>${tvaOptions}</td>` : ''}
                        <td><input type="number" name="quantite" class="line-qty" value="${quantite}" min="0.01" step="0.01"></td>
                        <td>${Utils.uniteSelectHtml(unite)}</td>
                        <td><input type="number" name="prixUnitaire" class="line-price" value="${prixUnitaire}" min="0" step="0.01"></td>
                        <td class="line-total">${Utils.formatMoney(quantite * prixUnitaire)}</td>
                        <td><button type="button" class="remove-line-btn" onclick="${removeFn}.supprimerLigne(this)">×</button></td>`;
                }
                container.appendChild(row_el);
                importedCount++;
            });

            // Refresh totals
            if (typeof Factures?.actualiserTotaux === 'function') Factures.actualiserTotaux();
            if (typeof Devis?.actualiserTotaux === 'function') Devis.actualiserTotaux();
            if (typeof Commandes?.actualiserTotaux === 'function') Commandes.actualiserTotaux();
            if (typeof ProForma?.actualiserTotaux === 'function') ProForma.actualiserTotaux();

            LineHistory.saveState();
            Toast.success(`${importedCount} ligne(s) importée(s) avec succès`);
        });
    }
};

/**
 * MONTHLY DOWNLOAD - Download database by month
 */
const MonthlyDownload = {
    /**
     * Show the monthly download modal (ZIP export)
     */
    showModal() {
        const now = new Date();
        const months = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                year: d.getFullYear(),
                month: d.getMonth(),
                label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
            });
        }
        const monthOptions = months.map(m => 
            `<option value="${m.year}-${String(m.month + 1).padStart(2, '0')}">${m.label}</option>`
        ).join('');

        Modal.ouvrir('📥 Télécharger la base de données (ZIP)', `
            <div style="padding: 1rem;">
                <p style="margin-bottom: 1rem; color: var(--text-light); font-size: 0.9rem;">Téléchargez un fichier <strong>.zip</strong> compressé contenant vos données organisées par dossier.</p>
                <div class="form-group">
                    <label>Période</label>
                    <select id="download-month" onchange="MonthlyDownload.updatePreview()" style="width: 100%; padding: 0.7rem 1rem; border: 1px solid var(--border-color); border-radius: var(--radius); font-family: inherit; font-size: 0.95rem;">
                        <option value="all">📋 Tout télécharger (toutes les données)</option>
                        <option disabled>──────────────────</option>
                        ${monthOptions}
                    </select>
                </div>
                <div class="form-group" style="margin-top: 1rem;">
                    <label>Documents à inclure</label>
                    <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.5rem;">
                        <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer;"><input type="checkbox" id="dl-factures" checked onchange="MonthlyDownload.updatePreview()"> 📄 Factures</label>
                        <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer;"><input type="checkbox" id="dl-devis" checked onchange="MonthlyDownload.updatePreview()"> 📋 Devis</label>
                        <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer;"><input type="checkbox" id="dl-commandes" checked onchange="MonthlyDownload.updatePreview()"> 🛒 Commandes</label>
                        <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer;"><input type="checkbox" id="dl-livraisons" checked onchange="MonthlyDownload.updatePreview()"> 📦 Livraisons</label>
                        <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer;"><input type="checkbox" id="dl-proforma" checked onchange="MonthlyDownload.updatePreview()"> 📑 Pro Forma</label>
                    </div>
                </div>

                <div id="download-preview" style="margin-top: 1rem; padding: 0.75rem; background: var(--bg-color); border-radius: var(--radius); font-size: 0.85rem; color: var(--text-light);"></div>
                <div class="form-actions">
                    <button class="btn btn-download" onclick="MonthlyDownload.telechargerZIP()">📥 Télécharger ZIP</button>
                    <button class="btn btn-outline" onclick="Modal.fermer()">Annuler</button>
                </div>
            </div>
        `);
        this.updatePreview();
    },

    /** Update preview counters */
    updatePreview() {
        const el = document.getElementById('download-preview');
        if (!el) return;
        const monthValue = document.getElementById('download-month')?.value;
        const isAll = monthValue === 'all';
        const count = (key) => {
            const docs = Database.get(Database.KEYS[key]) || [];
            if (isAll) return docs.length;
            const [y, m] = monthValue.split('-').map(Number);
            return docs.filter(d => {
                if (!d.date) return false;
                const p = String(d.date).split('-');
                return p.length >= 3 && parseInt(p[0]) === y && parseInt(p[1]) === m;
            }).length;
        };
        let total = 0;
        const lines = [];
        if (document.getElementById('dl-factures')?.checked) { const n = count('FACTURES'); total += n; lines.push(`📄 Factures: ${n}`); }
        if (document.getElementById('dl-devis')?.checked) { const n = count('DEVIS'); total += n; lines.push(`📋 Devis: ${n}`); }
        if (document.getElementById('dl-commandes')?.checked) { const n = count('COMMANDES'); total += n; lines.push(`🛒 Commandes: ${n}`); }
        if (document.getElementById('dl-livraisons')?.checked) { const n = count('LIVRAISONS'); total += n; lines.push(`📦 Livraisons: ${n}`); }
        if (document.getElementById('dl-proforma')?.checked) { const n = count('PROFORMA'); total += n; lines.push(`📑 Pro Forma: ${n}`); }

        const periodLabel = isAll ? 'toutes les périodes' : document.getElementById('download-month')?.selectedOptions?.[0]?.text || '';
        el.innerHTML = `<strong>📊 Aperçu (${periodLabel})</strong><br>${lines.join('<br>') || 'Aucun document'}<br><strong>Total: ${total} document(s)</strong>`;
    },

    /** Filter docs by month (timezone-safe) */
    _filterByMonth(docs, year, month) {
        return docs.filter(d => {
            if (!d.date) return false;
            const p = String(d.date).split('-');
            if (p.length < 3) return false;
            return parseInt(p[0]) === year && parseInt(p[1]) - 1 === month;
        });
    },

    /**
     * Download a ZIP file with all selected data organized in folders
     */
    // Store ZIP blob globally so the sync download button can access it
    _pendingZip: null,
    _pendingZipName: null,

    /**
     * Sync function called by the download button's onclick.
     * Creates a temporary <a> element and clicks it — this is a synchronous
     * user gesture so the browser allows the download.
     */
    triggerDownload() {
        if (!this._pendingZip) return;
        const a = document.createElement('a');
        a.href = this._pendingZip;
        a.download = this._pendingZipName || 'Eqnovia.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        Toast.success('✅ Téléchargement démarré !');
    },

    /**
     * Download a ZIP file with all selected data organized in folders.
     * Generates PDFs for every document and bundles them into a ZIP.
     */
    async telechargerZIP() {
        try {
            // --- Pre-flight checks ---
            if (typeof JSZip === 'undefined') {
                return Toast.error('Bibliothèque JSZip non chargée. Vérifiez votre connexion internet.');
            }
            if (typeof PdfExport === 'undefined' || typeof PdfExport.generatePDF !== 'function') {
                return Toast.error('Module PDF non chargé. Rafraîchissez la page.');
            }

            Toast.info('⏳ Préparation du téléchargement...');

            // --- Read month filter ---
            const monthEl = document.getElementById('download-month');
            const monthValue = monthEl ? monthEl.value : 'all';
            const isAll = monthValue === 'all';
            let year, month;
            if (!isAll) {
                const [ys, ms] = monthValue.split('-');
                year = parseInt(ys); month = parseInt(ms) - 1;
            }
            const filter = (docs) => isAll ? [...docs] : this._filterByMonth(docs, year, month);

            // --- Collect documents from checkboxes (modal or dashboard) ---
            const factures = (document.getElementById('dl-factures')?.checked || document.getElementById('dl-pdf-factures')?.checked) ? filter(Database.get(Database.KEYS.FACTURES) || []) : [];
            const devis = (document.getElementById('dl-devis')?.checked || document.getElementById('dl-pdf-devis')?.checked) ? filter(Database.get(Database.KEYS.DEVIS) || []) : [];
            const commandes = (document.getElementById('dl-commandes')?.checked || document.getElementById('dl-pdf-commandes')?.checked) ? filter(Database.get(Database.KEYS.COMMANDES) || []) : [];
            const livraisons = (document.getElementById('dl-livraisons')?.checked || document.getElementById('dl-pdf-livraisons')?.checked) ? filter(Database.get(Database.KEYS.LIVRAISONS) || []) : [];
            const proforma = (document.getElementById('dl-proforma')?.checked || document.getElementById('dl-pdf-proforma')?.checked) ? filter(Database.get(Database.KEYS.PROFORMA) || []) : [];
            const clients = [];
            const fournisseurs = [];

            const totalDocs = factures.length + devis.length + commandes.length + livraisons.length + proforma.length;
            if (totalDocs === 0 && clients.length === 0 && fournisseurs.length === 0) {
                Toast.warning('Aucun document trouvé pour cette période');
                return;
            }

            // --- Close the current modal (if open) before generating ---
            try { Modal.fermer(); } catch(e) {}

            // --- Build ZIP ---
            const zip = new JSZip();
            const periodLabel = isAll ? 'Tout' : `${year}-${String(month + 1).padStart(2, '0')}`;

            zip.file('_meta.json', JSON.stringify({
                exportDate: new Date().toISOString(),
                period: periodLabel,
                application: 'Eqnovia - Système de Facturation',
                version: '1.0'
            }, null, 2));

            const docTypeMap = [
                { data: factures, folder: '01_Factures', pdfType: 'FACTURE', prefix: 'F' },
                { data: devis, folder: '02_Devis', pdfType: 'DEVIS', prefix: 'D' },
                { data: commandes, folder: '03_Commandes', pdfType: 'BON DE COMMANDE', prefix: 'C' },
                { data: livraisons, folder: '04_Livraisons', pdfType: 'BON DE LIVRAISON', prefix: 'L' },
                { data: proforma, folder: '05_ProForma', pdfType: 'FACTURE PRO FORMA', prefix: 'PF' },
            ];

            // --- Generate PDF for each document ---
            let pdfCount = 0;
            let errorCount = 0;
            for (const cat of docTypeMap) {
                if (cat.data.length === 0) continue;
                for (const doc of cat.data) {
                    try {
                        const clientInfo = {
                            nom: doc.clientNom || doc.client || '',
                            adresse: doc.clientAdresse || '',
                            ville: doc.clientVille || '',
                            ice: doc.clientIce || '',
                            rc: doc.clientRC || ''
                        };
                        const totals = {
                            totalHT: doc.totalHT || 0,
                            totalTVA: doc.totalTVA || 0,
                            totalTTC: doc.totalTTC || 0
                        };
                        const pdfData = PdfExport.prepareDocumentData(
                            doc, clientInfo, doc.lignes || [], doc.reference,
                            totals, cat.pdfType
                        );
                        pdfData.attachments = doc.attachments || [];

                        const pdfBlob = await PdfExport.generatePDF(cat.pdfType, pdfData);
                        if (pdfBlob) {
                            zip.file(`${cat.folder}/${doc.reference || cat.prefix + '_' + pdfCount}.pdf`, pdfBlob);
                        } else {
                            zip.file(`${cat.folder}/${doc.reference || 'doc_' + pdfCount}.json`, JSON.stringify(doc, null, 2));
                        }
                        pdfCount++;
                    } catch (e) {
                        console.warn(`[ZIP] Erreur PDF pour ${doc.reference}:`, e.message);
                        zip.file(`${cat.folder}/${doc.reference || 'doc_' + pdfCount}.json`, JSON.stringify(doc, null, 2));
                        errorCount++;
                        pdfCount++;
                    }
                }
            }



            // --- Generate ZIP blob ---
            const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            const filename = `Eqnovia_${periodLabel}.zip`;
            const sizeKB = Math.round(blob.size / 1024);

            // Store blob for the sync download trigger
            // Revoke previous blob if any
            if (this._pendingZip) URL.revokeObjectURL(this._pendingZip);
            this._pendingZip = URL.createObjectURL(blob);
            this._pendingZipName = filename;

            // --- Show modal with download button ---
            // The button uses onclick="MonthlyDownload.triggerDownload()" which is SYNCHRONOUS
            // so the browser allows the download as a direct user gesture.
            const msg = errorCount > 0
                ? `<p style="color:var(--warning-color);font-size:0.85rem;">⚠️ ${errorCount} document(s) n'ont pas pu être convertis en PDF (sauvegardés en JSON)</p>`
                : '';

            Modal.ouvrir('📥 Téléchargement prêt', `
                <div style="padding:1.5rem;text-align:center;">
                    <p style="margin-bottom:0.5rem;font-size:1.1rem;">${totalDocs} document(s) — ${sizeKB} Ko compressé</p>
                    <p style="margin-bottom:1.5rem;font-size:0.85rem;color:var(--text-light);">
                        Fichiers PDF organisés par dossier dans un fichier ZIP
                    </p>
                    ${msg}
                    <button class="btn btn-download" onclick="MonthlyDownload.triggerDownload()" style="padding:0.9rem 2.5rem;font-size:1.1rem;">
                        📥 Télécharger ${filename}
                    </button>
                    <div class="form-actions" style="margin-top:1.5rem;">
                        <button class="btn btn-outline" onclick="MonthlyDownload.cancelDownload();Modal.fermer()">Annuler</button>
                    </div>
                </div>
            `);

        } catch(e) {
            console.error('[ZIP] Erreur téléchargement:', e);
            Toast.error('Erreur lors du téléchargement: ' + e.message);
        }
    },

    /** Cancel pending download and revoke blob URL */
    cancelDownload() {
        if (this._pendingZip) {
            URL.revokeObjectURL(this._pendingZip);
            this._pendingZip = null;
            this._pendingZipName = null;
        }
    },

    /**
     * Show the import modal (single facture or full backup)
     */
    showImportModal() {
        Modal.ouvrir('📤 Importer des données', `
            <div style="padding: 1rem;">
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div style="padding: 1.5rem; border: 2px solid var(--primary-color); border-radius: var(--radius); cursor: pointer; text-align: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(60,65,205,0.05)'" onmouseout="this.style.background='transparent'" onclick="MonthlyDownload.importerFacture()">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">📄</div>
                        <h3 style="margin-bottom: 0.3rem;">Importer une Facture</h3>
                        <p style="color: var(--text-light); font-size: 0.85rem;">Importez un fichier JSON ou ZIP contenant une facture pour l'ajouter à votre base</p>
                    </div>
                    <div style="padding: 1.5rem; border: 2px solid var(--border-color); border-radius: var(--radius); cursor: pointer; text-align: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(60,65,205,0.05)'" onmouseout="this.style.background='transparent'" onclick="MonthlyDownload.importerSauvegarde()">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">📦</div>
                        <h3 style="margin-bottom: 0.3rem;">Importer une sauvegarde complète</h3>
                        <p style="color: var(--text-light); font-size: 0.85rem;">Importez un fichier ZIP ou JSON contenant toutes les données (factures, devis, etc.)</p>
                    </div>
                </div>
                <div class="form-actions" style="margin-top: 1.5rem;">
                    <button class="btn btn-outline" onclick="Modal.fermer()">Annuler</button>
                </div>
            </div>
        `);
    },

    /**
     * Import a single facture from a JSON file or ZIP
     */
    importerFacture() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.zip';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                let facturesData = [];

                if (file.name.endsWith('.zip')) {
                    if (typeof JSZip === 'undefined') return Toast.error('JSZip non chargé');
                    const zip = await JSZip.loadAsync(file);
                    // Look for factures in all folders
                    for (const [path, zipEntry] of Object.entries(zip.files)) {
                        if (zipEntry.dir) continue;
                        if (path.toLowerCase().includes('facture') && path.endsWith('.json')) {
                            const text = await zipEntry.async('string');
                            const data = JSON.parse(text);
                            if (Array.isArray(data)) facturesData.push(...data);
                            else if (data) facturesData.push(data);
                        }
                    }
                } else {
                    // Plain JSON file
                    const text = await file.text();
                    const data = JSON.parse(text);
                    if (Array.isArray(data)) facturesData = data;
                    else if (data.factures && Array.isArray(data.factures)) facturesData = data.factures;
                    else if (data.reference || data.clientNom) facturesData = [data]; // single facture object
                }

                if (facturesData.length === 0) {
                    return Toast.warning('Aucune facture trouvée dans le fichier');
                }

                const existing = Database.get(Database.KEYS.FACTURES) || [];
                const existingIds = new Set(existing.map(i => String(i.id)));
                let imported = 0, skipped = 0;

                for (const f of facturesData) {
                    if (!f || (!f.reference && !f.clientNom)) continue; // skip invalid
                    if (existingIds.has(String(f.id))) { skipped++; continue; }
                    // Generate new ID to avoid conflicts
                    f.id = Date.now() + Math.floor(Math.random() * 1000);
                    f.importedAt = new Date().toISOString();
                    existing.unshift(f);
                    imported++;
                }

                Database.set(Database.KEYS.FACTURES, existing);

                if (imported === 0) {
                    Toast.info('Aucune nouvelle facture importée (doublons)');
                } else {
                    Toast.success(`📄 ${imported} facture(s) importée(s), ${skipped} doublon(s) ignoré(s)`);
                    App.rafraichirSection();
                }
                Modal.fermer();
            } catch (err) {
                console.error('Erreur import facture:', err);
                Toast.error('Erreur lors de la lecture du fichier');
            }
        };
        input.click();
    },

    /**
     * Import a full backup (ZIP or JSON)
     */
    async importerSauvegarde() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.zip';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                let allData = {};

                if (file.name.endsWith('.zip')) {
                    if (typeof JSZip === 'undefined') return Toast.error('JSZip non chargé');
                    const zip = await JSZip.loadAsync(file);
                    // Parse all JSON files in the ZIP
                    for (const [path, zipEntry] of Object.entries(zip.files)) {
                        if (zipEntry.dir || !path.endsWith('.json') || path.startsWith('_')) continue;
                        const text = await zipEntry.async('string');
                        const data = JSON.parse(text);
                        // Map folder names to data keys
                        if (path.includes('Facture') && Array.isArray(data)) allData.factures = data;
                        else if (path.includes('Devis') && Array.isArray(data)) allData.devis = data;
                        else if (path.includes('Commande') && Array.isArray(data)) allData.commandes = data;
                        else if (path.includes('Livraison') && Array.isArray(data)) allData.livraisons = data;
                        else if (path.includes('ProForma') && Array.isArray(data)) allData.proforma = data;
                        else if (path.includes('client') && Array.isArray(data)) allData.clients = data;
                        else if (path.includes('fournisseur') && Array.isArray(data)) allData.fournisseurs = data;
                    }
                } else {
                    const text = await file.text();
                    allData = JSON.parse(text);
                }

                if (!allData || typeof allData !== 'object') return Toast.error('Fichier invalide');

                const keyMap = {
                    factures: Database.KEYS.FACTURES,
                    devis: Database.KEYS.DEVIS,
                    commandes: Database.KEYS.COMMANDES,
                    livraisons: Database.KEYS.LIVRAISONS,
                    proforma: Database.KEYS.PROFORMA,
                    clients: Database.KEYS.CLIENTS,
                    fournisseurs: Database.KEYS.FOURNISSEURS
                };

                let imported = 0, skipped = 0;
                for (const [jsonKey, dbKey] of Object.entries(keyMap)) {
                    const items = allData[jsonKey];
                    if (!Array.isArray(items) || items.length === 0) continue;
                    const existing = Database.get(dbKey) || [];
                    const existingIds = new Set(existing.map(i => String(i.id)));
                    for (const item of items) {
                        if (existingIds.has(String(item.id))) { skipped++; continue; }
                        existing.push(item);
                    }
                    Database.set(dbKey, existing);
                    imported += items.length;
                }

                if (imported === 0) {
                    Toast.info('Aucun nouvel élément (doublons)');
                } else {
                    Toast.success(`📥 ${imported} élément(s) importé(s), ${skipped} doublon(s)`);
                    App.rafraichirSection();
                }
                Modal.fermer();
            } catch (err) {
                console.error('Erreur import:', err);
                Toast.error('Erreur lors de la lecture du fichier');
            }
        };
        input.click();
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
