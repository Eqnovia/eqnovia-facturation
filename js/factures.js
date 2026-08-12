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
        const f = this.getById(id);
        if (!f) return Toast.error('Facture introuvable');
        // Action protégée : mot de passe requis (permet aussi de supprimer une facture payée)
        if (!Utils.verifierMotDePasse(`Supprimer la facture ${f.reference || ''}`)) return;
        const nbPaiements = (f.paiements || []).length;
        const nbPieces = (f.attachments || []).length;
        let msg = `⚠️ Supprimer la facture ${f.reference} ?\n\n` +
            `Client : ${f.clientNom || '-'}\n` +
            `Montant TTC : ${Utils.formatMoney(f.totalTTC || 0)}`;
        if (nbPaiements > 0) msg += `\n\n⚠️ ${nbPaiements} paiement(s) enregistré(s) seront également supprimés.`;
        if (nbPieces > 0) msg += `\n⚠️ ${nbPieces} pièce(s) jointe(s) seront également supprimées.`;
        msg += `\n\nCette action est irréversible.`;
        if (!confirm(msg)) return;
        // Nettoyer les pièces jointes volumineuses (IndexedDB + cloud Supabase)
        (f.attachments || []).forEach(a => {
            if (a.storeKey) {
                AttachmentStore.remove(a.storeKey);
                CloudSync.deleteAttachment(a.storeKey);
            }
        });
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
            const matchStatus = !filterStatus || this.getStatutReel(f) === filterStatus;
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
            const statutReel = this.getStatutReel(f);
            const statusClass = statutReel === 'Payée' ? 'status-payee' : (statutReel === 'Partiellement payée' ? 'status-partiel' : 'status-impayee');
            const attCount = (f.attachments || []).length;
            const reste = this.getResteAPayer(f);
            const editBtn = statutReel !== 'Payée'
                ? `<button class="btn btn-sm btn-warning" onclick="Factures.editer(${f.id})" title="Modifier la facture (mot de passe requis)">✏️</button>`
                : `<button class="btn btn-sm btn-warning" onclick="Factures.editer(${f.id})" title="Déverrouiller et modifier (mot de passe requis)">🔓</button>`;
            html += `<tr>
                <td><strong>${Utils.escapeHtml(f.reference || '')}</strong>${attCount ? ` <span class="att-count" title="${attCount} pièce(s) jointe(s)">📎 ${attCount}</span>` : ''}</td>
                <td>${Utils.escapeHtml(f.clientNom || '')}</td>
                <td>${Utils.formatDate(f.date)}</td>
                <td>${Utils.formatMoney(f.totalTTC || 0)}${reste > 0 ? ` <span class="reste-text">(reste ${Utils.formatMoney(reste)})</span>` : ''}</td>
                <td><span class="status-badge ${statusClass}">${statutReel}</span></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="Factures.voir(${f.id})">👁️</button>
                    ${editBtn}
                    <button class="btn btn-sm btn-pdf" onclick="Factures.exportPDF(${f.id})">📄</button>
                    <button class="btn btn-sm btn-excel" onclick="Factures.exportExcel(${f.id})">📊</button>
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

    editer(id) {
        const f = this.getById(id);
        if (!f) return Toast.error('Facture introuvable');
        // Action protégée : mot de passe requis (permet aussi de déverrouiller une facture payée)
        if (!Utils.verifierMotDePasse(`Modifier la facture ${f.reference || ''}`)) return;
        Modal.ouvrir(`Modifier Facture ${f.reference}`, this.getFormHtml(f));
    },

    getMontantPaye(f) {
        return (f.paiements || []).reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
    },

    getResteAPayer(f) {
        // Factures payées sans paiements enregistrés (anciennes données) : reste = 0
        if ((f.paiements || []).length === 0 && f.statut === 'Payée') return 0;
        return Math.max(0, (f.totalTTC || 0) - this.getMontantPaye(f));
    },

    getStatutReel(f) {
        if ((f.paiements || []).length > 0) {
            return this.getResteAPayer(f) <= 0 ? 'Payée' : 'Partiellement payée';
        }
        return f.statut || 'Impayée';
    },

    recalculerStatut(f) {
        return this.getStatutReel(f);
    },

    afficherDocument(doc) {
        const statutReel = this.getStatutReel(doc);
        const isPaid = statutReel === 'Payée';
        const statusBadge = statutReel === 'Payée'
            ? '<span class="status-badge status-payee">Payée</span>'
            : (statutReel === 'Partiellement payée'
                ? '<span class="status-badge status-partiel">Partiellement payée</span>'
                : '<span class="status-badge status-impayee">Impayée</span>');

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

        const paiementsHtml = this.renderPaiementsHtml(doc);
        const attachmentsHtml = this.renderAttachmentsHtml(doc);

        // Bon de livraison : un seul par facture
        const blExistant = Livraisons.getAll().find(l => l.sourceType === 'facture' && String(l.sourceId) === String(doc.id));
        const blButton = blExistant
            ? `<button class="btn btn-outline" onclick="Livraisons.voir(${blExistant.id})" title="Bon de livraison déjà créé">📦 ${blExistant.reference}</button>`
            : `<button class="btn btn-outline" onclick="Factures.convertirLivraison(${doc.id})">📦 Bon de Livraison</button>`;

        const actionsHtml = isPaid
            ? `<button class="btn btn-pdf" onclick="Factures.exportPDF(${doc.id})">📄 PDF</button>
               <button class="btn btn-excel" onclick="Factures.exportExcel(${doc.id})">📊 Excel</button>
               <button class="btn btn-warning" onclick="Factures.editer(${doc.id})" title="Déverrouiller et modifier (mot de passe requis)">🔓 Déverrouiller</button>
               ${blButton}
               <span class="locked-badge" title="Facture payée - verrouillée">🔒 Verrouillée</span>`
            : `<button class="btn btn-pdf" onclick="Factures.exportPDF(${doc.id})">📄 PDF</button>
               <button class="btn btn-excel" onclick="Factures.exportExcel(${doc.id})">📊 Excel</button>
               <button class="btn btn-primary" onclick="Factures.editer(${doc.id})">✏️ Modifier</button>
               ${blButton}`;

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
                ${paiementsHtml}
                ${attachmentsHtml}
                <div class="form-actions">
                    ${actionsHtml}
                    <button class="btn btn-outline" onclick="Modal.fermer()">Fermer</button>
                </div>
            </div>
        `);
    },

    renderPaiementsHtml(doc) {
        const paiements = doc.paiements || [];
        const paye = this.getMontantPaye(doc);
        const reste = this.getResteAPayer(doc);
        const total = doc.totalTTC || 0;
        const isPaid = this.getStatutReel(doc) === 'Payée';
        const pct = total > 0 ? Math.min(100, Math.round((paye / total) * 100)) : 0;

        let rows = '';
        if (paiements.length === 0) {
            rows = '<tr><td colspan="4" class="paiements-empty">Aucun paiement enregistré pour le moment.</td></tr>';
        } else {
            rows = paiements.map((p, idx) => `
                <tr>
                    <td>${Utils.formatDate(p.date)}</td>
                    <td style="text-align:right">${Utils.formatMoney(p.montant || 0)}</td>
                    <td>${Utils.escapeHtml(p.mode || '')}</td>
                    <td class="paiement-actions">${isPaid ? '' : `<button class="btn btn-sm btn-danger" onclick="Factures.supprimerPaiement(${doc.id}, ${idx})" title="Supprimer le paiement">🗑️</button>`}</td>
                </tr>`).join('');
        }

        return `
        <div class="paiements-section">
            <div class="paiements-header">
                <h4>💰 Paiements <span class="att-count">${paiements.length}</span></h4>
                <div class="paiement-progress" title="${pct}% payé">
                    <div class="paiement-progress-bar" style="width:${pct}%"></div>
                    <span class="paiement-progress-label">${pct}% payé</span>
                </div>
            </div>
            <div class="paiement-summary">
                <div class="paiement-summary-item paiement-summary-paid"><span>Payé</span><strong>${Utils.formatMoney(paye)}</strong></div>
                <div class="paiement-summary-item paiement-summary-restant"><span>Reste à payer</span><strong>${Utils.formatMoney(reste)}</strong></div>
                <div class="paiement-summary-item"><span>Total TTC</span><strong>${Utils.formatMoney(total)}</strong></div>
            </div>
            <table class="paiements-table">
                <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th></th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div id="paiement-form-container" style="display:none">
                <div class="form-row">
                    <div class="form-group"><label>Date du paiement</label><input type="date" id="paiement-date" value="${Utils.formatDateInput(new Date())}"></div>
                    <div class="form-group"><label>Montant (Dhs)</label><input type="number" id="paiement-montant" value="${reste > 0 ? reste : ''}" min="0.01" step="0.01"></div>
                    <div class="form-group"><label>Mode de paiement</label>
                        <select id="paiement-mode">
                            <option value="Espèces">Espèces</option>
                            <option value="Chèque">Chèque</option>
                            <option value="Virement">Virement</option>
                            <option value="Carte bancaire">Carte bancaire</option>
                            <option value="Autre">Autre</option>
                        </select>
                    </div>
                    <div class="form-group paiement-form-actions">
                        <button class="btn btn-primary" onclick="Factures.enregistrerPaiement(${doc.id})">💾 Enregistrer</button>
                        <button class="btn btn-outline" onclick="Factures.togglePaiementForm(${doc.id})">Annuler</button>
                    </div>
                </div>
            </div>
            <div class="paiements-actions">
                ${isPaid
                    ? '<span class="locked-badge">🔒 Facture payée - paiements verrouillés</span>'
                    : `<button class="btn btn-sm btn-primary" onclick="Factures.togglePaiementForm(${doc.id})">➕ Ajouter un paiement</button>
                       <button class="btn btn-sm btn-success" onclick="Factures.payer(${doc.id})">✅ Marquer Payée</button>`}
            </div>
        </div>`;
    },

    togglePaiementForm(id) {
        const el = document.getElementById('paiement-form-container');
        if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    },

    enregistrerPaiement(id) {
        const f = this.getById(id);
        if (!f) return Toast.error('Facture introuvable');
        const date = document.getElementById('paiement-date')?.value;
        const montant = parseFloat(document.getElementById('paiement-montant')?.value);
        const mode = document.getElementById('paiement-mode')?.value || 'Espèces';
        if (!date) return Toast.error('Veuillez saisir la date du paiement');
        if (!montant || montant <= 0) return Toast.error('Veuillez saisir un montant valide');
        if (montant > this.getResteAPayer(f)) return Toast.error('Le montant dépasse le reste à payer');

        const paiements = f.paiements || [];
        paiements.push({ id: Utils.generateId(), date, montant, mode });
        this.modifier(id, { paiements, statut: this.recalculerStatut({ ...f, paiements }) });
        Toast.success('Paiement enregistré avec succès');
        this.voir(id);
    },

    supprimerPaiement(id, idx) {
        const f = this.getById(id);
        if (!f) return Toast.error('Facture introuvable');
        if (this.getStatutReel(f) === 'Payée') return Toast.error('Cette facture est payée et ne peut plus être modifiée');
        if (!confirm('Supprimer ce paiement ?')) return;
        const paiements = (f.paiements || []).filter((_, i) => i !== idx);
        this.modifier(id, { paiements, statut: this.recalculerStatut({ ...f, paiements }) });
        Toast.success('Paiement supprimé');
        this.voir(id);
    },

    renderAttachmentsHtml(doc) {
        const atts = doc.attachments || [];
        const isPaid = this.getStatutReel(doc) === 'Payée';
        let items = '';
        if (atts.length === 0) {
            items = '<p class="attachments-empty">Aucune pièce jointe pour le moment.</p>';
        } else {
            items = atts.map((a, idx) => {
                const isImage = (a.type || '').startsWith('image/');
                // Aperçu direct uniquement pour les petites pièces (dataUrl dans le doc)
                const thumb = isImage && a.dataUrl
                    ? `<img class="attachment-thumb" src="${a.dataUrl}" alt="">`
                    : `<div class="attachment-thumb attachment-thumb-pdf">${isImage ? '🖼️' : '📄'}</div>`;
                const taille = a.storeKey ? (a.size || 0) : ((a.dataUrl || '').length);
                const delBtn = isPaid ? '' : `<button class="btn btn-sm btn-danger" onclick="Factures.supprimerPieceJointe(${doc.id}, ${idx})" title="Supprimer">🗑️</button>`;
                return `<div class="attachment-item">
                    ${thumb}
                    <div class="attachment-info">
                        <span class="attachment-name" title="${Utils.escapeHtml(a.nom)}">${Utils.escapeHtml(a.nom)}</span>
                        <span class="attachment-meta">${Utils.formatDate(a.date)} · ${Utils.formatBytes(taille)}</span>
                    </div>
                    <div class="attachment-actions">
                        <button class="btn btn-sm btn-outline" onclick="Factures.ouvrirPieceJointe(${doc.id}, ${idx})" title="Ouvrir">👁️</button>
                        <button class="btn btn-sm btn-outline" onclick="Factures.telechargerPieceJointe(${doc.id}, ${idx})" title="Télécharger">⬇️</button>
                        ${delBtn}
                    </div>
                </div>`;
            }).join('');
        }
        const addBtn = isPaid ? '' : `<button class="btn btn-sm btn-primary" onclick="Factures.ajouterPieceJointe(${doc.id})">📎 Ajouter une pièce jointe</button>`;
        return `<div class="attachments-section">
            <h4>📎 Pièces jointes <span class="att-count">${atts.length}</span></h4>
            <div class="attachments-list">${items}</div>
            <div class="attachments-actions">${addBtn}</div>
        </div>`;
    },

    ajouterPieceJointe(id) {
        const f = this.getById(id);
        if (!f) return Toast.error('Facture introuvable');
        if (f.statut === 'Payée') return Toast.error('Cette facture est payée et ne peut plus être modifiée');

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,.pdf';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const isImage = file.type.startsWith('image/');
                const dataUrl = isImage
                    ? await Utils.compressImage(file)
                    : await Utils.fileToDataUrl(file);

                const att = {
                    id: Utils.generateId(),
                    nom: file.name,
                    type: isImage ? 'image/jpeg' : 'application/pdf',
                    date: new Date().toISOString()
                };

                // Fichiers volumineux → IndexedDB (le localStorage est limité à ~5 Mo).
                // Les petites pièces restent en dataUrl dans le document (affichage + PDF).
                if (dataUrl.length > 2500000) {
                    const storeKey = att.id;
                    const ok = await AttachmentStore.put(storeKey, dataUrl);
                    if (!ok) return Toast.error('Impossible de stocker ce fichier (trop volumineux)');
                    att.storeKey = storeKey;
                    att.size = dataUrl.length; // taille approx. pour l'affichage
                    // Synchroniser la pièce volumineuse vers le cloud (table dédiée)
                    CloudSync.pushAttachment(storeKey, dataUrl, { nom: att.nom, type: att.type });
                } else {
                    att.dataUrl = dataUrl;
                }

                const atts = f.attachments || [];
                atts.push(att);
                try {
                    this.modifier(id, { attachments: atts });
                } catch (e) {
                    if (att.storeKey) {
                        AttachmentStore.remove(att.storeKey);
                        CloudSync.deleteAttachment(att.storeKey); // évite une pièce orpheline dans le cloud
                    }
                    Toast.error('Stockage plein : supprimez d\'autres pièces jointes avant d\'en ajouter');
                    return;
                }
                Toast.success('Pièce jointe ajoutée');
                this.voir(id);
            } catch (err) {
                Toast.error('Erreur lors de l\'ajout de la pièce jointe');
            }
        };
        input.click();
    },

    supprimerPieceJointe(id, idx) {
        const f = this.getById(id);
        if (!f) return Toast.error('Facture introuvable');
        if (f.statut === 'Payée') return Toast.error('Cette facture est payée et ne peut plus être modifiée');
        const atts = f.attachments || [];
        if (idx < 0 || idx >= atts.length) return;
        if (!confirm('Supprimer cette pièce jointe ?')) return;
        const att = atts[idx];
        if (att && att.storeKey) {
            AttachmentStore.remove(att.storeKey); // nettoie IndexedDB
            CloudSync.deleteAttachment(att.storeKey); // nettoie le cloud
        }
        atts.splice(idx, 1);
        this.modifier(id, { attachments: atts });
        Toast.success('Pièce jointe supprimée');
        this.voir(id);
    },

    async telechargerPieceJointe(id, idx) {
        const f = this.getById(id);
        const att = (f.attachments || [])[idx];
        if (!att) return Toast.error('Pièce jointe introuvable');
        try {
            // Les fichiers volumineux sont stockés en IndexedDB : on les recharge
            const dataUrl = att.dataUrl || (att.storeKey ? await AttachmentStore.getWithCloud(att.storeKey) : null);
            if (!dataUrl) return Toast.error('Pièce jointe introuvable');
            const bin = atob(dataUrl.split(',')[1]);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const blob = new Blob([bytes], { type: att.type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = att.nom || 'piece-jointe';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (e) {
            Toast.error('Impossible de télécharger la pièce jointe');
        }
    },

    async ouvrirPieceJointe(id, idx) {
        const f = this.getById(id);
        const att = (f.attachments || [])[idx];
        if (!att) return Toast.error('Pièce jointe introuvable');
        // Les fichiers volumineux sont stockés en IndexedDB (ou sur le cloud) : on les recharge
        const dataUrl = att.dataUrl || (att.storeKey ? await AttachmentStore.getWithCloud(att.storeKey) : null);
        if (!dataUrl) return Toast.error('Pièce jointe introuvable');
        // Convertir en Blob URL pour un affichage fiable (data: URLs trop longues sont bloquées par certains navigateurs)
        try {
            const bin = atob(dataUrl.split(',')[1]);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const blob = new Blob([bytes], { type: att.type });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (e) {
            window.open(dataUrl, '_blank');
        }
    },

    payer(id) {
        const f = this.getById(id);
        if (!f) return Toast.error('Facture introuvable');
        if (this.getStatutReel(f) === 'Payée') {
            Toast.info('Cette facture est déjà payée');
            return;
        }
        const reste = this.getResteAPayer(f);
        if (!confirm(`⚠️ Confirmer le paiement de la facture ${f.reference} ?\n\nMontant restant : ${Utils.formatMoney(reste)}\n\nUne fois marquée payée, la facture sera verrouillée (plus de modification possible).`)) {
            return;
        }
        const paiements = f.paiements || [];
        paiements.push({ id: Utils.generateId(), date: new Date().toISOString().split('T')[0], montant: reste, mode: 'Espèces' });
        this.modifier(id, { paiements, statut: 'Payée' });
        Toast.success('Facture marquée comme payée');
        this.afficher();
        Modal.fermer();
    },

    convertirProforma(id) {
        const facture = this.getById(id);
        if (!facture) return Toast.error('Facture introuvable');

        if (!confirm(`📑 Convertir la facture ${facture.reference} en Facture Pro Forma ?\n\n` +
            `Client : ${facture.clientNom || '-'}\n` +
            `Montant TTC : ${Utils.formatMoney(facture.totalTTC || 0)}\n\n` +
            `Une nouvelle facture pro forma sera créée et la facture sera conservée.`)) {
            return;
        }

        // Copie des données de la facture vers la pro forma
        const proformaData = { ...facture };
        delete proformaData.id;
        delete proformaData.reference;
        delete proformaData.createdAt;
        delete proformaData.paiements;
        delete proformaData.attachments;
        proformaData.statut = 'Pro Forma';

        const saved = ProForma.ajouter(proformaData);
        Toast.success(`Facture convertie en Pro Forma ${saved.reference}`);
        this.afficher();
        Modal.fermer();
    },

    convertirLivraison(id) {
        const facture = this.getById(id);
        if (!facture) return Toast.error('Facture introuvable');

        // Une seule conversion autorisée : un bon de livraison par facture
        const blExistant = Livraisons.getAll().find(l => l.sourceType === 'facture' && String(l.sourceId) === String(id));
        if (blExistant) {
            return Toast.error(`Un bon de livraison existe déjà pour cette facture (${blExistant.reference})`);
        }

        if (!confirm(`📦 Convertir la facture ${facture.reference} en Bon de Livraison ?\n\n` +
            `Client : ${facture.clientNom || '-'}\n` +
            `Articles : ${(facture.lignes || []).length} ligne(s)\n\n` +
            `Un nouveau bon de livraison sera créé et la facture sera conservée.`)) {
            return;
        }

        // Copie des données de la facture vers le bon de livraison (sans prix)
        const livraisonData = { ...facture };
        delete livraisonData.id;
        delete livraisonData.reference;
        delete livraisonData.createdAt;
        delete livraisonData.paiements;
        delete livraisonData.attachments;
        delete livraisonData.statut;
        livraisonData.lignes = (facture.lignes || []).map(l => ({ ...l, prixUnitaire: 0 }));
        // Recalcule les totaux (les prix étant remis à zéro, les totaux le sont aussi)
        const totalsLivraison = Utils.calculateTotals(livraisonData.lignes);
        livraisonData.totalHT = totalsLivraison.totalHT;
        livraisonData.totalTVA = totalsLivraison.totalTVA;
        livraisonData.totalTTC = totalsLivraison.totalTTC;
        livraisonData.sourceType = 'facture';
        livraisonData.sourceId = facture.id;

        const saved = Livraisons.ajouter(livraisonData);
        Toast.success(`Facture convertie en Bon de Livraison ${saved.reference}`);
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
                <td><input type="text" name="unite" class="line-unite" list="unites-list" value="${Utils.escapeHtml(l.unite || '')}" placeholder="Choisir ou saisir une unité"></td>
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
        const container = document.getElementById('lines-container');
        const row = document.createElement('tr');
        row.className = 'line-row';
        row.innerHTML = `
            <td><input type="text" name="designation" class="line-designation" placeholder="Désignation"></td>
            <td><select name="tva" class="line-tva">
                <option value="0">0%</option><option value="7">7%</option><option value="10">10%</option><option value="14">14%</option><option value="20" selected>20%</option>
            </select></td>
            <td><input type="number" name="quantite" class="line-qty" value="1" min="0.01" step="0.01"></td>
            <td><input type="text" name="unite" class="line-unite" list="unites-list" value="" placeholder="Choisir ou saisir une unité"></td>
            <td><input type="number" name="prixUnitaire" class="line-price" value="0" min="0" step="0.01"></td>
            <td class="line-total">0,00 Dhs</td>
            <td><button type="button" class="remove-line-btn" onclick="Factures.supprimerLigne(this)">×</button></td>
        `;
        container.appendChild(row);
        this.actualiserTotaux();
        LineHistory.saveState();
    },

    supprimerLigne(btn) {
        const row = btn.closest('tr');
        if (document.querySelectorAll('.line-row').length > 1) {
            row.remove();
            this.actualiserTotaux();
            LineHistory.saveState();
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
        // Recherche tolérante : l'id peut être numérique, chaîne ou très grand (Date.now())
        const client = Clients.getById(rawClientId) || Clients.getById(parseInt(rawClientId));
        if (!client) return Toast.error('Veuillez sélectionner un client');
        const clientId = client.id;

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
        const id = data.get('id');
        const existing = id ? this.getById(id) : null;
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
            totalTTC: totals.totalTTC
        };
        docData.statut = this.recalculerStatut({ ...(existing || {}), ...docData });

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
        data.attachments = doc.attachments || [];

        await PdfExport.downloadPDF('FACTURE', data, `Facture_${doc.reference}.pdf`);
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
