/**
 * CONTACTS — Liste maîtresse des sociétés (clients ET/OU fournisseurs)
 * ─────────────────────────────────────────────────────────────────────────────
 * La liste « Contacts » regroupe toutes les sociétés (importées depuis
 * js/import-liste.js ou ajoutées manuellement). Pour chaque contact,
 * l'utilisateur choisit son rôle : 👥 Client, 🏭 Fournisseur, les deux,
 * ou aucun.
 *
 * Chaque choix met à jour automatiquement :
 *   • la collection Clients  (eqnovia_clients)   → factures, devis, livraisons,
 *     pro forma ;
 *   • la collection Fournisseurs (eqnovia_fournisseurs) → bons de commande.
 *
 * Les écritures passent par Database.set, donc la synchronisation Supabase
 * (CloudSync) est déclenchée automatiquement.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const Contacts = {
    KEY: Database.KEYS.CONTACTS,

    getAll() {
        return Database.get(this.KEY) || [];
    },

    getById(id) {
        return Database.findById(this.KEY, id);
    },

    afficher() {
        const contacts = this.getAll();
        const filter = (document.getElementById('filter-contacts')?.value || '').toLowerCase();
        const filtered = contacts.filter(c => {
            const q = filter;
            return (c.nom || '').toLowerCase().includes(q) ||
                (c.ville || '').toLowerCase().includes(q) ||
                (c.ice || '').toLowerCase().includes(q);
        });

        const container = document.getElementById('contacts-list');
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">' +
                (contacts.length === 0
                    ? 'Aucun contact pour le moment. Cliquez sur « + Nouveau Contact » ou « 📥 Importer la liste ».'
                    : 'Aucun contact trouvé') +
                '</div>';
            return;
        }

        let html = `<table class="data-table">
            <thead>
                <tr>
                    <th>Contact</th>
                    <th>Ville</th>
                    <th>ICE</th>
                    <th>Type</th>
                    <th>Choisir le type</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>`;

        filtered.forEach(c => {
            const estClient = !!c.estClient;
            const estFourn = !!c.estFournisseur;

            let badge;
            if (estClient && estFourn) {
                badge = '<span class="status-badge badge-lesdeux">Client + Fournisseur</span>';
            } else if (estClient) {
                badge = '<span class="status-badge badge-client">Client</span>';
            } else if (estFourn) {
                badge = '<span class="status-badge badge-fournisseur">Fournisseur</span>';
            } else {
                badge = '<span class="status-badge badge-aucun">Aucun</span>';
            }

            html += `<tr>
                <td><strong>${Utils.escapeHtml(c.nom || '')}</strong></td>
                <td>${Utils.escapeHtml(c.ville || '-')}</td>
                <td>${Utils.escapeHtml(c.ice || '-')}</td>
                <td>${badge}</td>
                <td class="actions">
                    <button class="btn-role ${estClient ? 'on-client' : ''}" onclick="Contacts.basculerClient(${c.id})" title="Ajouter / retirer comme Client (factures, devis, livraisons...)">👥 Client</button>
                    <button class="btn-role ${estFourn ? 'on-fournisseur' : ''}" onclick="Contacts.basculerFournisseur(${c.id})" title="Ajouter / retirer comme Fournisseur (bons de commande)">🏭 Fournisseur</button>
                </td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="Contacts.editer(${c.id})" title="Modifier le contact">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="Contacts.supprimer(${c.id})" title="Supprimer le contact">🗑️</button>
                </td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    filtrer() {
        this.afficher();
    },

    nouveau() {
        Modal.ouvrir('Nouveau Contact', this.getFormHtml());
    },

    editer(id) {
        const contact = this.getById(id);
        if (!contact) return Toast.error('Contact introuvable');
        Modal.ouvrir('Modifier Contact', this.getFormHtml(contact));
    },

    /** Formulaire de création / édition d'un contact (avec choix du type). */
    getFormHtml(contact) {
        const c = contact || {};
        const estClient = !!c.estClient;
        const estFourn = !!c.estFournisseur;
        const typeVal = (estClient && estFourn) ? 'lesdeux' : (estClient ? 'client' : (estFourn ? 'fournisseur' : ''));
        const sel = v => v === typeVal ? ' selected' : '';
        return `
            <form id="contact-form" onsubmit="return Contacts.sauvegarder(event)">
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
                        <label>Type</label>
                        <select name="type">
                            <option value=""${sel('')}>Aucun (simple contact)</option>
                            <option value="client"${sel('client')}>👥 Client</option>
                            <option value="fournisseur"${sel('fournisseur')}>🏭 Fournisseur</option>
                            <option value="lesdeux"${sel('lesdeux')}>👥 Client + 🏭 Fournisseur</option>
                        </select>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">💾 Enregistrer</button>
                    <button type="button" class="btn btn-outline" onclick="Modal.fermer()">Annuler</button>
                </div>
            </form>
        `;
    },

    /** Enregistre le contact (création ou modification) et applique son type. */
    sauvegarder(event) {
        event.preventDefault();
        const form = document.getElementById('contact-form');
        const data = new FormData(form);

        const nom = String(data.get('nom') || '').trim();
        if (!nom) return Toast.error('Le nom du contact est obligatoire');

        const type = String(data.get('type') || '');
        const infos = {
            nom,
            adresse: String(data.get('adresse') || '').trim(),
            ville: String(data.get('ville') || '').trim(),
            ice: String(data.get('ice') || '').trim()
        };

        const id = data.get('id');
        let contact;
        if (id) {
            contact = this.getById(id);
            if (!contact) return Toast.error('Contact introuvable');
            Object.assign(contact, infos);
            Database.update(this.KEY, contact.id, infos);
        } else {
            contact = Database.add(this.KEY, infos);
        }

        // Applique le type choisi
        contact.estClient = type === 'client' || type === 'lesdeux';
        contact.estFournisseur = type === 'fournisseur' || type === 'lesdeux';
        this._syncRole(contact, 'client');
        this._syncRole(contact, 'fournisseur');
        this._sauvegarder(contact);

        Modal.fermer();
        this.afficher();
        Toast.success(id ? '✏️ Contact modifié avec succès' : '✅ Contact ajouté avec succès');
        return false;
    },

    /** Supprime le contact et retire son client/fournisseur lié. */
    supprimer(id) {
        const contact = this.getById(id);
        if (!contact) return Toast.error('Contact introuvable');
        if (!confirm(`🗑️ Supprimer le contact « ${contact.nom} » ?\n\nIl sera aussi retiré des listes Clients / Fournisseurs si relié.`)) return;

        contact.estClient = false;
        contact.estFournisseur = false;
        this._syncRole(contact, 'client');
        this._syncRole(contact, 'fournisseur');
        Database.delete(this.KEY, id);
        this.afficher();
        Toast.success('🗑️ Contact supprimé avec succès');
    },

    /** Active/désactive le rôle « Client » du contact et synchronise la liste Clients. */
    basculerClient(id) {
        const contact = this.getById(id);
        if (!contact) return Toast.error('Contact introuvable');
        contact.estClient = !contact.estClient;
        this._syncRole(contact, 'client');
        this._sauvegarder(contact);
        this.afficher();
        Toast.success(contact.estClient
            ? `👥 « ${contact.nom} » est maintenant un Client`
            : `👥 « ${contact.nom} » n'est plus un Client`);
    },

    /** Active/désactive le rôle « Fournisseur » du contact et synchronise la liste Fournisseurs. */
    basculerFournisseur(id) {
        const contact = this.getById(id);
        if (!contact) return Toast.error('Contact introuvable');
        contact.estFournisseur = !contact.estFournisseur;
        this._syncRole(contact, 'fournisseur');
        this._sauvegarder(contact);
        this.afficher();
        Toast.success(contact.estFournisseur
            ? `🏭 « ${contact.nom} » est maintenant un Fournisseur`
            : `🏭 « ${contact.nom} » n'est plus un Fournisseur`);
    },

    /** Enregistre le contact (rôles + liens) dans la collection Contacts. */
    _sauvegarder(contact) {
        Database.update(this.KEY, contact.id, {
            estClient: !!contact.estClient,
            estFournisseur: !!contact.estFournisseur,
            clientId: contact.clientId || null,
            fournisseurId: contact.fournisseurId || null
        });
    },

    /**
     * Aligne la collection Clients/Fournisseurs sur le rôle choisi :
     *  - rôle actif  → crée la fiche si elle n'existe pas (ou la relie à une fiche de même nom)
     *  - rôle inactif → retire la fiche liée
     * @param {object} contact Le contact concerné
     * @param {'client'|'fournisseur'} role Le rôle à synchroniser
     */
    _syncRole(contact, role) {
        const estClient = role === 'client';
        const KEY = estClient ? Database.KEYS.CLIENTS : Database.KEYS.FOURNISSEURS;
        const flag = estClient ? 'estClient' : 'estFournisseur';
        const idField = estClient ? 'clientId' : 'fournisseurId';
        const col = Database.get(KEY) || [];

        if (contact[flag]) {
            // Déjà relié à une fiche valide → rien à faire
            if (contact[idField] && col.some(x => String(x.id) === String(contact[idField]))) return;
            // Une fiche du même nom existe déjà → relier sans doublon
            const parNom = col.find(x => String(x.nom || '').trim().toLowerCase() === String(contact.nom).trim().toLowerCase());
            if (parNom) { contact[idField] = parNom.id; return; }
            // Créer la fiche avec le même id que le contact (les références restent valides)
            const nouveau = {
                id: contact.id,
                nom: contact.nom,
                adresse: contact.adresse || '',
                ville: contact.ville || '',
                ice: contact.ice || '',
                createdAt: new Date().toISOString()
            };
            Database.set(KEY, [nouveau, ...col]);
            contact[idField] = contact.id;
        } else if (contact[idField]) {
            Database.set(KEY, col.filter(x => String(x.id) !== String(contact[idField])));
            contact[idField] = null;
        }
    }
};
