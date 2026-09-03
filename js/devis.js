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

        let html = `<table class="data-table"><thead><tr><th>Réf.</th><th>Client</th><th>Date</th><th>Validité</th><th>Total TTC</th><th>Statut</th><th>Actions</th></tr></thead><tbody>`;
        // Une facture par devis : liste des factures créées à partir de devis
        const factures = Factures.getAll().filter(f => f.sourceType === 'devis');
        filtered.forEach(d => {
            const factureExistante = factures.find(f => String(f.sourceId) === String(d.id));
            html += `<tr>
                <td><strong>${Utils.escapeHtml(d.reference || '')}</strong>${d.copieLocale ? ' <span class="copie-locale-badge" title="Copie PDF enregistrée dans le dossier local">📁</span>' : ''}</td>
                <td>${Utils.escapeHtml(d.clientNom || '')}</td>
                <td>${Utils.formatDate(d.date)}</td>
                <td>${d.dateValidite ? Utils.formatDate(d.dateValidite) : '<span style="opacity:.4">—</span>'}${d.dateValidite && new Date(d.dateValidite) < new Date() && d.statut !== 'Confirmé' && d.statut !== 'Refusé' ? ' <span style="color:var(--danger-color);font-size:0.7rem;font-weight:600">⏰ expiré</span>' : ''}</td>
                <td>${Utils.formatMoney(d.totalTTC || 0)}</td>
                <td><span class="status-badge ${this.getStatutClass(d.statut)}">${d.statut || 'En attente'}</span></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="Devis.voir(${d.id})">👁️</button>
                    <button class="btn btn-sm btn-warning" onclick="Devis.editer(${d.id})">✏️</button>
                    <button class="btn btn-sm btn-pdf" onclick="Devis.exportPDF(${d.id})">📄</button>
                    <button class="btn btn-sm btn-excel" onclick="Devis.exportExcel(${d.id})">📊</button>
                    ${factureExistante
                        ? `<button class="btn btn-sm btn-success" onclick="Factures.voir(${factureExistante.id})" title="Facture créée : ${factureExistante.reference}">📋</button>`
                        : d.statut === 'Refusé'
                            ? `<button class="btn btn-sm btn-danger" title="Devis refusé : conversion impossible" disabled>📋</button>`
                            : `<button class="btn btn-sm btn-primary" onclick="Devis.convertirFacture(${d.id})">📋</button>`}
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

    editer(id) {
        const d = this.getById(id);
        if (!d) return Toast.error('Devis introuvable');
        Modal.ouvrir(`Modifier Devis ${d.reference}`, this.getFormHtml(d));
    },

    voir(id) {
        const d = this.getById(id);
        if (!d) return Toast.error('Devis introuvable');
        const factureExistante = Factures.getAll().find(f => f.sourceType === 'devis' && String(f.sourceId) === String(id));
        const company = typeof PdfExport !== 'undefined' ? PdfExport.getCompany() : { nom:'Eqnovia', adresse:'20 rue Moussa Bnou Noussair', ville:'Casablanca', website:'www.eqnovia.ma', ice:'001445583000022', rc:'236357', if:'40397283', capital:'2 000 000 Dhs', tp:'35546302' };

        let linesHtml = '';
        (d.lignes || []).forEach(l => {
            const total = (l.quantite || 0) * (l.prixUnitaire || 0);
            linesHtml += `<tr>
                <td>${Utils.escapeHtml(l.designation || '')}</td>
                <td style="text-align:center">${l.tva || 0}%</td>
                <td style="text-align:center">${l.quantite || 0}</td>
                <td style="text-align:center">${Utils.escapeHtml(l.unite || '')}</td>
                <td style="text-align:right">${Utils.formatMoney(l.prixUnitaire || 0)}</td>
                <td style="text-align:right">${Utils.formatMoney(total)}</td>
            </tr>`;
        });

        Modal.ouvrir(`Devis ${d.reference}`, `
            <div class="document-preview devis-layout">
                <!-- HEADER: Logo left, DEVIS title + Client right -->
                <div class="devis-header">
                    <div class="devis-header-left">
                        <div class="devis-logo"><h2>eqnovia</h2></div>
                        <p>${company.nom}</p>
                        <p>${company.adresse}</p>
                        <p>${company.ville}</p>
                        <p>${company.website}</p>
                    </div>
                    <div class="devis-header-right">
                        <h1 class="devis-title">DEVIS</h1>
                        <div class="devis-client-info">
                            <p><strong>${Utils.escapeHtml(d.clientNom || '')}</strong></p>
                            <p>${Utils.escapeHtml(d.clientAdresse || '')}</p>
                            ${d.clientIce ? `<p>ICE: ${Utils.escapeHtml(d.clientIce)}</p>` : ''}
                        </div>
                        <span class="status-badge ${this.getStatutClass(d.statut)}">${d.statut || 'En attente'}</span>
                    </div>
                </div>

                <!-- DATE BAR -->
                <div class="devis-date-bar">
                    <div class="devis-date-item">
                        <span class="devis-date-label">Date du devis :</span>
                        <span class="devis-date-value">${Utils.formatDate(d.date)}</span>
                    </div>
                    <div class="devis-date-item">
                        <span class="devis-date-label">Date de fin de validité :</span>
                        <span class="devis-date-value">${d.dateValidite ? Utils.formatDate(d.dateValidite) : '—'}</span>
                    </div>
                    <div class="devis-date-item">
                        <span class="devis-date-label">Référence :</span>
                        <span class="devis-date-value"><strong>${Utils.escapeHtml(d.reference || '')}</strong></span>
                    </div>
                </div>

                <!-- OBJET -->
                ${d.objet ? `<div class="devis-objet"><span class="devis-date-label">Objet :</span> ${Utils.escapeHtml(d.objet)}</div>` : ''}

                <!-- MONTANTS -->
                <p style="text-align:right;font-style:italic;color:var(--text-light);font-size:0.8rem;margin-bottom:0.5rem;">Montants exprimés en Dhs</p>

                <!-- TABLE -->
                <table class="lines-table devis-table">
                    <thead>
                        <tr>
                            <th class="col-designation">Désignation</th>
                            <th class="col-tva">% TVA</th>
                            <th class="col-qty">Quantité</th>
                            <th class="col-unit">Unité</th>
                            <th class="col-price">Prix unitaire HT</th>
                            <th class="col-total">Prix total HT</th>
                        </tr>
                    </thead>
                    <tbody>${linesHtml}</tbody>
                </table>

                <!-- TOTALS -->
                <div class="devis-totals">
                    <table class="totals-table">
                        <tr><td class="label">Total HT</td><td class="value">${Utils.formatMoney(d.totalHT || 0)}</td></tr>
                        <tr><td class="label">Total TVA</td><td class="value">${Utils.formatMoney(d.totalTVA || 0)}</td></tr>
                        <tr><td class="label">Total TTC</td><td class="value total-ttc">${Utils.formatMoney(d.totalTTC || 0)}</td></tr>
                    </table>
                </div>

                <!-- NOTE -->
                <p class="devis-note">*Hors fourniture et installation des modules photovoltaïques et de leurs structures de fixation (éléments déjà installés par le client)</p>

                <!-- REMARQUES -->
                ${d.remarques ? `<div class="remarks-section"><h4>📝 Remarques</h4><p>${Utils.escapeHtml(d.remarques)}</p></div>` : ''}

                <!-- FOOTER: Two boxes -->
                <div class="devis-footer-boxes">
                    <div class="devis-footer-box">
                        <h4>Coordonnées bancaires :</h4>
                        <p>Banque : Crédit du Maroc</p>
                        <p>Bénéficiaire : Eqnovia</p>
                        <p>RIB : 021 780 0000 177030150208 49</p>
                    </div>
                    <div class="devis-footer-box devis-footer-signature">
                        <p>Cachet, Date, Signature et mention "Bon pour Accord"</p>
                    </div>
                </div>

                <!-- LEGAL FOOTER -->
                <div class="devis-legal">
                    ${company.nom} S.A. - ${company.adresse} ${company.ville} - Capital : ${company.capital} - ICE : ${company.ice} - RC : ${company.rc} - IF : ${company.if} - N° Taxe Professionnelle : ${company.tp}
                </div>

                <!-- ACTIONS -->
                <div class="form-actions">
                    <button class="btn btn-pdf" onclick="Devis.exportPDF(${d.id})">📄 PDF</button>
                    <button class="btn btn-excel" onclick="Devis.exportExcel(${d.id})">📊 Excel</button>
                    <button class="btn btn-primary" onclick="Devis.editer(${d.id})">✏️ Modifier</button>
                    ${factureExistante
                        ? `<button class="btn btn-success" onclick="Factures.voir(${factureExistante.id})">📋 Facture ${factureExistante.reference}</button>`
                        : d.statut === 'Refusé'
                            ? `<button class="btn btn-danger" title="Devis refusé" disabled>📋 Convertir en Facture</button>`
                            : `<button class="btn btn-primary" onclick="Devis.convertirFacture(${d.id})">📋 Convertir en Facture</button>`}
                    <button class="btn btn-success" onclick="Devis.changerStatut(${d.id}, 'Confirmé')" ${d.statut === 'Confirmé' ? 'disabled' : ''}>✅ Confirmer</button>
                    <button class="btn btn-danger" onclick="Devis.changerStatut(${d.id}, 'Refusé')" ${d.statut === 'Refusé' ? 'disabled' : ''}>❌ Refuser</button>
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
                <td>${Utils.uniteSelectHtml(l.unite)}</td>
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
                    <div class="form-group"><label>Date du devis</label><input type="date" name="date" value="${Utils.formatDateInput(d.date||new Date())}"></div>
                    <div class="form-group"><label>Date de fin de validité</label><input type="date" name="dateValidite" value="${Utils.formatDateInput(d.dateValidite || (() => { const dt = new Date(d.date || new Date()); dt.setDate(dt.getDate() + 30); return dt; })())}"></div>
                    <div class="form-group"><label>Statut</label>
                        <select name="statut">
                            ${['En attente','Envoyé','Confirmé','Refusé'].map(s => `<option value="${s}" ${d.statut==s?'selected':''}>${s}</option>`).join('')}
                        </select></div>
                </div>
                <div class="form-group"><label>Objet</label><input type="text" name="objet" value="${Utils.escapeHtml(d.objet||'')}"></div>
                <div class="document-lines">
                    <h4>Lignes du devis</h4>
                    <table class="lines-table"><thead><tr><th class="col-designation">Désignation</th><th class="col-tva">TVA</th><th class="col-qty">Qté</th><th class="col-unit">Unité</th><th class="col-price">Prix unit.</th><th class="col-total">Total</th><th class="col-actions"></th></tr></thead>
                        <tbody id="lines-container">${linesHtml}</tbody></table>
                    <div class="lines-toolbar">
                        ${ExcelImport.getImportButtonHtml('devis')}
                        <span class="lines-toolbar-spacer"></span>
                        <button type="button" class="add-line-btn" onclick="Devis.ajouterLigne()">+ Ajouter une ligne</button>
                    </div>
                </div>
                <div class="document-totals"><table class="totals-table"><tr><td class="label">Total HT</td><td class="value" id="total-ht">0,00 Dhs</td></tr><tr><td class="label">Total TVA</td><td class="value" id="total-tva">0,00 Dhs</td></tr><tr><td class="label">Total TTC</td><td class="value total-ttc" id="total-ttc">0,00 Dhs</td></tr></table></div>
                <div class="form-group"><label>Remarques (optionnel)</label><textarea name="remarques" rows="3" placeholder="Remarques ou notes...">${Utils.escapeHtml(d.remarques || '')}</textarea></div>
                <div class="form-actions"><button type="submit" class="btn btn-primary">💾 Enregistrer</button><button type="button" class="btn btn-outline" onclick="Modal.fermer()">Annuler</button></div>
            </form>`;
    },

    ajouterLigne() {
        const container = document.getElementById('lines-container');
        const row = document.createElement('tr'); row.className = 'line-row';
        row.innerHTML = `<td><input type="text" name="designation" class="line-designation" placeholder="Désignation"></td>
            <td><select name="tva" class="line-tva">${[0,7,10,14,20].map(v => `<option value="${v}" ${v==20?'selected':''}>${v}%</option>`).join('')}</select></td>
            <td><input type="number" name="quantite" class="line-qty" value="1" min="0.01" step="0.01"></td>
            <td>${Utils.uniteSelectHtml('')}</td>
            <td><input type="number" name="prixUnitaire" class="line-price" value="0" min="0" step="0.01"></td>
            <td class="line-total">0,00 Dhs</td>
            <td><button type="button" class="remove-line-btn" onclick="Devis.supprimerLigne(this)">×</button></td>`;
        container.appendChild(row);
        this.actualiserTotaux();
        LineHistory.saveState();
    },

    supprimerLigne(btn) { const row = btn.closest('tr'); if (document.querySelectorAll('.line-row').length > 1) { row.remove(); this.actualiserTotaux(); LineHistory.saveState(); } },

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
        const rawClientId = data.get('clientId');
        // Recherche tolérante : l'id peut être numérique, chaîne ou très grand (Date.now())
        const client = Clients.getById(rawClientId) || Clients.getById(parseInt(rawClientId));
        if (!client) return Toast.error('Veuillez sélectionner un client');
        const clientId = client.id;

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
            dateValidite: data.get('dateValidite') || '',
            objet: data.get('objet') || '',
            remarques: data.get('remarques') || '',
            lignes, totalHT: totals.totalHT, totalTVA: totals.totalTVA, totalTTC: totals.totalTTC, statut: data.get('statut') || 'En attente'
        };

        const id = data.get('id');
        let docPourCopie = null;
        if (id) { docPourCopie = this.modifier(parseInt(id), docData); Toast.success('Devis modifié avec succès'); }
        else { docPourCopie = this.ajouter(docData); Toast.success(`Devis ${docPourCopie.reference} créé avec succès`); }

        // Copie PDF automatique dans le dossier local (dossier configuré ou création sur le Bureau)
        // Mise à jour à la création ET à chaque modification
        if (docPourCopie) {
            this.enregistrerCopiePDF(docPourCopie);
        }

        LineHistory.reset();
        Modal.fermer();
        this.afficher();
        return false;
    },

    filtrer() { this.afficher(); },

    /**
     * Génère et enregistre automatiquement une copie PDF du devis
     * dans le dossier local (configuré ou créé sur le Bureau).
     * Marque le devis avec l'indicateur copieLocale en cas de succès.
     */
    async enregistrerCopiePDF(doc) {
        const ok = await PdfExport.enregistrerCopieDocument(doc, 'DEVIS', 'Devis');
        if (ok && doc && doc.id) {
            this.modifier(doc.id, { copieLocale: true });
        }
        return ok;
    },

    getStatutClass(statut) {
        switch (statut) {
            case 'Envoyé': return 'status-envoye';
            case 'Confirmé': return 'status-confirme';
            case 'Refusé': return 'status-refuse';
            default: return 'status-attente';
        }
    },

    changerStatut(id, nouveauStatut) {
        const d = this.getById(id);
        if (!d) return Toast.error('Devis introuvable');
        if (d.statut === nouveauStatut) return;
        this.modifier(id, { statut: nouveauStatut });
        Toast.success(`Devis ${d.reference} marqué « ${nouveauStatut} »`);
        this.voir(id);
    },

    async exportPDF(id) {
        const doc = this.getById(id);
        if (!doc) return Toast.error('Devis introuvable');
        const data = PdfExport.prepareDocumentData(doc, { nom: doc.clientNom, adresse: doc.clientAdresse, ville: doc.clientVille, ice: doc.clientIce, rc: doc.clientRC }, doc.lignes, doc.reference, { totalHT: doc.totalHT, totalTVA: doc.totalTVA, totalTTC: doc.totalTTC }, 'DEVIS');
        data.remarques = doc.remarques || '';
        data.dateValidite = doc.dateValidite ? Utils.formatDate(doc.dateValidite) : '';
        await PdfExport.downloadPDF('DEVIS', data, `Devis_${doc.reference}.pdf`);
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

        // Un devis refusé ne peut pas être converti en facture
        if (devis.statut === 'Refusé') {
            return Toast.error(`Le devis ${devis.reference} est refusé : conversion en facture impossible.`);
        }

        // Une seule conversion autorisée : une facture par devis
        const factureExistante = Factures.getAll().find(f => f.sourceType === 'devis' && String(f.sourceId) === String(id));
        if (factureExistante) {
            return Toast.error(`Une facture existe déjà pour ce devis (${factureExistante.reference})`);
        }

        if (!confirm(`📋 Convertir le devis ${devis.reference} en facture ?\n\n` +
            `Client : ${devis.clientNom || '-'}\n` +
            `Montant TTC : ${Utils.formatMoney(devis.totalTTC || 0)}\n\n` +
            `Une nouvelle facture sera créée (statut Impayée) et le devis restera conservé.`)) {
            return;
        }

        // Copy devis data to new invoice
        const factureData = { ...devis };
        delete factureData.id;
        delete factureData.reference;
        delete factureData.createdAt;
        factureData.statut = 'Impayée';
        factureData.sourceType = 'devis';
        factureData.sourceId = devis.id;

        const saved = Factures.ajouter(factureData);
        Toast.success(`Devis converti en Facture ${saved.reference}`);
        // Copie PDF automatique de la facture créée
        Factures.enregistrerCopiePDF(saved);
        this.afficher();
    }
};
