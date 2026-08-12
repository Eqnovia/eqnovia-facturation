/**
 * SERVICES - Gestion des services (ex-produits)
 */
const Produits = {
    KEY: Database.KEYS.PRODUITS,

    getAll() {
        return Database.get(this.KEY) || [];
    },

    getById(id) {
        return Database.findById(this.KEY, id);
    },

    ajouter(data) {
        return Database.add(this.KEY, data);
    },

    modifier(id, data) {
        return Database.update(this.KEY, id, data);
    },

    supprimer(id) {
        Database.delete(this.KEY, id);
        this.afficher();
        Toast.success('Service supprimé avec succès');
    },

    afficher() {
        const produits = this.getAll();
        const filter = (document.getElementById('filter-produits')?.value || '').toLowerCase();
        const filtered = produits.filter(p =>
            (p.designation || '').toLowerCase().includes(filter)
        );

        const container = document.getElementById('produits-list');
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">Aucun service trouvé</div>';
            return;
        }

        let html = `<table class="data-table">
            <thead>
                <tr>
                    <th>Désignation</th>
                    <th>Référence</th>
                    <th>Prix HT</th>
                    <th>TVA</th>
                    <th>Unité</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>`;

        filtered.forEach(p => {
            html += `<tr>
                <td><strong>${Utils.escapeHtml(p.designation || '')}</strong></td>
                <td>${Utils.escapeHtml(p.reference || '-')}</td>
                <td>${Utils.formatMoney(p.prixUnitaire || 0)}</td>
                <td>${p.tva || 0}%</td>
                <td>${Utils.escapeHtml(p.unite || 'Pièce')}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-primary" onclick="Produits.editer(${p.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="Produits.supprimer(${p.id})">🗑️</button>
                </td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    nouveau() {
        Modal.ouvrir('Nouveau Service', this.getFormHtml());
    },

    editer(id) {
        const produit = this.getById(id);
        if (!produit) return Toast.error('Service introuvable');
        Modal.ouvrir('Modifier Service', this.getFormHtml(produit));
    },

    getFormHtml(produit) {
        const p = produit || {};
        return `
            <form id="produit-form" onsubmit="return Produits.sauvegarder(event)">
                <input type="hidden" name="id" value="${p.id || ''}">
                <div class="form-row">
                    <div class="form-group">
                        <label>Désignation *</label>
                        <input type="text" name="designation" value="${Utils.escapeHtml(p.designation || '')}" required>
                    </div>
                    <div class="form-group">
                        <label>Référence</label>
                        <input type="text" name="reference" value="${Utils.escapeHtml(p.reference || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Prix unitaire HT *</label>
                        <input type="number" name="prixUnitaire" step="0.01" min="0" value="${p.prixUnitaire || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>TVA (%)</label>
                        <select name="tva">
                            <option value="0" ${p.tva == 0 ? 'selected' : ''}>0%</option>
                            <option value="7" ${p.tva == 7 ? 'selected' : ''}>7%</option>
                            <option value="10" ${p.tva == 10 ? 'selected' : ''}>10%</option>
                            <option value="14" ${p.tva == 14 ? 'selected' : ''}>14%</option>
                            <option value="20" ${p.tva == 20 ? 'selected' : ''}>20%</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Unité</label>
                        <input type="text" name="unite" list="unites-list" value="${Utils.escapeHtml(p.unite || '')}" placeholder="Choisir ou saisir une unité">
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">💾 Enregistrer</button>
                    <button type="button" class="btn btn-outline" onclick="Modal.fermer()">Annuler</button>
                </div>
            </form>
        `;
    },

    sauvegarder(event) {
        event.preventDefault();
        const form = document.getElementById('produit-form');
        const data = new FormData(form);
        const pData = {
            designation: data.get('designation'),
            reference: data.get('reference'),
            prixUnitaire: parseFloat(data.get('prixUnitaire')) || 0,
            tva: parseInt(data.get('tva')) || 0,
            unite: data.get('unite') || 'Pièce'
        };

        const id = data.get('id');
        if (id) {
            this.modifier(parseInt(id), pData);
            Toast.success('Service modifié avec succès');
        } else {
            this.ajouter(pData);
            Toast.success('Service ajouté avec succès');
        }

        Modal.fermer();
        this.afficher();
        return false;
    },

    filtrer() {
        this.afficher();
    }
};
