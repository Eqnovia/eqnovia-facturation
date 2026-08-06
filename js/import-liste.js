/**
 * IMPORT LISTE — Import en un clic de la liste des contacts Eqnovia
 * ─────────────────────────────────────────────────────────────────────────────
 * Liste fournie par l'utilisateur (nom, adresse, ville, ICE).
 * Le bouton « 📥 Importer la liste » (section Contacts) ajoute toutes les
 * sociétés manquantes dans la liste maîtresse CONTACTS — sans doublons
 * (comparaison par raison sociale, insensible à la casse).
 *
 * Pour chaque contact, l'utilisateur choisit ensuite son rôle :
 *   👥 Client, 🏭 Fournisseur, les deux, ou aucun (voir js/contacts.js).
 * Si un client/fournisseur portant le même nom existe déjà, le contact est
 * relié automatiquement (pas de doublon).
 *
 * La synchronisation Supabase (CloudSync) est déclenchée automatiquement
 * par Database.set : les données importées sont donc envoyées au cloud.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const ImportListe = {

    /**
     * Les 46 sociétés : [raison sociale, adresse, ville, ICE]
     * (les lignes sans nom de la liste d'origine ont été ignorées)
     */
    _donnees: [
        ['Frigo 2020', 'Sidi Bibi', 'Agadir', '001574891000027'],
        ['Larbi Laraichi', 'Plaisance', 'Meknès', ''],
        ['Terroir Dakhla SARL AU', 'Av. El Walaa Hay Kassam 2. N203', 'Dakhla', '002726389000021'],
        ['M. Amar Abdelbaki', '', 'Berrechid', ''],
        ['Bakrifil', 'Douar Ould Azouz Km 15 N°8 Dar Bouazza Rte El Jadida - Casablanca', 'Casablanca', '001540357000081'],
        ['M. Chakib Yassir', '', 'Mohammedia', ''],
        ['MOROCCAN PRIVATE PARTNERS', 'N19 Rue Azzenbak Hay Raha Quartier Beausejour', 'Casablanca', '000197083000082'],
        ['Cleanergy', '195/206 Zone Industrielle S, Nouaceur Maroc', 'Nouaceur', '000030315000078'],
        ['M. Abdesslam Ajana', '', 'Casablanca', ''],
        ['Yomar', '4-5 Route 1077, Quartier Industriel Lissasfa Zone 1', 'Casablanca', '001524588000014'],
        ['Rouamzine SARL', '10 Rue Oued Zem', 'Casablanca', '001334840000058'],
        ['Serenity Days', '', 'Marrakech', '002397988000078'],
        ['Zouhabina', '', 'Rabat', '000048887000027'],
        ['Contifibre', 'Zone Industriel El Jadida, lot 355 Rue n14', 'El Jadida', '002878103000053'],
        ['Mme Latifa Hajjaj', '', 'Marrakech', ''],
        ['Résidence Benjdya', '', 'Bouskoura', ''],
        ['Solarway', '8, Lotissement "LA COLLINE", Sidi Maarouf', 'Casablanca', '000204193000075'],
        ['M. Amar Belkassem', '', 'Casablanca', ''],
        ['Résidence Souissi', '', 'Rabat', ''],
        ['Unité industrielle', '', 'Agadir', ''],
        ['Résidence Amine Lahlou', '', 'Bouskoura', ''],
        ['Freeray', 'Route Sidi Yahia Zair (Ghboula), Témara', 'Rabat', '001445583000022'],
        ['Ayouma Prim', 'Z.I Ait Melloul', 'Ait Melloul', '001447721000011'],
        ['Tube et Profil', 'RN9 - Sidi Hajjaj, Oued Hessar 20640, Tit Mellil - Maroc', 'Tit Mellil', '001513983000005'],
        ['BELTEGEUSE', 'AV Alijtihad Bloc J N°82 CYM', 'Rabat', '003778711000082'],
        ['ECO TRANSFO', '', 'Had Soualem', '000008172000031'],
        ['Disway', 'Lotissement La Colline II N°8 Sidi Maarouf 20150', 'Casablanca', '001527235000034'],
        ['Unimagec', 'Lot.793/B, Av Al Mouquaouama (route Admim) B.P. 1322, CP. 80152 - (Z.I), Ait Melloul - Agadir', 'Agadir', '001534401000067'],
        ['Batitherm', '82, Bd Sidi Abderrahmane Beauséjour', 'Casablanca', '000079287000041'],
        ['M. Abdelhamid Souiri', 'Californie', 'Casablanca', ''],
        ['M. Othmane Benhallam', '', 'Marrakech', ''],
        ['Sunrack Engineering', 'Place Roudani, rue Abdellah El Habti, rés. Alqods n° 35 90000', 'Tanger', '003488485000039'],
        ['Green Elec Sàrl', '23 Allée des Orangers, Ain Sbaa', 'Casablanca', '000221725000071'],
        ['Compagnie Agricole de Loukkous', 'Route de Rabat, Laarouarma', 'Larache', '001578480000027'],
        ['Riva Industries', '31 Marina Center, Angle Bd Zerktouni et Bd de la Corniche, 5e étage', 'Casablanca', '000098419000002'],
        ['Wafabail pour le compte de Contifibre', 'Bd My Youssef', '', '000083825000026'],
        ['Saham Leasing pour le compte de Tube et Profil', '374, Boulevard Abdelmoumen Etage 1 Apprt E Lots Manazyl Maymoun', 'Casablanca', '001542892000021'],
        ['EMOVE VEHICLES COMPANY', '59, Bd.de la Girond - Casablanca', 'Casablanca', '002456809000092'],
        ['SOFAS', 'ZI MEJAT N°379 & 380 BP 7551 - 50000 MEKNES (M) - Maroc', 'Meknès', '001663376000042'],
        ['HYFROS', 'Zone Portuaire 92000', 'Larache', '000159022000014'],
        ['AKWEL EL JADIDA MOROCCO', 'Zone industrielle El Jadida, lot. 108 24040', 'El Jadida', '000089736000091'],
        ['APAVE MAROC', 'Immeuble 5 de zénith Millenium au 3ème étage Sidi Maarouf', 'Casablanca', '002903855000045'],
        ['H&P PROTECTION', '77 rue Mohammed Smiha, étg 10 Apt 57', 'Casablanca', '003630679000061'],
        ['Sirmel', '317, Boulevard Oqba Ben Nafii', 'Casablanca', '001537180000015'],
        ['CEM', '7 rue al kamit al assadi Belvédère', 'Casablanca', '002576885000071'],
        ['Dardis', '34 BD Moulay Slimane', 'Casablanca', '000006112000070']
    ],

    /**
     * Ajoute les sociétés manquantes dans la liste Contacts.
     * Demande confirmation, évite les doublons par raison sociale,
     * relie automatiquement les contacts déjà présents comme Client
     * ou Fournisseur, puis rafraîchit la liste (synchro cloud auto).
     */
    importer() {
        const KEY = Database.KEYS.CONTACTS;

        // Noms déjà présents dans les contacts
        const existants = new Set();
        (Database.get(KEY) || []).forEach(c => {
            const n = String(c.nom || '').trim().toLowerCase();
            if (n) existants.add(n);
        });

        // Clients / fournisseurs déjà enregistrés (pour le lien automatique)
        const clients = Database.get(Database.KEYS.CLIENTS) || [];
        const fournisseurs = Database.get(Database.KEYS.FOURNISSEURS) || [];

        // Sélection des contacts à ajouter
        const aAjouter = [];
        let dejaPresent = 0;
        this._donnees.forEach(entree => {
            const [nom, adresse, ville, ice] = entree;
            const cle = nom.trim().toLowerCase();
            if (existants.has(cle)) { dejaPresent++; return; }
            existants.add(cle);

            const contact = {
                nom: nom.trim(),
                adresse: adresse.trim(),
                ville: ville.trim(),
                ice: ice.trim(),
                estClient: false,
                estFournisseur: false,
                clientId: null,
                fournisseurId: null
            };

            // Lien automatique avec un client existant de même nom
            const cl = clients.find(c => String(c.nom || '').trim().toLowerCase() === cle);
            if (cl) { contact.estClient = true; contact.clientId = cl.id; }
            // Lien automatique avec un fournisseur existant de même nom
            const fo = fournisseurs.find(f => String(f.nom || '').trim().toLowerCase() === cle);
            if (fo) { contact.estFournisseur = true; contact.fournisseurId = fo.id; }

            aAjouter.push(contact);
        });

        if (aAjouter.length === 0) {
            Toast.info('📥 Aucun nouveau contact à importer — la liste Contacts est déjà à jour.');
            return;
        }

        const nb = aAjouter.length;
        const relies = aAjouter.filter(c => c.estClient || c.estFournisseur).length;
        const message = `📥 Importer ${nb} contact${nb > 1 ? 's' : ''} dans la liste Contacts ?`
            + (relies > 0
                ? `\n\n(${relies} déjà présent${relies > 1 ? 's' : ''} comme Client/Fournisseur seront reliés automatiquement.)`
                : '')
            + (dejaPresent > 0
                ? `\n(${dejaPresent} déjà dans Contacts seront ignorés — pas de doublons.)`
                : '');
        if (!confirm(message)) return;

        // Identifiants uniques et date de création
        const base = Date.now();
        aAjouter.forEach((c, i) => {
            c.id = base + i;
            c.createdAt = new Date().toISOString();
        });

        // Enregistre une seule fois (déclenche UNE synchronisation cloud)
        const col = Database.get(KEY) || [];
        Database.set(KEY, [...aAjouter, ...col]);

        // Rafraîchit l'affichage si la section Contacts est visible
        Contacts.afficher();
        const synchro = (typeof CloudSync !== 'undefined' && CloudSync.enabled)
            ? ' Envoyé au cloud ☁️.'
            : ' (mode local — cloud ☁️ non connecté).';
        Toast.success(`✅ ${nb} contact${nb > 1 ? 's' : ''} importé${nb > 1 ? 's' : ''} !${synchro}`);
    }
};
