/**
 * CLIENTS - Gestion des clients
 */
const Clients = {
    KEY: Database.KEYS.CLIENTS,

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
        Toast.success('Client supprimé avec succès');
    },

    afficher() {
        const clients = this.getAll();
        const filter = (document.getElementById('filter-clients')?.value || '').toLowerCase();
        const filtered = clients.filter(c =>
            (c.nom || c.raisonSociale || '').toLowerCase().includes(filter)
        );

        const container = document.getElementById('clients-list');
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">Aucun client trouvé</div>';
            return;
        }

        let html = `<table class="data-table">
            <thead>
                <tr>
                    <th>Client</th>
                    <th>ICE</th>
                    <th>Téléphone</th>
                    <th>Email</th>
                    <th>Ville</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>`;

        filtered.forEach(c => {
            html += `<tr>
                <td><strong>${Utils.escapeHtml(c.nom || c.raisonSociale || '')}</strong></td>
                <td>${Utils.escapeHtml(c.ice || '-')}</td>
                <td>${Utils.escapeHtml(c.telephone || '-')}</td>
                <td>${Utils.escapeHtml(c.email || '-')}</td>
                <td>${Utils.escapeHtml(c.ville || '-')}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="Clients.voir(${c.id})">👁️</button>
                    <button class="btn btn-sm btn-primary" onclick="Clients.editer(${c.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="Clients.supprimer(${c.id})">🗑️</button>
                </td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    nouveau() {
        Modal.ouvrir('Nouveau Client', this.getFormHtml());
    },

    editer(id) {
        const client = this.getById(id);
        if (!client) return Toast.error('Client introuvable');
        Modal.ouvrir('Modifier Client', this.getFormHtml(client));
    },

    voir(id) {
        const c = this.getById(id);
        if (!c) return Toast.error('Client introuvable');
        Modal.ouvrir('Détails Client', `
            <div class="detail-view">
                <div class="form-row">
                    <div class="form-group"><label>Raison Sociale</label><p>${Utils.escapeHtml(c.nom || '-')}</p></div>
                    <div class="form-group"><label>ICE</label><p>${Utils.escapeHtml(c.ice || '-')}</p></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Adresse</label><p>${Utils.escapeHtml(c.adresse || '-')}</p></div>
                    <div class="form-group"><label>Ville</label><p>${Utils.escapeHtml(c.ville || '-')}</p></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Téléphone</label><p>${Utils.escapeHtml(c.telephone || '-')}</p></div>
                    <div class="form-group"><label>Email</label><p>${Utils.escapeHtml(c.email || '-')}</p></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>RC</label><p>${Utils.escapeHtml(c.rc || '-')}</p></div>
                    <div class="form-group"><label>IF</label><p>${Utils.escapeHtml(c.if || '-')}</p></div>
                </div>
            </div>
            <div class="form-actions">
                <button class="btn btn-primary" onclick="Clients.editer(${c.id})">✏️ Modifier</button>
                <button class="btn btn-outline" onclick="Modal.fermer()">Fermer</button>
            </div>
        `);
    },

    getFormHtml(client) {
        const c = client || {};
        return `
            <form id="client-form" onsubmit="return Clients.sauvegarder(event)">
                <input type="hidden" name="id" value="${c.id || ''}">
                <div class="form-row">
                    <div class="form-group">
                        <label>Raison Sociale *</label>
                        <input type="text" name="nom" value="${Utils.escapeHtml(c.nom || '')}" required>
                    </div>
                    <div class="form-group">
                        <label>ICE</label>
                        <input type="text" name="ice" value="${Utils.escapeHtml(c.ice || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Adresse</label>
                        <input type="text" name="adresse" value="${Utils.escapeHtml(c.adresse || '')}">
                    </div>
                    <div class="form-group">
                        <label>Ville</label>
                        <input type="text" name="ville" value="${Utils.escapeHtml(c.ville || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Téléphone</label>
                        <input type="tel" name="telephone" value="${Utils.escapeHtml(c.telephone || '')}">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" value="${Utils.escapeHtml(c.email || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>RC</label>
                        <input type="text" name="rc" value="${Utils.escapeHtml(c.rc || '')}">
                    </div>
                    <div class="form-group">
                        <label>IF</label>
                        <input type="text" name="if" value="${Utils.escapeHtml(c['if'] || '')}">
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
        const form = document.getElementById('client-form');
        const data = new FormData(form);
        const clientData = {
            nom: data.get('nom'),
            ice: data.get('ice'),
            adresse: data.get('adresse'),
            ville: data.get('ville'),
            telephone: data.get('telephone'),
            email: data.get('email'),
            rc: data.get('rc'),
            if: data.get('if')
        };

        const id = data.get('id');
        if (id) {
            this.modifier(parseInt(id), clientData);
            Toast.success('Client modifié avec succès');
        } else {
            this.ajouter(clientData);
            Toast.success('Client ajouté avec succès');
        }

        Modal.fermer();
        this.afficher();
        return false;
    },

    filtrer() {
        this.afficher();
    },

    /**
     * Get clients as options for select dropdown
     */
    getOptions() {
        const clients = this.getAll();
        return clients.map(c =>
            `<option value="${c.id}">${Utils.escapeHtml(c.nom || c.raisonSociale || '')}</option>`
        ).join('');
    },

    /**
     * Get client info for invoice/order forms
     */
    getInfo(id) {
        return this.getById(id);
    }
};
