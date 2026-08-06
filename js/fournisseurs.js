/**
 * FOURNISSEURS - Gestion des fournisseurs
 */
const Fournisseurs = {
    KEY: Database.KEYS.FOURNISSEURS,

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
        Toast.success('Fournisseur supprimé avec succès');
    },

    afficher() {
        const fournisseurs = this.getAll();
        const filter = (document.getElementById('filter-fournisseurs')?.value || '').toLowerCase();
        const filtered = fournisseurs.filter(f => {
            const q = filter;
            return (f.nom || f.raisonSociale || '').toLowerCase().includes(q) ||
                (f.ville || '').toLowerCase().includes(q) ||
                (f.ice || '').toLowerCase().includes(q);
        });

        const container = document.getElementById('fournisseurs-list');
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">Aucun fournisseur trouvé</div>';
            return;
        }

        let html = `<table class="data-table">
            <thead>
                <tr>
                    <th>Fournisseur</th>
                    <th>ICE</th>
                    <th>Téléphone</th>
                    <th>Email</th>
                    <th>Ville</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>`;

        filtered.forEach(f => {
            html += `<tr>
                <td><strong>${Utils.escapeHtml(f.nom || f.raisonSociale || '')}</strong></td>
                <td>${Utils.escapeHtml(f.ice || '-')}</td>
                <td>${Utils.escapeHtml(f.telephone || '-')}</td>
                <td>${Utils.escapeHtml(f.email || '-')}</td>
                <td>${Utils.escapeHtml(f.ville || '-')}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="Fournisseurs.voir(${f.id})">👁️</button>
                    <button class="btn btn-sm btn-primary" onclick="Fournisseurs.editer(${f.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="Fournisseurs.supprimer(${f.id})">🗑️</button>
                </td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    nouveau() {
        Modal.ouvrir('Nouveau Fournisseur', this.getFormHtml());
    },

    editer(id) {
        const fournisseur = this.getById(id);
        if (!fournisseur) return Toast.error('Fournisseur introuvable');
        Modal.ouvrir('Modifier Fournisseur', this.getFormHtml(fournisseur));
    },

    voir(id) {
        const f = this.getById(id);
        if (!f) return Toast.error('Fournisseur introuvable');
        Modal.ouvrir('Détails Fournisseur', `
            <div class="form-row">
                <div class="form-group"><label>Raison Sociale</label><p>${Utils.escapeHtml(f.nom || '-')}</p></div>
                <div class="form-group"><label>ICE</label><p>${Utils.escapeHtml(f.ice || '-')}</p></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Adresse</label><p>${Utils.escapeHtml(f.adresse || '-')}</p></div>
                <div class="form-group"><label>Ville</label><p>${Utils.escapeHtml(f.ville || '-')}</p></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Téléphone</label><p>${Utils.escapeHtml(f.telephone || '-')}</p></div>
                <div class="form-group"><label>Email</label><p>${Utils.escapeHtml(f.email || '-')}</p></div>
            </div>
            <div class="form-actions">
                <button class="btn btn-primary" onclick="Fournisseurs.editer(${f.id})">✏️ Modifier</button>
                <button class="btn btn-outline" onclick="Modal.fermer()">Fermer</button>
            </div>
        `);
    },

    getFormHtml(fournisseur) {
        const f = fournisseur || {};
        return `
            <form id="fournisseur-form" onsubmit="return Fournisseurs.sauvegarder(event)">
                <input type="hidden" name="id" value="${f.id || ''}">
                <div class="form-row">
                    <div class="form-group">
                        <label>Raison Sociale *</label>
                        <input type="text" name="nom" value="${Utils.escapeHtml(f.nom || '')}" required>
                    </div>
                    <div class="form-group">
                        <label>ICE</label>
                        <input type="text" name="ice" value="${Utils.escapeHtml(f.ice || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Adresse</label>
                        <input type="text" name="adresse" value="${Utils.escapeHtml(f.adresse || '')}">
                    </div>
                    <div class="form-group">
                        <label>Ville</label>
                        <input type="text" name="ville" value="${Utils.escapeHtml(f.ville || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Téléphone</label>
                        <input type="tel" name="telephone" value="${Utils.escapeHtml(f.telephone || '')}">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" value="${Utils.escapeHtml(f.email || '')}">
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
        const form = document.getElementById('fournisseur-form');
        const data = new FormData(form);
        const fData = {
            nom: data.get('nom'),
            ice: data.get('ice'),
            adresse: data.get('adresse'),
            ville: data.get('ville'),
            telephone: data.get('telephone'),
            email: data.get('email')
        };

        const id = data.get('id');
        if (id) {
            this.modifier(parseInt(id), fData);
            Toast.success('Fournisseur modifié avec succès');
        } else {
            this.ajouter(fData);
            Toast.success('Fournisseur ajouté avec succès');
        }

        Modal.fermer();
        this.afficher();
        return false;
    },

    filtrer() {
        this.afficher();
    },

    getOptions() {
        const fournisseurs = this.getAll();
        return fournisseurs.map(f =>
            `<option value="${f.id}">${Utils.escapeHtml(f.nom || f.raisonSociale || '')}</option>`
        ).join('');
    },

    getInfo(id) {
        return this.getById(id);
    }
};
