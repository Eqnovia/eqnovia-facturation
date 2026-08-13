/**
 * PDF EXPORT - Generate professional PDF documents matching the imported Excel-based PDF format
 * Supports: Factures, Devis, Commandes, Livraisons, Pro Forma
 * Also handles Excel export via SheetJS
 */

const PdfExport = {
    // Company info from database
    getCompany() {
        return Database.get(Database.KEYS.COMPANY) || {
            nom: 'Eqnovia',
            adresse: '20 rue Moussa Bnou Noussair',
            ville: 'Casablanca',
            website: 'www.eqnovia.ma',
            ice: '001445583000022',
            rc: '236357',
            if: '40397283',
            tp: '35546302',
            capital: '2 000 000 Dhs'
        };
    },

    /**
     * Generate a PDF document matching the imported Excel-based PDF format
     * @param {string} docType - Type of document (FACTURE, BON DE COMMANDE, etc.)
     * @param {object} data - Document data with client, lines, totals, etc.
     */
    async generatePDF(docType, data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
        const company = this.getCompany();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - 2 * margin;
        // Factures et Devis : mise en page compacte pour tenir sur une seule page A4
        const compact = docType === 'FACTURE' || docType === 'DEVIS';
        let y = margin;

        // Set PDF metadata
        doc.setProperties({
            title: `${docType} - ${data.reference}`,
            subject: `${docType} - ${data.clientNom || ''}`,
            author: company.nom,
            creator: `${company.nom} - Système de Facturation`,
            keywords: `${docType}, ${data.reference}, ${company.nom}`
        });
        doc.setDisplayMode('fullheight', 'continuous');

        // ===== TOP: Logo (left) + Title (right) =====
        try {
            const logoBase64 = this.getLogoBase64();
            if (logoBase64) {
                doc.addImage(logoBase64, 'PNG', margin - 2, y - 7, 45, 15, undefined, 'FAST');
            }
        } catch (e) {}

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(docType.toUpperCase(), pageWidth - margin, y + 5, { align: 'right' });

        // (Accent bar removed per user request)

        // ===== TWO-COLUMN: Company (left) + Client (right) =====
        y += 14;

        const col1X = margin;
        // --- Company Info (left) ---
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(company.nom, col1X, y);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(60, 60, 60);
        const companyAddrY = y + 4.5;
        doc.text(company.adresse, col1X, companyAddrY);
        doc.text(company.ville, col1X, companyAddrY + 4.5);
        doc.text(`ICE : ${company.ice} / RC : ${company.rc}`, col1X, companyAddrY + 9);
        doc.text(company.website, col1X, companyAddrY + 13.5);

        const companyEndY = companyAddrY + 14;

        // --- Client Info (right column, aligned to the right) ---
        const rightWidth = contentWidth / 2 - 2;
        const clientRightX = pageWidth - margin; // right edge

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(data.clientNom || '', clientRightX, y, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(60, 60, 60);
        let clientLineY = y + 4.5;
        if (data.clientAdresse) {
            const addrLines = data.clientAdresse.split('\n').filter(l => l.trim());
            addrLines.forEach((line, idx) => {
                doc.text(line, clientRightX, clientLineY + idx * 4.5, { align: 'right' });
            });
            clientLineY += addrLines.length * 4.5;
        }
        if (data.clientVille) {
            doc.text(data.clientVille, clientRightX, clientLineY, { align: 'right' });
            clientLineY += 4.5;
        }
        if (data.clientIce) {
            doc.text(`ICE : ${data.clientIce}`, clientRightX, clientLineY, { align: 'right' });
            clientLineY += 4.5;
        }
        if (data.clientRC) {
            doc.text(`RC : ${data.clientRC}`, clientRightX, clientLineY, { align: 'right' });
            clientLineY += 4.5;
        }

        // ===== DATE & REFERENCE (below the two columns) =====
        y = Math.max(companyEndY, clientLineY) + (compact ? 4 : 6);

        const dateLabels = {
            'FACTURE': 'Date de facturation :',
            'FACTURE PRO FORMA': 'Date de facturation :',
            'BON DE COMMANDE': 'Date de commande :',
            'DEVIS': 'Date du devis :',
            'BON DE LIVRAISON': 'Date de livraison :'
        };
        const dateLabel = dateLabels[docType] || 'Date :';
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(60, 60, 60);
        doc.text(`${dateLabel}  ${data.date}`, col1X, y);
        doc.text(`Référence :  ${data.reference}`, pageWidth - margin, y, { align: 'right' });

        // Date de livraison (optionnelle) : uniquement pour les bons de commande
        if (docType === 'BON DE COMMANDE' && data.dateLivraison) {
            doc.text(`Date de livraison :  ${data.dateLivraison}`, col1X, y + 4.5);
            y += 4.5;
        }

        y += (docType === 'FACTURE' ? 9 : (compact ? 5 : 7)); // Plus d'espace entre l'entête et l'Objet pour les factures

        // ===== OBJET =====
        if (data.objet) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8.5);
            doc.setTextColor(60, 60, 60);
            const objetLines = doc.splitTextToSize(`Objet : ${data.objet}`, contentWidth);
            objetLines.forEach((line, idx) => {
                doc.text(line, col1X, y + idx * 4);
            });
            y += objetLines.length * (compact ? 3.5 : 4) + (compact ? 3 : 4);
        }

        // ===== "Montants exprimés en Dhs" =====
        y += 2;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('Montants exprimés en Dhs', pageWidth - margin, y, { align: 'right' });

        y += (compact ? 4 : 6);

        // ===== LINES TABLE (centered via autoTable margins) =====
        const tableHeader = [
            { content: 'Désignation', options: { halign: 'center' } },
            { content: '% TVA', options: { halign: 'center' } },
            { content: 'Montant TVA', options: { halign: 'center' } },
            { content: 'Qté', options: { halign: 'center' } },
            { content: 'Unité', options: { halign: 'center' } },
            { content: 'Prix unitaire HT', options: { halign: 'center' } },
            { content: 'Prix total HT', options: { halign: 'center' } }
        ];

        const tableData = data.lines.map(line => {
            const qty = line.quantite || 0;
            const pu = line.prixUnitaire || 0;
            const tva = line.tva || 0;
            const totalHT = qty * pu;
            const montantTVA = totalHT * tva / 100;
            return [
                line.designation || '',
                tva + '%',
                this.formatNumber(montantTVA),
                qty,
                line.unite || '',
                this.formatNumber(pu),
                this.formatNumber(totalHT)
            ];
        });

        // Table centered: add extra left margin to push it toward center
        const tableMargin = 6;

        doc.autoTable({
            head: [tableHeader],
            body: tableData,
            startY: y,
            margin: { left: margin + tableMargin / 2, right: margin + tableMargin / 2, top: 28 },
            tableWidth: contentWidth - tableMargin,
            theme: 'grid',
            didDrawPage: (tableData) => {
                // Mini en-tête répété sur les pages suivantes (documents multi-pages)
                if (tableData.pageNumber > 1) {
                    try {
                        const logoBase64 = this.getLogoBase64();
                        if (logoBase64) {
                            doc.addImage(logoBase64, 'PNG', margin - 2, 8, 35, 11, undefined, 'FAST');
                        }
                    } catch (e) {}
                    doc.setTextColor(0, 0, 0);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(11);
                    doc.text(docType.toUpperCase(), pageWidth - margin, 13, { align: 'right' });
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);
                    doc.setTextColor(100, 100, 100);
                    doc.text(`Réf : ${data.reference || ''}`, pageWidth - margin, 18, { align: 'right' });
                    doc.setDrawColor(200, 200, 200);
                    doc.setLineWidth(0.3);
                    doc.line(margin, 22, pageWidth - margin, 22);
                }
            },
            tableLineColor: [150, 150, 150],
            tableLineWidth: 0.4,
            headStyles: {
                fillColor: [248, 248, 250],
                textColor: [30, 30, 30],
                fontStyle: 'bold',
                fontSize: compact ? 7.5 : 8,
                lineColor: [150, 150, 150],
                lineWidth: 0.4,
                cellPadding: compact ? 2 : 3.5
            },
            bodyStyles: {
                fontSize: compact ? 7.5 : 8,
                textColor: [40, 40, 40],
                fillColor: [255, 255, 255],
                lineColor: [190, 190, 190],
                lineWidth: 0.3,
                cellPadding: compact ? 1.5 : 3
            },
            alternateRowStyles: {
                fillColor: [242, 244, 248]
            },
            columnStyles: {
                0: { cellWidth: 'auto', halign: 'center' },
                1: { cellWidth: 17, halign: 'center' },
                2: { cellWidth: 26, halign: 'center' },
                3: { cellWidth: 13, halign: 'center' },
                4: { cellWidth: 14, halign: 'center' },
                5: { cellWidth: 30, halign: 'center' },
                6: { cellWidth: 30, halign: 'center' }
            }
        });

        let tableEndY = doc.lastAutoTable.finalY;

        // ===== BLOC BAS : banque (gauche) + totaux (droite) au même niveau + suivi des paiements =====
        const paiements = data.paiements || [];
        const hasPayments = docType === 'FACTURE' && paiements.length > 0;

        // Totaux (calculés d'abord pour estimer la hauteur du bloc)
        const totalsX = pageWidth - margin - 72;
        let tvaLabel = 'Total TVA';
        if (data.totalHT > 0 && data.totalTVA > 0) {
            const tvaRate = Math.round((data.totalTVA / data.totalHT) * 100);
            if (tvaRate > 0) {
                tvaLabel = `Total TVA à ${tvaRate}%`;
            }
        }
        const totals = [
            { label: 'Total HT', value: this.formatNumber(data.totalHT || 0) },
            { label: tvaLabel, value: this.formatNumber(data.totalTVA || 0) },
            { label: 'Total TTC', value: this.formatNumber(data.totalTTC || 0), bold: true }
        ];
        if (hasPayments) {
            totals.push({ label: 'Montant payé', value: this.formatNumber(data.montantPaye || 0) });
            totals.push({ label: 'Reste à payer', value: this.formatNumber(data.resteAPayer || 0), bold: (data.resteAPayer || 0) > 0 });
        }

        // Hauteurs estimées des sous-blocs
        const rowGap = compact ? 5.5 : 6;
        const totalsBlockH = totals.length * rowGap + (compact ? 6 : 7);
        const bankBlockH = (docType === 'FACTURE')
            ? (compact ? 4 + 3 * 4 + 6 : 5 + 3 * 4.5 + 8)
            : 0;
        const payBlockH = hasPayments
            ? (compact ? 14 + paiements.length * 5 : 18 + paiements.length * 5)
            : 0;
        const stampBlockH = (docType === 'FACTURE') ? 0 : (compact ? 34 : 40) + 8; // cachet + marge (sans cachet pour les factures)

        // Position du bloc : poussé vers le bas de la page pour rester sur une seule page
        // Pour les factures, banque et totaux sont au même niveau : on prend le bloc le plus haut
        const bottomBlockH = (docType === 'FACTURE') ? Math.max(totalsBlockH, bankBlockH) : (totalsBlockH + bankBlockH);
        const bottomAnchor = pageHeight - (bottomBlockH + payBlockH + stampBlockH) - 22;
        let blockTop = Math.max(tableEndY + 10, bottomAnchor);

        // Si le tableau est trop long pour que le bloc bas tienne sur la page,
        // tout le bloc passe sur une nouvelle page (évite un cachet orphelin)
        if (tableEndY + 10 > bottomAnchor) {
            doc.addPage();
            blockTop = margin + 4;
        }
        y = blockTop;

        // ===== BANK DETAILS (left side) + TOTALS (right side) au même niveau =====
        // Coordonnées bancaires à gauche
        if (docType === 'FACTURE') {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(compact ? 8 : 8.5);
            doc.setTextColor(0, 0, 0);
            doc.text('Coordonnées bancaires :', col1X, y);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(compact ? 8 : 8.5);
            doc.setTextColor(60, 60, 60);
            const bankDetails = data.bankDetails || {
                banque: 'Crédit du Maroc',
                beneficiaire: company.nom,
                rib: '021 780 0000 177030150208 49'
            };
            doc.text(`Banque : ${bankDetails.banque}`, col1X, y + (compact ? 4 : 5));
            doc.text(`Bénéficiaire : ${bankDetails.beneficiaire}`, col1X, y + (compact ? 8 : 9.5));
            doc.text(`RIB : ${bankDetails.rib}`, col1X, y + (compact ? 12 : 14));
        }

        // Totaux à droite, alignés sur la même ligne de base que les coordonnées bancaires
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.3);
        doc.line(totalsX, y - 3, pageWidth - margin, y - 3);

        doc.setFontSize(compact ? 8 : 8.5);
        totals.forEach((item, idx) => {
            const rowY = y + idx * rowGap;
            if (item.bold) {
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 0, 0);
            } else {
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(60, 60, 60);
            }
            doc.text(item.label, totalsX, rowY);
            doc.text(item.value, totalsX + 70, rowY, { align: 'right' });
        });

        y += (docType === 'FACTURE') ? Math.max(totalsBlockH, bankBlockH) : totalsBlockH;

        // ===== SUIVI DES PAIEMENTS (factures avec paiements) =====
        if (hasPayments) {
            y += 2;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(compact ? 8.5 : 9);
            doc.setTextColor(0, 0, 0);
            doc.text('Suivi des paiements', col1X, y);
            y += compact ? 4 : 5;

            // Table header
            const payX = col1X;
            const payCols = [45, 45, 60]; // Date, Montant, Mode
            const payHeader = ['Date', 'Montant', 'Mode'];
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(255, 255, 255);
            doc.setFillColor(60, 65, 205);
            let hx = payX;
            doc.rect(hx, y - 3.5, payCols.reduce((a, b) => a + b, 0), 5.5, 'F');
            payHeader.forEach((h, i) => {
                doc.text(h, hx + 2, y, { baseline: 'middle' });
                hx += payCols[i];
            });
            y += 5.5;

            // Table rows
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(compact ? 7.5 : 8);
            doc.setTextColor(40, 40, 40);
            paiements.forEach((p, i) => {
                if (i % 2 === 1) {
                    doc.setFillColor(242, 244, 248);
                    doc.rect(payX, y - 3.5, payCols.reduce((a, b) => a + b, 0), 5, 'F');
                }
                doc.text(Utils.formatDate(p.date), payX + 2, y);
                doc.text(this.formatNumber(p.montant || 0), payX + payCols[0] + 2, y);
                doc.text(p.mode || '', payX + payCols[0] + payCols[1] + 2, y);
                y += 5;
            });
            y += compact ? 2 : 3;
        }

        // ===== CACHET / STAMP PNG (centered, positioned dynamically) =====
        // Applied to all document types
        if (docType === 'DEVIS' || docType === 'BON DE COMMANDE' || docType === 'BON DE LIVRAISON' || docType === 'FACTURE PRO FORMA') {
            const stampWidth = compact ? 52 : 60;
            const stampHeight = compact ? 34 : 40;
            const stampX = (pageWidth - stampWidth) / 2;
            const footerLineY = (pageHeight - 16) - 3;
            const stampY = Math.max(y + 5, footerLineY - stampHeight - 8);

            try {
                const stampBase64 = this.getStampBase64();
                if (stampBase64) {
                    doc.addImage(stampBase64, 'PNG', stampX, stampY, stampWidth, stampHeight, undefined, 'FAST');
                } else {
                    // Fallback: simple text stamp if no image
                    doc.setDrawColor(100, 100, 100);
                    doc.setLineWidth(0.5);
                    doc.rect(stampX, stampY, stampWidth, stampHeight);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(7);
                    doc.setTextColor(80, 80, 80);
                    doc.text('CACHET', pageWidth / 2, stampY + stampHeight / 2 + 2, { align: 'center' });
                }
            } catch (e) {
                // Silently fail
            }

            y = stampY + stampHeight + 2;
        }

        // ===== PIÈCES JOINTES (photos ajoutées à la facture/devis) =====
        // Les fichiers volumineux sont stockés en IndexedDB : on les recharge ici
        const imageAttachments = [];
        for (const a of (data.attachments || [])) {
            if (!(a.type || '').startsWith('image/')) continue;
            let dataUrl = a.dataUrl;
            if (!dataUrl && a.storeKey) dataUrl = await AttachmentStore.getWithCloud(a.storeKey);
            if (dataUrl) imageAttachments.push({ ...a, dataUrl });
        }
        if (imageAttachments.length > 0) {
            doc.addPage();
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text('Pièces jointes', margin, margin + 10);
            let imgY = margin + 22;
            for (const att of imageAttachments) {
                try {
                    const img = new Image();
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                        img.src = att.dataUrl;
                    });
                    const maxW = contentWidth;
                    const maxH = 200;
                    const ratio = Math.min(maxW / img.width, maxH / img.height);
                    const w = img.width * ratio;
                    const h = img.height * ratio;
                    if (imgY + h > pageHeight - 30) {
                        doc.addPage();
                        imgY = margin + 10;
                    }
                    const format = att.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
                    doc.addImage(att.dataUrl, format, (pageWidth - w) / 2, imgY, w, h);
                    imgY += h + 6;
                } catch (e) {
                    console.warn('Impossible d\'ajouter la pièce jointe au PDF:', e);
                }
            }
        }

        // ===== PIEDS DE PAGE + NUMÉROS DE PAGE sur toutes les pages =====
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            const footY = pageHeight - 16;
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.line(margin, footY - 3, pageWidth - margin, footY - 3);

            doc.setFontSize(7);
            doc.setTextColor(130, 130, 130);
            doc.setFont('helvetica', 'normal');

            const footerText = `${company.nom} S.A. - ${company.adresse} ${company.ville} - Capital : ${company.capital} - ICE : ${company.ice} - RC : ${company.rc} - IF : ${company.if} - N° Taxe Professionnelle : ${company.tp}`;
            const footerLines = doc.splitTextToSize(footerText, contentWidth);
            footerLines.forEach((line, idx) => {
                doc.text(line, pageWidth / 2, footY + idx * 3, { align: 'center' });
            });

            doc.setFontSize(7.5);
            doc.setTextColor(130, 130, 130);
            doc.text(`Page ${p} / ${totalPages}`, pageWidth - margin, footY - 4, { align: 'right' });
        }

        return doc.output('blob');
    },

    /**
     * Download a PDF document and save a copy to the local folder
     */
    async downloadPDF(docType, data, filename) {
        const blob = await this.generatePDF(docType, data);
        const url = URL.createObjectURL(blob);
        const name = filename || `${docType}_${data.reference}.pdf`;

        // Affiche l'aperçu dans une popup : l'utilisateur choisit de télécharger ou non
        // Nettoyage préventif : révoque l'URL précédente si la popup a été fermée via le bouton ✕
        if (this._pendingPdf) URL.revokeObjectURL(this._pendingPdf.url);
        this._pendingPdf = { blob, url, docType, filename: name };

        Modal.ouvrir('Aperçu PDF', `
            <div class="pdf-preview">
                <iframe src="${url}" class="pdf-preview-frame" title="Aperçu du PDF"></iframe>
                <div class="form-actions">
                    <button class="btn btn-pdf" onclick="PdfExport.telechargerDepuisApercu()">⬇️ Télécharger le PDF</button>
                    <button class="btn btn-outline" onclick="PdfExport.fermerApercu()">Fermer</button>
                </div>
            </div>
        `);
    },

    /**
     * Télécharger le PDF depuis la popup d'aperçu
     */
    telechargerDepuisApercu() {
        const pending = this._pendingPdf;
        if (!pending) return;

        // Déclenche le téléchargement du fichier
        const a = document.createElement('a');
        a.href = pending.url;
        a.download = pending.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Sauvegarde une copie dans le dossier local en arrière-plan
        if (FileStorage.isReady()) {
            FileStorage.saveFile(pending.blob, pending.docType, pending.filename).then(saved => {
                if (saved) console.log(`PDF sauvegardé dans ${pending.docType}`);
            }).catch(e => console.warn('Sauvegarde locale échouée:', e));
        }

        Toast.success('PDF téléchargé avec succès');
        this.fermerApercu();
    },

    /**
     * Fermer la popup d'aperçu sans télécharger
     */
    fermerApercu() {
        if (this._pendingPdf) {
            URL.revokeObjectURL(this._pendingPdf.url);
            this._pendingPdf = null;
        }
        Modal.fermer();
    },

    /**
     * Génère le PDF et enregistre automatiquement une copie dans le dossier local
     * (sans ouvrir la popup d'aperçu). Utilisé à la création des documents.
     * Le sélecteur de dossier (si besoin) est appelé AVANT la génération PDF :
     * Chrome exige une action utilisateur pour ouvrir le sélecteur.
     */
    async sauvegarderCopieAuto(docType, data, filename) {
        try {
            const name = filename || `${docType}_${data.reference}.pdf`;
            if (typeof FileStorage === 'undefined') return false;

            // S'assurer qu'un dossier est configuré (ou le créer sur le Bureau) pendant l'action utilisateur
            const pret = await FileStorage.assurerDossier();
            if (!pret) {
                Toast.info('Copie PDF non enregistrée dans un dossier local (vous pouvez la télécharger manuellement).');
                return false;
            }

            const blob = await this.generatePDF(docType, data);
            const saved = await FileStorage.saveFile(blob, docType, name);
            if (saved) {
                console.log(`Copie PDF enregistrée : ${name}`);
                Toast.success('✅ Copie PDF enregistrée dans le dossier local');
                return true;
            }
            Toast.info('Copie PDF non enregistrée dans un dossier local (vous pouvez la télécharger manuellement).');
            return false;
        } catch (e) {
            console.warn('Sauvegarde automatique du PDF impossible:', e);
            return false;
        }
    },

    /**
     * Génère et enregistre automatiquement une copie PDF d'un document
     * (facture, devis, bon de commande...) dans le dossier local configuré
     * ou créé sur le Bureau. Méthode unique partagée par les modules.
     */
    async enregistrerCopieDocument(doc, docType, prefix) {
        if (!doc) return;
        try {
            const data = this.prepareDocumentData(doc, {
                nom: doc.clientNom,
                adresse: doc.clientAdresse,
                ville: doc.clientVille,
                ice: doc.clientIce,
                rc: doc.clientRC
            }, doc.lignes, doc.reference, { totalHT: doc.totalHT, totalTVA: doc.totalTVA, totalTTC: doc.totalTTC }, docType);
            data.attachments = doc.attachments || [];
            return this.sauvegarderCopieAuto(docType, data, `${prefix}_${doc.reference}.pdf`);
        } catch (e) {
            console.warn('Copie PDF automatique impossible:', e);
            return false;
        }
    },

    /**
     * Open PDF in new tab for preview
     */
    async previewPDF(docType, data) {
        const blob = await this.generatePDF(docType, data);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    },

    /**
     * Export data to Excel using SheetJS
     */
    async exportToExcel(data, filename) {
        if (typeof XLSX === 'undefined') {
            Toast.error('La bibliothèque Excel (SheetJS) n\'est pas chargée.');
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Données');
        
        // Auto-fit column widths
        const colWidths = Object.keys(data[0] || {}).map(key => ({
            wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length))
        }));
        ws['!cols'] = colWidths;

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
        
        function s2ab(s) {
            const buf = new ArrayBuffer(s.length);
            const view = new Uint8Array(buf);
            for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
            return buf;
        }

        const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
        
        // Trigger browser download IMMEDIATELY
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'export.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Then save a copy to the local folder in the background
        let docType = null;
        if (filename) {
            if (filename.startsWith('Facture_')) docType = 'FACTURE';
            else if (filename.startsWith('Devis_')) docType = 'DEVIS';
            else if (filename.startsWith('Commande_')) docType = 'BON DE COMMANDE';
            else if (filename.startsWith('BL_')) docType = 'BON DE LIVRAISON';
            else if (filename.startsWith('ProForma_')) docType = 'FACTURE PRO FORMA';
        }
        if (docType && FileStorage.isReady()) {
            FileStorage.saveFile(blob, docType, filename).then(saved => {
                if (saved) console.log(`Excel sauvegardé dans ${docType}`);
            }).catch(e => console.warn('Sauvegarde locale échouée:', e));
        }
    },

    /**
     * Format number with French locale + espace entre les milliers
     * (les espaces insécables sont remplacés par des espaces normales pour la police PDF)
     */
    formatNumber(amount) {
        const formatted = new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: true
        }).format(amount);
        return formatted.replace(/[\u00A0\u202F]/g, ' ');
    },

    /**
     * Get logo as base64 data URI
     */
    getLogoBase64() {
        return localStorage.getItem('eqnovia_logo_base64') || null;
    },

    /**
     * Get stamp as base64 data URI
     */
    getStampBase64() {
        return localStorage.getItem('eqnovia_cache_base64') || null;
    },

    /**
     * Prepare document data for PDF generation
     */
    prepareDocumentData(doc, client, lines, reference, totals, docType) {
        const paiements = doc.paiements || [];
        const montantPaye = paiements.reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
        return {
            reference: reference,
            date: Utils.formatDate(doc.date || new Date()),
            dateLivraison: doc.dateLivraison ? Utils.formatDate(doc.dateLivraison) : '',
            clientType: doc.clientType || 'client',
            clientNom: client ? client.nom || client.raisonSociale || client.nomComplet : '',
            clientAdresse: client ? client.adresse || '' : '',
            clientVille: client ? client.ville || '' : '',
            clientIce: client ? client.ice || '' : '',
            clientRC: client ? client.rc || '' : '',
            objet: doc.objet || '',
            lines: lines,
            totalHT: totals.totalHT,
            totalTVA: totals.totalTVA,
            totalTTC: totals.totalTTC,
            paiements: paiements,
            montantPaye: montantPaye,
            resteAPayer: Math.max(0, (totals.totalTTC || 0) - montantPaye),
            bankDetails: {
                banque: 'Crédit du Maroc',
                beneficiaire: 'Eqnovia',
                rib: '021 780 0000 177030150208 49'
            }
        };
    }
};
