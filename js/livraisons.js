/**
 * LIVRAISONS - Gestion des bons de livraison
 */
const Livraisons = {
    KEY: Database.KEYS.LIVRAISONS,
    docType: 'BON DE LIVRAISON',
    dbNumberType: 'livraison',

    getAll() { return Database.get(this.KEY) || []; },
    getById(id) { return Database.findById(this.KEY, id); },
    ajouter(data) { data.reference = Database.getNextNumber(this.dbNumberType); return Database.add(this.KEY, data); },
    modifier(id, data) { return Database.update(this.KEY, id, data); },

    supprimer(id) {
        Database.delete(this.KEY, id);
        this.afficher();
        Toast.success('Bon de livraison supprimé avec succès');
    },

    afficher() {
        const items = this.getAll();
        const filter = (document.getElementById('filter-livraisons')?.value || '').toLowerCase();
        const filtered = items.filter(d => (d.reference || '').toLowerCase().includes(filter) || (d.clientNom || '').toLowerCase().includes(filter));

        const container = document.getElementById('livraisons-list');
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">Aucun bon de livraison trouvé</div>';
            return;
        }

        let html = `<table class="data-table"><thead><tr><th>Réf.</th><th>Client</th><th>Date</th><th>Actions</th></tr></thead><tbody>`;
        filtered.forEach(d => {
            html += `<tr>
                <td><strong>${Utils.escapeHtml(d.reference || '')}</strong></td>
                <td>${Utils.escapeHtml(d.clientNom || '')}</td>
                <td>${Utils.formatDate(d.date)}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="Livraisons.voir(${d.id})">👁️</button>
                    <button class="btn btn-sm btn-success" onclick="Livraisons.exportPDF(${d.id})">📄</button>
                    <button class="btn btn-sm btn-warning" onclick="Livraisons.exportExcel(${d.id})">📊</button>
                    <button class="btn btn-sm btn-danger" onclick="Livraisons.supprimer(${d.id})">🗑️</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    },

    nouveau() {
        Modal.ouvrir('Nouveau Bon de Livraison', this.getFormHtml());
    },

    voir(id) {
        const d = this.getById(id);
        if (!d) return Toast.error('Bon de livraison introuvable');
        let linesHtml = '';
        (d.lignes || []).forEach(l => {
            linesHtml += `<tr><td>${Utils.escapeHtml(l.designation || '')}</td><td>${l.quantite || 0}</td><td>${Utils.escapeHtml(l.unite || '')}</td><td style="text-align:right">${Utils.formatMoney((l.quantite || 0)*(l.prixUnitaire || 0))}</td></tr>`;
        });

        Modal.ouvrir(`BL ${d.reference}`, `
            <div class="document-preview">
                <div class="preview-header"><div class="preview-company"><h2>Eqnovia</h2><p>${Utils.escapeHtml(d.clientNom || '')}</p></div><div class="preview-title"><h1>BON DE LIVRAISON</h1><p>N°: ${d.reference}</p><p>Date: ${Utils.formatDate(d.date)}</p></div></div>
                <div class="preview-info"><div class="preview-client"><h3>Client</h3><p>${Utils.escapeHtml(d.clientNom || '')}</p><p>${Utils.escapeHtml(d.clientAdresse || '')}</p></div></div>
                <table class="lines-table"><thead><tr><th>Désignation</th><th>Qté</th><th>Unité</th><th>Total</th></tr></thead><tbody>${linesHtml}</tbody></table>
                <div class="form-actions">
                    <button class="btn btn-success" onclick="Livraisons.exportPDF(${d.id})">📄 PDF</button>
                    <button class="btn btn-warning" onclick="Livraisons.exportExcel(${d.id})">📊 Excel</button>
                    <button class="btn btn-outline" onclick="Modal.fermer()">Fermer</button>
                </div>
            </div>
        `);
    },

    getFormHtml(doc) {
        const d = doc || {};
        const clients = Clients.getAll();
        const lignes = d.lignes || [{ designation: '', quantite: 1, prixUnitaire: 0, unite: 'Pièce' }];
        let linesHtml = '';
        lignes.forEach((l, i) => {
            linesHtml += `<tr class="line-row"><td><input type="text" name="designation" class="line-designation" value="${Utils.escapeHtml(l.designation || '')}"></td>
                <td><input type="number" name="quantite" class="line-qty" value="${l.quantite || 1}" min="0.01" step="0.01"></td>
                <td><select name="unite" class="line-unite">${['Pièce','Unité','KG','Mètre','Boîte','Carton'].map(u => `<option value="${u}" ${l.unite==u?'selected':''}>${u}</option>`).join('')}</select></td>
                <td class="line-total">${Utils.formatMoney((l.quantite||0)*(l.prixUnitaire||0))}</td>
                <td><button type="button" class="remove-line-btn" onclick="Livraisons.supprimerLigne(this)">×</button></td></tr>`;
        });

        return `
            <form id="livraison-form" onsubmit="return Livraisons.sauvegarder(event)">
                <input type="hidden" name="id" value="${d.id || ''}">
                <div class="form-row">
                    <div class="form-group"><label>Client *</label>
                        <select name="clientId" required><option value="">Sélectionner un client</option>${clients.map(c => `<option value="${c.id}" ${d.clientId==c.id?'selected':''}>${Utils.escapeHtml(c.nom||c.raisonSociale||'')}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Date</label><input type="date" name="date" value="${Utils.formatDateInput(d.date||new Date())}"></div>
                </div>
                <div class="document-lines">
                    <h4>Articles livrés</h4>
                    <table class="lines-table"><thead><tr><th class="col-designation">Désignation</th><th class="col-qty">Qté</th><th class="col-unit">Unité</th><th class="col-total">Total</th><th class="col-actions"></th></tr></thead>
                        <tbody id="lines-container">${linesHtml}</tbody></table>
                    <button type="button" class="add-line-btn" onclick="Livraisons.ajouterLigne()">+ Ajouter un article</button>
                </div>
                <div class="form-actions"><button type="submit" class="btn btn-primary">💾 Enregistrer</button><button type="button" class="btn btn-outline" onclick="Modal.fermer()">Annuler</button></div>
            </form>`;
    },

    ajouterLigne() {
        const container = document.getElementById('lines-container');
        const row = document.createElement('tr'); row.className = 'line-row';
        row.innerHTML = `<td><input type="text" name="designation" class="line-designation" placeholder="Désignation"></td>
            <td><input type="number" name="quantite" class="line-qty" value="1" min="0.01" step="0.01"></td>
            <td><select name="unite" class="line-unite">${['Pièce','Unité','KG','Mètre','Boîte','Carton'].map(u => `<option value="${u}">${u}</option>`).join('')}</select></td>
            <td class="line-total">0,00 Dhs</td>
            <td><button type="button" class="remove-line-btn" onclick="Livraisons.supprimerLigne(this)">×</button></td>`;
        container.appendChild(row);
    },

    supprimerLigne(btn) { const row = btn.closest('tr'); if (document.querySelectorAll('.line-row').length > 1) { row.remove(); } },

    sauvegarder(event) {
        event.preventDefault();
        const form = document.getElementById('livraison-form');
        const data = new FormData(form);
        const clientId = parseInt(data.get('clientId'));
        const client = Clients.getById(clientId);
        if (!client) return Toast.error('Veuillez sélectionner un client');

        const lignes = [];
        document.querySelectorAll('.line-row').forEach(row => {
            lignes.push({
                designation: row.querySelector('.line-designation')?.value || '',
                quantite: parseFloat(row.querySelector('.line-qty')?.value) || 0,
                prixUnitaire: 0,
                unite: row.querySelector('.line-unite')?.value || 'Pièce'
            });
        });

        const totals = Utils.calculateTotals(lignes);
        const docData = {
            clientId, clientNom: client.nom || client.raisonSociale || '', clientAdresse: client.adresse || '', clientVille: client.ville || '', clientIce: client.ice || '', clientRC: client.rc || '',
            date: data.get('date') || new Date().toISOString().split('T')[0],
            objet: data.get('objet') || '',
            lignes, totalHT: totals.totalHT, totalTVA: totals.totalTVA, totalTTC: totals.totalTTC
        };

        const id = data.get('id');
        if (id) { this.modifier(parseInt(id), docData); Toast.success('Bon de livraison modifié avec succès'); }
        else { const saved = this.ajouter(docData); Toast.success(`BL ${saved.reference} créé avec succès`); }

        Modal.fermer();
        this.afficher();
        return false;
    },

    filtrer() { this.afficher(); },

    async exportPDF(id) {
        const doc = this.getById(id);
        if (!doc) return Toast.error('Bon de livraison introuvable');
        const data = PdfExport.prepareDocumentData(doc, { nom: doc.clientNom, adresse: doc.clientAdresse, ville: doc.clientVille, ice: doc.clientIce, rc: doc.clientRC }, doc.lignes, doc.reference, { totalHT: doc.totalHT, totalTVA: doc.totalTVA, totalTTC: doc.totalTTC }, 'BON DE LIVRAISON');
        await PdfExport.downloadPDF('BON DE LIVRAISON', data, `BL_${doc.reference}.pdf`);
        Toast.success('PDF téléchargé avec succès');
    },

    exportExcel(id) {
        const doc = this.getById(id);
        if (!doc) return Toast.error('Bon de livraison introuvable');
        const data = doc.lignes.map(l => ({ 'Désignation': l.designation, 'Quantité': l.quantite, 'Unité': l.unite, 'Référence': doc.reference, 'Client': doc.clientNom, 'Date': Utils.formatDate(doc.date) }));
        PdfExport.exportToExcel(data, `BL_${doc.reference}.xlsx`);
        Toast.success('Excel téléchargé avec succès');
    }
};
