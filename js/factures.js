/**
 * FACTURES - Gestion des factures
 */
const Factures = {
    KEY: Database.KEYS.FACTURES,
    docType: 'FACTURE',
    dbNumberType: 'facture',

    getAll() {
        return Database.get(this.KEY) || [];
    },

    getById(id) {
        return Database.findById(this.KEY, id);
    },

    ajouter(data) {
        data.reference = Database.getNextNumber(this.dbNumberType);
        return Database.add(this.KEY, data);
    },

    modifier(id, data) {
        return Database.update(this.KEY, id, data);
    },

    supprimer(id) {
        Database.delete(this.KEY, id);
        this.afficher();
        Toast.success('Facture supprimée avec succès');
    },

    afficher() {
        const factures = this.getAll();
        const filterText = (document.getElementById('filter-factures')?.value || '').toLowerCase();
        const filterStatus = document.getElementById('filter-status')?.value || '';

        const filtered = factures.filter(f => {
            const matchText = (f.reference || '').toLowerCase().includes(filterText) ||
                (f.clientNom || '').toLowerCase().includes(filterText);
            const matchStatus = !filterStatus || f.statut === filterStatus;
            return matchText && matchStatus;
        });

        const container = document.getElementById('factures-list');
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">Aucune facture trouvée</div>';
            return;
        }

        let html = `<table class="data-table">
            <thead>
                <tr>
                    <th>Réf.</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th>Total TTC</th>
                    <th>Statut</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>`;

        filtered.forEach(f => {
            const statusClass = f.statut === 'Payée' ? 'status-payee' : 'status-impayee';
            html += `<tr>
                <td><strong>${Utils.escapeHtml(f.reference || '')}</strong></td>
                <td>${Utils.escapeHtml(f.clientNom || '')}</td>
                <td>${Utils.formatDate(f.date)}</td>
                <td>${Utils.formatMoney(f.totalTTC || 0)}</td>
                <td><span class="status-badge ${statusClass}">${f.statut || 'Impayée'}</span></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="Factures.voir(${f.id})">👁️</button>
                    <button class="btn btn-sm btn-success" onclick="Factures.exportPDF(${f.id})">📄</button>
                    <button class="btn btn-sm btn-warning" onclick="Factures.exportExcel(${f.id})">📊</button>
                    <button class="btn btn-sm btn-danger" onclick="Factures.supprimer(${f.id})">🗑️</button>
                </td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    nouveau() {
        Modal.ouvrir('Nouvelle Facture', this.getFormHtml());
    },

    voir(id) {
        const f = this.getById(id);
        if (!f) return Toast.error('Facture introuvable');
        this.afficherDocument(f);
    },

    afficherDocument(doc) {
        const statusBadge = doc.statut === 'Payée'
            ? '<span class="status-badge status-payee">Payée</span>'
            : '<span class="status-badge status-impayee">Impayée</span>';

        let linesHtml = '';
        (doc.lignes || []).forEach(l => {
            linesHtml += `<tr>
                <td>${Utils.escapeHtml(l.designation || '')}</td>
                <td>${l.tva || 0}%</td>
                <td>${l.quantite || 0}</td>
                <td>${Utils.escapeHtml(l.unite || '')}</td>
                <td style="text-align:right">${Utils.formatMoney(l.prixUnitaire || 0)}</td>
                <td style="text-align:right">${Utils.formatMoney((l.quantite || 0) * (l.prixUnitaire || 0))}</td>
            </tr>`;
        });

        Modal.ouvrir(`Facture ${doc.reference}`, `
            <div class="document-preview">
                <div class="preview-header">
                    <div class="preview-company">
                        <h2>Eqnovia</h2>
                        <p>${Utils.escapeHtml(doc.clientNom || '')}</p>
                    </div>
                    <div class="preview-title">
                        <h1>FACTURE</h1>
                        <p>N°: ${doc.reference}</p>
                        <p>Date: ${Utils.formatDate(doc.date)}</p>
                        ${statusBadge}
                    </div>
                </div>
                <div class="preview-info">
                    <div class="preview-client">
                        <h3>Client</h3>
                        <p>${Utils.escapeHtml(doc.clientNom || '')}</p>
                        <p>${Utils.escapeHtml(doc.clientAdresse || '')}</p>
                        <p>ICE: ${Utils.escapeHtml(doc.clientIce || '')}</p>
                    </div>
                    <div class="preview-details">
                        <h3>Détails</h3>
                        <p>Total HT: ${Utils.formatMoney(doc.totalHT || 0)}</p>
                        <p>TVA: ${Utils.formatMoney(doc.totalTVA || 0)}</p>
                        <p><strong>Total TTC: ${Utils.formatMoney(doc.totalTTC || 0)}</strong></p>
                    </div>
                </div>
                <table class="lines-table">
                    <thead>
                        <tr>
                            <th>Désignation</th>
                            <th>TVA</th>
                            <th>Qté</th>
                            <th>Unité</th>
                            <th>Prix unitaire</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>${linesHtml}</tbody>
                </table>
                <div class="form-actions">
                    <button class="btn btn-success" onclick="Factures.exportPDF(${doc.id})">📄 PDF</button>
                    <button class="btn btn-warning" onclick="Factures.exportExcel(${doc.id})">📊 Excel</button>
                    <button class="btn btn-primary" onclick="Factures.payer(${doc.id})">✅ Marquer Payée</button>
                    <button class="btn btn-outline" onclick="Modal.fermer()">Fermer</button>
                </div>
            </div>
        `);
    },

    payer(id) {
        this.modifier(id, { statut: 'Payée' });
        Toast.success('Facture marquée comme payée');
        this.afficher();
        Modal.fermer();
    },

    getFormHtml(doc) {
        const d = doc || {};
        const clients = Clients.getAll();
        const lignes = d.lignes || [{ designation: '', quantite: 1, prixUnitaire: 0, tva: 20, unite: 'Pièce' }];

        let linesHtml = '';
        lignes.forEach((l, i) => {
            linesHtml += `<tr class="line-row">
                <td><input type="text" name="designation" class="line-designation" value="${Utils.escapeHtml(l.designation || '')}" placeholder="Désignation"></td>
                <td><select name="tva" class="line-tva">
                    <option value="0" ${(l.tva || 0) == 0 ? 'selected' : ''}>0%</option>
                    <option value="7" ${(l.tva || 0) == 7 ? 'selected' : ''}>7%</option>
                    <option value="10" ${(l.tva || 0) == 10 ? 'selected' : ''}>10%</option>
                    <option value="14" ${(l.tva || 0) == 14 ? 'selected' : ''}>14%</option>
                    <option value="20" ${(l.tva || 0) == 20 ? 'selected' : ''}>20%</option>
                </select></td>
                <td><input type="number" name="quantite" class="line-qty" value="${l.quantite || 1}" min="0.01" step="0.01"></td>
                <td><select name="unite" class="line-unite">
                    <option value="Pièce" ${l.unite == 'Pièce' ? 'selected' : ''}>Pièce</option>
                    <option value="Heure" ${l.unite == 'Heure' ? 'selected' : ''}>H</option>
                    <option value="Jour" ${l.unite == 'Jour' ? 'selected' : ''}>J</option>
                    <option value="Forfait" ${l.unite == 'Forfait' ? 'selected' : ''}>Forfait</option>
                    <option value="Unité" ${l.unite == 'Unité' ? 'selected' : ''}>Unité</option>
                </select></td>
                <td><input type="number" name="prixUnitaire" class="line-price" value="${l.prixUnitaire || 0}" min="0" step="0.01"></td>
                <td class="line-total">${Utils.formatMoney((l.quantite || 0) * (l.prixUnitaire || 0))}</td>
                <td><button type="button" class="remove-line-btn" onclick="Factures.supprimerLigne(this)">×</button></td>
            </tr>`;
        });

        return `
            <form id="facture-form" onsubmit="return Factures.sauvegarder(event)">
                <input type="hidden" name="id" value="${d.id || ''}">
                <div class="form-row">
                    <div class="form-group">
                        <label>Client *</label>
                        <select name="clientId" required>
                            <option value="">Sélectionner un client</option>
                            ${clients.map(c => `<option value="${c.id}" ${d.clientId == c.id ? 'selected' : ''}>${Utils.escapeHtml(c.nom || c.raisonSociale || '')}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" name="date" value="${Utils.formatDateInput(d.date || new Date())}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Objet</label>
                    <input type="text" name="objet" value="${Utils.escapeHtml(d.objet || '')}">
                </div>
                <div class="document-lines">
                    <h4>Lignes de facture</h4>
                    <table class="lines-table">
                        <thead>
                            <tr>
                                <th class="col-designation">Désignation</th>
                                <th class="col-tva">TVA</th>
                                <th class="col-qty">Qté</th>
                                <th class="col-unit">Unité</th>
                                <th class="col-price">Prix unit.</th>
                                <th class="col-total">Total</th>
                                <th class="col-actions"></th>
                            </tr>
                        </thead>
                        <tbody id="lines-container">${linesHtml}</tbody>
                    </table>
                    <div class="lines-toolbar">
                        <button type="button" class="btn btn-sm btn-outline undo-lines-btn" onclick="LineHistory.undo()" disabled title="Ctrl+Z">↩ Annuler</button>
                        <button type="button" class="btn btn-sm btn-outline redo-lines-btn" onclick="LineHistory.redo()" disabled title="Ctrl+Shift+Z">↪ Rétablir</button>
                        <span class="lines-toolbar-spacer"></span>
                        <button type="button" class="add-line-btn" onclick="Factures.ajouterLigne()">+ Ajouter une ligne</button>
                    </div>
                </div>
                <div class="document-totals">
                    <table class="totals-table">
                        <tr><td class="label">Total HT</td><td class="value" id="total-ht">0,00 Dhs</td></tr>
                        <tr><td class="label">Total TVA</td><td class="value" id="total-tva">0,00 Dhs</td></tr>
                        <tr><td class="label">Total TTC</td><td class="value total-ttc" id="total-ttc">0,00 Dhs</td></tr>
                    </table>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">💾 Enregistrer</button>
                    <button type="button" class="btn btn-outline" onclick="Modal.fermer()">Annuler</button>
                </div>
            </form>
        `;
    },

    ajouterLigne() {
        LineHistory.saveState();
        const container = document.getElementById('lines-container');
        const row = document.createElement('tr');
        row.className = 'line-row';
        row.innerHTML = `
            <td><input type="text" name="designation" class="line-designation" placeholder="Désignation"></td>
            <td><select name="tva" class="line-tva">
                <option value="0">0%</option><option value="7">7%</option><option value="10">10%</option><option value="14">14%</option><option value="20" selected>20%</option>
            </select></td>
            <td><input type="number" name="quantite" class="line-qty" value="1" min="0.01" step="0.01"></td>
            <td><select name="unite" class="line-unite">
                <option value="Pièce">Pièce</option><option value="Heure">H</option><option value="Jour">J</option><option value="Forfait">Forfait</option><option value="Unité">Unité</option>
            </select></td>
            <td><input type="number" name="prixUnitaire" class="line-price" value="0" min="0" step="0.01"></td>
            <td class="line-total">0,00 Dhs</td>
            <td><button type="button" class="remove-line-btn" onclick="Factures.supprimerLigne(this)">×</button></td>
        `;
        container.appendChild(row);
        this.actualiserTotaux();
    },

    supprimerLigne(btn) {
        const row = btn.closest('tr');
        if (document.querySelectorAll('.line-row').length > 1) {
            LineHistory.saveState();
            row.remove();
            this.actualiserTotaux();
        }
    },

    actualiserTotaux() {
        const rows = document.querySelectorAll('.line-row');
        let totalHT = 0, totalTVA = 0;
        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.line-qty')?.value) || 0;
            const price = parseFloat(row.querySelector('.line-price')?.value) || 0;
            const tva = parseFloat(row.querySelector('.line-tva')?.value) || 0;
            const lineTotal = qty * price;
            const lineTVA = lineTotal * tva / 100;
            totalHT += lineTotal;
            totalTVA += lineTVA;
            const totalEl = row.querySelector('.line-total');
            if (totalEl) totalEl.textContent = Utils.formatMoney(lineTotal);
        });
        document.getElementById('total-ht').textContent = Utils.formatMoney(totalHT);
        document.getElementById('total-tva').textContent = Utils.formatMoney(totalTVA);
        document.getElementById('total-ttc').textContent = Utils.formatMoney(totalHT + totalTVA);
    },

    sauvegarder(event) {
        event.preventDefault();
        const form = document.getElementById('facture-form');
        const data = new FormData(form);

        const rawClientId = data.get('clientId');
        const clientId = parseInt(rawClientId);
        // Debug: vérifier la valeur reçue
        console.log('Sauvegarde facture - rawClientId:', rawClientId, 'type:', typeof rawClientId, 'parsed:', clientId, 'isNaN:', isNaN(clientId));
        const client = Clients.getById(clientId);
        console.log('Client trouvé:', client);
        if (!client) return Toast.error('Veuillez sélectionner un client');

        const rows = document.querySelectorAll('.line-row');
        const lignes = [];
        rows.forEach(row => {
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
            clientId: clientId,
            clientNom: client.nom || client.raisonSociale || '',
            clientAdresse: client.adresse || '',
            clientVille: client.ville || '',
            clientIce: client.ice || '',
            clientRC: client.rc || '',
            date: data.get('date') || new Date().toISOString().split('T')[0],
            objet: data.get('objet') || '',
            lignes: lignes,
            totalHT: totals.totalHT,
            totalTVA: totals.totalTVA,
            totalTTC: totals.totalTTC,
            statut: 'Impayée'
        };

        const id = data.get('id');
        if (id) {
            this.modifier(parseInt(id), docData);
            Toast.success('Facture modifiée avec succès');
        } else {
            const saved = this.ajouter(docData);
            Toast.success(`Facture ${saved.reference} créée avec succès`);
        }

        LineHistory.reset();
        Modal.fermer();
        this.afficher();
        return false;
    },

    filtrer() {
        this.afficher();
    },

    async exportPDF(id) {
        const doc = this.getById(id);
        if (!doc) return Toast.error('Facture introuvable');

        const data = PdfExport.prepareDocumentData(doc, {
            nom: doc.clientNom,
            adresse: doc.clientAdresse,
            ville: doc.clientVille,
            ice: doc.clientIce,
            rc: doc.clientRC
        }, doc.lignes, doc.reference, { totalHT: doc.totalHT, totalTVA: doc.totalTVA, totalTTC: doc.totalTTC }, 'FACTURE');

        await PdfExport.downloadPDF('FACTURE', data, `Facture_${doc.reference}.pdf`);
        Toast.success('PDF téléchargé avec succès');
    },

    exportExcel(id) {
        const doc = this.getById(id);
        if (!doc) return Toast.error('Facture introuvable');

        const data = doc.lignes.map(l => ({
            'Désignation': l.designation,
            'Quantité': l.quantite,
            'Unité': l.unite,
            'Prix unitaire HT': l.prixUnitaire,
            'TVA %': l.tva,
            'Total HT': (l.quantite || 0) * (l.prixUnitaire || 0),
            'Référence': doc.reference,
            'Client': doc.clientNom,
            'Date': Utils.formatDate(doc.date)
        }));

        PdfExport.exportToExcel(data, `Facture_${doc.reference}.xlsx`);
        Toast.success('Excel téléchargé avec succès');
    }
};
