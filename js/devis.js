/**
 * DEVIS - Gestion des devis
 */
const Devis = {
    KEY: Database.KEYS.DEVIS,
    docType: 'DEVIS',
    dbNumberType: 'devis',

    getAll() { return Database.get(this.KEY) || []; },
    getById(id) { return Database.findById(this.KEY, id); },
    ajouter(data) { data.reference = Database.getNextNumber(this.dbNumberType); return Database.add(this.KEY, data); },
    modifier(id, data) { return Database.update(this.KEY, id, data); },

    supprimer(id) {
        Database.delete(this.KEY, id);
        this.afficher();
        Toast.success('Devis supprimé avec succès');
    },

    afficher() {
        const devis = this.getAll();
        const filter = (document.getElementById('filter-devis')?.value || '').toLowerCase();
        const filtered = devis.filter(d => (d.reference || '').toLowerCase().includes(filter) || (d.clientNom || '').toLowerCase().includes(filter));

        const container = document.getElementById('devis-list');
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">Aucun devis trouvé</div>';
            return;
        }

        let html = `<table class="data-table"><thead><tr><th>Réf.</th><th>Client</th><th>Date</th><th>Total TTC</th><th>Statut</th><th>Actions</th></tr></thead><tbody>`;
        filtered.forEach(d => {
            html += `<tr>
                <td><strong>${Utils.escapeHtml(d.reference || '')}</strong></td>
                <td>${Utils.escapeHtml(d.clientNom || '')}</td>
                <td>${Utils.formatDate(d.date)}</td>
                <td>${Utils.formatMoney(d.totalTTC || 0)}</td>
                <td><span class="status-badge status-attente">${d.statut || 'En attente'}</span></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="Devis.voir(${d.id})">👁️</button>
                    <button class="btn btn-sm btn-success" onclick="Devis.exportPDF(${d.id})">📄</button>
                    <button class="btn btn-sm btn-warning" onclick="Devis.exportExcel(${d.id})">📊</button>
                    <button class="btn btn-sm btn-primary" onclick="Devis.convertirFacture(${d.id})">📋</button>
                    <button class="btn btn-sm btn-danger" onclick="Devis.supprimer(${d.id})">🗑️</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    },

    nouveau() {
        Modal.ouvrir('Nouveau Devis', this.getFormHtml());
    },

    voir(id) {
        const d = this.getById(id);
        if (!d) return Toast.error('Devis introuvable');
        let linesHtml = '';
        (d.lignes || []).forEach(l => {
            linesHtml += `<tr><td>${Utils.escapeHtml(l.designation || '')}</td><td>${l.tva || 0}%</td><td>${l.quantite || 0}</td><td>${Utils.escapeHtml(l.unite || '')}</td><td style="text-align:right">${Utils.formatMoney(l.prixUnitaire || 0)}</td><td style="text-align:right">${Utils.formatMoney((l.quantite || 0) * (l.prixUnitaire || 0))}</td></tr>`;
        });

        Modal.ouvrir(`Devis ${d.reference}`, `
            <div class="document-preview">
                <div class="preview-header"><div class="preview-company"><h2>Eqnovia</h2><p>${Utils.escapeHtml(d.clientNom || '')}</p></div><div class="preview-title"><h1>DEVIS</h1><p>N°: ${d.reference}</p><p>Date: ${Utils.formatDate(d.date)}</p><span class="status-badge status-attente">En attente</span></div></div>
                <div class="preview-info"><div class="preview-client"><h3>Client</h3><p>${Utils.escapeHtml(d.clientNom || '')}</p><p>${Utils.escapeHtml(d.clientAdresse || '')}</p></div><div class="preview-details"><h3>Détails</h3><p>Total HT: ${Utils.formatMoney(d.totalHT || 0)}</p><p>TVA: ${Utils.formatMoney(d.totalTVA || 0)}</p><p><strong>Total TTC: ${Utils.formatMoney(d.totalTTC || 0)}</strong></p></div></div>
                <table class="lines-table"><thead><tr><th>Désignation</th><th>TVA</th><th>Qté</th><th>Unité</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody>${linesHtml}</tbody></table>
                <div class="form-actions">
                    <button class="btn btn-success" onclick="Devis.exportPDF(${d.id})">📄 PDF</button>
                    <button class="btn btn-warning" onclick="Devis.exportExcel(${d.id})">📊 Excel</button>
                    <button class="btn btn-primary" onclick="Devis.convertirFacture(${d.id})">📋 Convertir en Facture</button>
                    <button class="btn btn-outline" onclick="Modal.fermer()">Fermer</button>
                </div>
            </div>
        `);
    },

    getFormHtml(doc) {
        const d = doc || {};
        const clients = Clients.getAll();
        const lignes = d.lignes || [{ designation: '', quantite: 1, prixUnitaire: 0, tva: 20, unite: 'Pièce' }];
        let linesHtml = '';
        lignes.forEach((l, i) => {
            linesHtml += `<tr class="line-row"><td><input type="text" name="designation" class="line-designation" value="${Utils.escapeHtml(l.designation || '')}"></td>
                <td><select name="tva" class="line-tva">${[0,7,10,14,20].map(v => `<option value="${v}" ${(l.tva||0)==v?'selected':''}>${v}%</option>`).join('')}</select></td>
                <td><input type="number" name="quantite" class="line-qty" value="${l.quantite || 1}" min="0.01" step="0.01"></td>
                <td><select name="unite" class="line-unite">${['Pièce','Heure','Jour','Forfait','Unité'].map(u => `<option value="${u}" ${l.unite==u?'selected':''}>${u}</option>`).join('')}</select></td>
                <td><input type="number" name="prixUnitaire" class="line-price" value="${l.prixUnitaire || 0}" min="0" step="0.01"></td>
                <td class="line-total">${Utils.formatMoney((l.quantite||0)*(l.prixUnitaire||0))}</td>
                <td><button type="button" class="remove-line-btn" onclick="Devis.supprimerLigne(this)">×</button></td></tr>`;
        });

        return `
            <form id="devis-form" onsubmit="return Devis.sauvegarder(event)">
                <input type="hidden" name="id" value="${d.id || ''}">
                <div class="form-row">
                    <div class="form-group"><label>Client *</label>
                        <select name="clientId" required><option value="">Sélectionner un client</option>${clients.map(c => `<option value="${c.id}" ${d.clientId==c.id?'selected':''}>${Utils.escapeHtml(c.nom||c.raisonSociale||'')}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Date</label><input type="date" name="date" value="${Utils.formatDateInput(d.date||new Date())}"></div>
                </div>
                <div class="form-group"><label>Objet</label><input type="text" name="objet" value="${Utils.escapeHtml(d.objet||'')}"></div>
                <div class="document-lines">
                    <h4>Lignes du devis</h4>
                    <table class="lines-table"><thead><tr><th class="col-designation">Désignation</th><th class="col-tva">TVA</th><th class="col-qty">Qté</th><th class="col-unit">Unité</th><th class="col-price">Prix unit.</th><th class="col-total">Total</th><th class="col-actions"></th></tr></thead>
                        <tbody id="lines-container">${linesHtml}</tbody></table>
                    <button type="button" class="add-line-btn" onclick="Devis.ajouterLigne()">+ Ajouter une ligne</button>
                </div>
                <div class="document-totals"><table class="totals-table"><tr><td class="label">Total HT</td><td class="value" id="total-ht">0,00 Dhs</td></tr><tr><td class="label">Total TVA</td><td class="value" id="total-tva">0,00 Dhs</td></tr><tr><td class="label">Total TTC</td><td class="value total-ttc" id="total-ttc">0,00 Dhs</td></tr></table></div>
                <div class="form-actions"><button type="submit" class="btn btn-primary">💾 Enregistrer</button><button type="button" class="btn btn-outline" onclick="Modal.fermer()">Annuler</button></div>
            </form>`;
    },

    ajouterLigne() {
        const container = document.getElementById('lines-container');
        const row = document.createElement('tr'); row.className = 'line-row';
        row.innerHTML = `<td><input type="text" name="designation" class="line-designation" placeholder="Désignation"></td>
            <td><select name="tva" class="line-tva">${[0,7,10,14,20].map(v => `<option value="${v}" ${v==20?'selected':''}>${v}%</option>`).join('')}</select></td>
            <td><input type="number" name="quantite" class="line-qty" value="1" min="0.01" step="0.01"></td>
            <td><select name="unite" class="line-unite">${['Pièce','Heure','Jour','Forfait','Unité'].map(u => `<option value="${u}">${u}</option>`).join('')}</select></td>
            <td><input type="number" name="prixUnitaire" class="line-price" value="0" min="0" step="0.01"></td>
            <td class="line-total">0,00 Dhs</td>
            <td><button type="button" class="remove-line-btn" onclick="Devis.supprimerLigne(this)">×</button></td>`;
        container.appendChild(row);
        this.actualiserTotaux();
    },

    supprimerLigne(btn) { const row = btn.closest('tr'); if (document.querySelectorAll('.line-row').length > 1) { row.remove(); this.actualiserTotaux(); } },

    actualiserTotaux() {
        const rows = document.querySelectorAll('.line-row');
        let totalHT = 0, totalTVA = 0;
        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.line-qty')?.value) || 0;
            const price = parseFloat(row.querySelector('.line-price')?.value) || 0;
            const tva = parseFloat(row.querySelector('.line-tva')?.value) || 0;
            const lineTotal = qty * price;
            totalHT += lineTotal;
            totalTVA += lineTotal * tva / 100;
            const totalEl = row.querySelector('.line-total');
            if (totalEl) totalEl.textContent = Utils.formatMoney(lineTotal);
        });
        document.getElementById('total-ht').textContent = Utils.formatMoney(totalHT);
        document.getElementById('total-tva').textContent = Utils.formatMoney(totalTVA);
        document.getElementById('total-ttc').textContent = Utils.formatMoney(totalHT + totalTVA);
    },

    sauvegarder(event) {
        event.preventDefault();
        const form = document.getElementById('devis-form');
        const data = new FormData(form);
        const clientId = parseInt(data.get('clientId'));
        const client = Clients.getById(clientId);
        if (!client) return Toast.error('Veuillez sélectionner un client');

        const lignes = [];
        document.querySelectorAll('.line-row').forEach(row => {
            lignes.push({
                designation: row.querySelector('.line-designation')?.value || '',
                quantite: parseFloat(row.querySelector('.line-qty')?.value) || 0,
                prixUnitaire: parseFloat(row.querySelector('.line-price')?.value) || 0,
                tva: parseInt(row.querySelector('.line-tva')?.value) || 0,
                unite: row.querySelector('.line-unite')?.value || 'Pièce'
            });
        });

        const totals = Utils.calculateTotals(lignes);
        const docData = {
            clientId, clientNom: client.nom || client.raisonSociale || '', clientAdresse: client.adresse || '', clientVille: client.ville || '', clientIce: client.ice || '', clientRC: client.rc || '',
            date: data.get('date') || new Date().toISOString().split('T')[0],
            objet: data.get('objet') || '',
            lignes, totalHT: totals.totalHT, totalTVA: totals.totalTVA, totalTTC: totals.totalTTC, statut: 'En attente'
        };

        const id = data.get('id');
        if (id) { this.modifier(parseInt(id), docData); Toast.success('Devis modifié avec succès'); }
        else { const saved = this.ajouter(docData); Toast.success(`Devis ${saved.reference} créé avec succès`); }

        Modal.fermer();
        this.afficher();
        return false;
    },

    filtrer() { this.afficher(); },

    async exportPDF(id) {
        const doc = this.getById(id);
        if (!doc) return Toast.error('Devis introuvable');
        const data = PdfExport.prepareDocumentData(doc, { nom: doc.clientNom, adresse: doc.clientAdresse, ville: doc.clientVille, ice: doc.clientIce, rc: doc.clientRC }, doc.lignes, doc.reference, { totalHT: doc.totalHT, totalTVA: doc.totalTVA, totalTTC: doc.totalTTC }, 'DEVIS');
        await PdfExport.downloadPDF('DEVIS', data, `Devis_${doc.reference}.pdf`);
        Toast.success('PDF téléchargé avec succès');
    },

    exportExcel(id) {
        const doc = this.getById(id);
        if (!doc) return Toast.error('Devis introuvable');
        const data = doc.lignes.map(l => ({ 'Désignation': l.designation, 'Quantité': l.quantite, 'Unité': l.unite, 'Prix unitaire HT': l.prixUnitaire, 'TVA %': l.tva, 'Total HT': (l.quantite||0)*(l.prixUnitaire||0), 'Référence': doc.reference, 'Client': doc.clientNom, 'Date': Utils.formatDate(doc.date) }));
        PdfExport.exportToExcel(data, `Devis_${doc.reference}.xlsx`);
        Toast.success('Excel téléchargé avec succès');
    },

    convertirFacture(id) {
        const devis = this.getById(id);
        if (!devis) return Toast.error('Devis introuvable');

        // Copy devis data to new invoice
        const factureData = { ...devis };
        delete factureData.id;
        delete factureData.reference;
        delete factureData.createdAt;
        factureData.statut = 'Impayée';

        const saved = Factures.ajouter(factureData);
        Toast.success(`Devis converti en Facture ${saved.reference}`);
        this.afficher();
    }
};
