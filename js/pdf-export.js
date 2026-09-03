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

        // ===== DEVIS: completely custom layout matching model.pdf =====
        if (docType === 'DEVIS') {
            return this.generateDevisPDF(doc, data, company, pageWidth, pageHeight, margin, contentWidth);
        }

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

        // DEVIS: Date bar with 3 columns, label on top, value below
        if (docType === 'DEVIS') {
            // Gray background bar (taller for two-line format)
            const barH = compact ? 12 : 14;
            doc.setFillColor(245, 247, 250);
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.roundedRect(col1X - 2, y - 4, contentWidth + 4, barH, 1, 1, 'FD');

            // Column positions
            const col2X = col1X + (contentWidth / 3);
            const col3X = col1X + 2 * (contentWidth / 3);

            // Column 1: Date du devis
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 100, 100);
            doc.text('Date du devis :', col1X, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(30, 30, 30);
            doc.text(data.date || '', col1X, y + 5);

            // Column 2: Date de fin de validité
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 100, 100);
            doc.text('Date de fin de validité :', col2X, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(30, 30, 30);
            doc.text(data.dateValidite || '—', col2X, y + 5);

            // Column 3: Référence
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 100, 100);
            doc.text('Référence :', col3X, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(30, 30, 30);
            doc.text(data.reference || '', col3X, y + 5);

            y += (compact ? 10 : 12);
        } else {
            const dateLabels = {
                'FACTURE': 'Date de facturation :',
                'FACTURE PRO FORMA': 'Date de facturation :',
                'BON DE COMMANDE': 'Date de commande :',
                'BON DE LIVRAISON': 'Date de livraison :'
            };
            const dateLabel = dateLabels[docType] || 'Date :';
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(60, 60, 60);
            doc.text(`${dateLabel}  ${data.date}`, col1X, y);
            doc.text(`Référence :  ${data.reference}`, pageWidth - margin, y, { align: 'right' });

            if (docType === 'BON DE COMMANDE' && data.dateLivraison) {
                doc.text(`Date de livraison :  ${data.dateLivraison}`, col1X, y + 4.5);
                y += 4.5;
            }
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
        const isDevis = docType === 'DEVIS';
        const tableHeader = isDevis ? [
            { content: 'Désignation', options: { halign: 'center' } },
            { content: '% TVA', options: { halign: 'center' } },
            { content: 'Quantité', options: { halign: 'center' } },
            { content: 'Unité', options: { halign: 'center' } },
            { content: 'Prix unitaire HT', options: { halign: 'center' } },
            { content: 'Prix total HT', options: { halign: 'center' } }
        ] : [
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
            if (isDevis) {
                return [
                    line.designation || '',
                    tva + '%',
                    qty,
                    line.unite || '',
                    this.formatNumber(pu),
                    this.formatNumber(totalHT)
                ];
            }
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
            columnStyles: isDevis ? {
                0: { cellWidth: 'auto', halign: 'center' },
                1: { cellWidth: 18, halign: 'center' },
                2: { cellWidth: 18, halign: 'center' },
                3: { cellWidth: 16, halign: 'center' },
                4: { cellWidth: 32, halign: 'center' },
                5: { cellWidth: 32, halign: 'center' }
            } : {
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
        const stampBlockH = (docType === 'FACTURE' || docType === 'DEVIS') ? 0 : (compact ? 34 : 40) + 8; // pas de cachet pour factures et devis

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

        // ===== REMARQUES (optionnel) =====
        if (data.remarques) {
            y += compact ? 3 : 5;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(compact ? 7.5 : 8);
            doc.setTextColor(0, 0, 0);
            doc.text('Remarques :', col1X, y);
            y += compact ? 3.5 : 4;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(compact ? 7.5 : 8);
            doc.setTextColor(60, 60, 60);
            const remarquesLines = doc.splitTextToSize(data.remarques, contentWidth);
            remarquesLines.forEach((line, idx) => {
                doc.text(line, col1X, y + idx * 3.5);
            });
            y += remarquesLines.length * 3.5 + (compact ? 2 : 3);
        }

        // ===== DEVIS FOOTER : note + banque (box) + signature (box) =====
        if (docType === 'DEVIS') {
            y += compact ? 3 : 5;

            // Note : Hors fourniture...
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 100, 100);
            const noteText = '*Hors fourniture et installation des modules photovoltaïques et de leurs structures de fixation (éléments déjà installés par le client)';
            const noteLines = doc.splitTextToSize(noteText, contentWidth);
            noteLines.forEach((line, idx) => {
                doc.text(line, col1X, y + idx * 3.5);
            });
            y += noteLines.length * 3.5 + (compact ? 4 : 6);

            // Two boxes side by side
            const boxW = (contentWidth - 8) / 2; // each box width
            const boxH = compact ? 22 : 26;
            const box1X = col1X;
            const box2X = col1X + boxW + 8;

            // Box 1: Coordonnées bancaires
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.roundedRect(box1X, y, boxW, boxH, 2, 2, 'S');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(compact ? 7.5 : 8);
            doc.setTextColor(0, 0, 0);
            doc.text('Coordonnées bancaires :', box1X + 4, y + 5);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(compact ? 7.5 : 8);
            doc.setTextColor(60, 60, 60);
            doc.text('Banque : Crédit du Maroc', box1X + 4, y + 10);
            doc.text('Bénéficiaire : Eqnovia', box1X + 4, y + 15);
            doc.text('RIB : 021 780 0000 177030150208 49', box1X + 4, y + 20);

            // Box 2: Cachet, Date, Signature
            doc.roundedRect(box2X, y, boxW, boxH, 2, 2, 'S');

            doc.setFont('helvetica', 'italic');
            doc.setFontSize(compact ? 7.5 : 8);
            doc.setTextColor(100, 100, 100);
            doc.text('Cachet, Date, Signature et mention', box2X + boxW / 2, y + 10, { align: 'center' });
            doc.text('"Bon pour accord"', box2X + boxW / 2, y + 15, { align: 'center' });

            y += boxH + 4;
        }

        // ===== CACHET / STAMP PNG (centered, positioned dynamically) =====
        // Applied to BON DE COMMANDE, BON DE LIVRAISON, PRO FORMA (NOT DEVIS)
        if (docType === 'BON DE COMMANDE' || docType === 'BON DE LIVRAISON' || docType === 'FACTURE PRO FORMA') {
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
     * DEVIS-specific PDF generation matching the Python FPDF model.
     * Blue header, centered title, bordered table, note, bank details, signature.
     */
    generateDevisPDF(doc, data, company, pageWidth, pageHeight, margin, contentWidth) {
        const col1X = margin;
        let y = 0;

        // ===== BLUE HEADER BAR (0–45mm) =====
        doc.setFillColor(31, 58, 95); // Bleu marine
        doc.rect(0, 0, pageWidth, 45, 'F');

        // Company name + address in white
        y = 8;
        doc.setFillColor(31, 58, 95);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(company.nom || 'Eqnovia', col1X, y);

        doc.setFont('helvetica', '', 9);
        doc.setFontSize(9);
        y += 7;
        doc.text(company.adresse || '20 rue Moussa Bnou Noussair', col1X, y);
        y += 5;
        doc.text(company.ville || 'Casablanca', col1X, y);
        y += 5;
        doc.text(company.website || 'www.eqnovia.ma', col1X, y);

        // White separator line at bottom of header
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.3);
        doc.line(10, 43, pageWidth - 10, 43);
        doc.setDrawColor(0, 0, 0);

        // ===== TITLE: DEVIS (centered, below header) =====
        y = 55;
        doc.setTextColor(31, 58, 95);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text('DEVIS', pageWidth / 2, y, { align: 'center' });
        doc.setTextColor(0, 0, 0);

        // ===== CLIENT INFO (left) + DATES/REF (right) =====
        y = 65;

        // Client name (bold, left)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(data.clientNom || '', col1X, y);
n        // Dates and reference (right-aligned)
        doc.setFont('helvetica', '', 10);
        const rightX = pageWidth - margin;
        doc.text(`Date du devis : ${data.date || ''}`, rightX, y, { align: 'right' });
        y += 6;
        doc.text(`Date de fin de validité : ${data.dateValidite || ''}`, rightX, y, { align: 'right' });
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.text(`Référence : ${data.reference || ''}`, rightX, y, { align: 'right' });
        doc.setFont('helvetica', '', 10);

        // Client address (left, below name)
        y = 65;
        if (data.clientAdresse) {
            doc.setFont('helvetica', '', 9);
            doc.text(data.clientAdresse, col1X, y + 12);
        }
        if (data.clientVille) {
            doc.setFont('helvetica', '', 9);
            doc.text(data.clientVille, col1X, y + 17);
        }

        // ===== OBJET =====
        y = 88;
        doc.setFont('helvetica', 'B', 10);
        doc.text(`Objet : ${data.objet || ''}`, col1X, y);
        doc.setFont('helvetica', '', 10);
        y += 10;

        // ===== TABLE =====
        // Column widths: Désignation=65, %TVA=20, Qté=18, Unité=18, PU HT=30, Total HT=35
        const cols = [
            { header: 'Désignation', width: 65, align: 'L' },
            { header: '% TVA', width: 20, align: 'C' },
            { header: 'Qté', width: 18, align: 'C' },
            { header: 'Unité', width: 18, align: 'C' },
            { header: 'Prix unitaire HT', width: 30, align: 'R' },
            { header: 'Prix total HT', width: 35, align: 'R' }
        ];
        const totalTableW = cols.reduce((s, c) => s + c.width, 0);
        const tableX = (pageWidth - totalTableW) / 2; // Center table
        const rowH = 7;
        const headerH = 8;

        // Table header row (gray bg, bordered)
        doc.setFillColor(240, 240, 240);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.setFont('helvetica', 'B', 10);
        let tx = tableX;
        cols.forEach(col => {
            doc.rect(tx, y, col.width, headerH, 'FD');
            doc.text(col.header, tx + col.width / 2, y + headerH / 2 + 1, { align: 'center' });
            tx += col.width;
        });
        y += headerH;

        // Table data rows
        doc.setFont('helvetica', '', 9);
        doc.setFillColor(255, 255, 255);
        let totalHT = 0;
        let totalTVA = 0;
        const lignes = data.lines || [];

        lignes.forEach(line => {
            const qty = line.quantite || 0;
            const pu = line.prixUnitaire || 0;
            const tvaRate = line.tva || 0;
            const lineTotalHT = qty * pu;
            const montantTVA = lineTotalHT * tvaRate / 100;
            totalHT += lineTotalHT;
            totalTVA += montantTVA;

            // Check page break
            if (y + rowH > pageHeight - 25) {
                doc.addPage();
                y = margin + 10;
            }

            tx = tableX;
            const rowData = [
                { text: line.designation || '', align: 'L' },
                { text: `${tvaRate}%`, align: 'C' },
                { text: `${qty}`, align: 'C' },
                { text: line.unite || '', align: 'C' },
                { text: this.formatNumber(pu), align: 'R' },
                { text: this.formatNumber(lineTotalHT), align: 'R' }
            ];
            rowData.forEach((cell, i) => {
                doc.rect(tx, y, cols[i].width, rowH, 'D');
                doc.text(cell.text, tx + 2, y + rowH / 2 + 1);
                tx += cols[i].width;
            });
            y += rowH;
        });

        // ===== TOTALS (right-aligned, bordered) =====
        const totalTTC = totalHT + totalTVA;
        const totalsW = cols[4].width + cols[5].width; // 30 + 35 = 65
        const totalsX = tableX + totalTableW - totalsW;
        const totalRowH = 8;
        const totalBigH = 10;

        // Total HT
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.setFont('helvetica', 'B', 10);
        doc.rect(totalsX, y, cols[4].width, totalRowH, 'D');
        doc.text('Total HT', totalsX + cols[4].width - 2, y + totalRowH / 2 + 1, { align: 'right' });
        doc.rect(totalsX + cols[4].width, y, cols[5].width, totalRowH, 'D');
        doc.text(this.formatNumber(totalHT), totalsX + totalTableW - 2, y + totalRowH / 2 + 1, { align: 'right' });
        y += totalRowH;

        // Total TVA
        doc.rect(totalsX, y, cols[4].width, totalRowH, 'D');
        doc.text('Total TVA', totalsX + cols[4].width - 2, y + totalRowH / 2 + 1, { align: 'right' });
        doc.rect(totalsX + cols[4].width, y, cols[5].width, totalRowH, 'D');
        doc.text(this.formatNumber(totalTVA), totalsX + totalTableW - 2, y + totalRowH / 2 + 1, { align: 'right' });
        y += totalRowH;

        // Total TTC (bold, bigger)
        doc.setFont('helvetica', 'B', 12);
        doc.rect(totalsX, y, cols[4].width, totalBigH, 'D');
        doc.text('Total TTC', totalsX + cols[4].width - 2, y + totalBigH / 2 + 1.5, { align: 'right' });
        doc.rect(totalsX + cols[4].width, y, cols[5].width, totalBigH, 'D');
        doc.text(this.formatNumber(totalTTC), totalsX + totalTableW - 2, y + totalBigH / 2 + 1.5, { align: 'right' });
        y += totalBigH + 4;

        // ===== NOTE =====
        doc.setFont('helvetica', 'I', 9);
        doc.setTextColor(80, 80, 80);
        const noteText = '*Hors fourniture et installation des modules photovoltaïques et de leurs structures de fixation (éléments déjà installés par le client)';
        const noteLines = doc.splitTextToSize(noteText, contentWidth);
        noteLines.forEach((line, idx) => {
            doc.text(line, col1X, y + idx * 4);
        });
        y += noteLines.length * 4 + 6;

        // ===== COORDONNÉES BANCAIRES =====
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'B', 10);
        doc.text('Coordonnées bancaires :', col1X, y);
        y += 5;
        doc.setFont('helvetica', '', 9);
        doc.text('Banque : Crédit du Maroc', col1X, y);
        y += 5;
        doc.text('Bénéficiaire : Eqnovia', col1X, y);
        y += 5;
        doc.text('RIB : 021 780 0000 177030150208 49', col1X, y);
        y += 10;

        // ===== SIGNATURE (bottom right) =====
        const sigY = pageHeight - 35; // Position above footer
        doc.setFont('helvetica', 'B', 10);
        doc.text(data.ville || company.ville || '', col1X, sigY);
        doc.text('Cachet, Date, Signature et mention "Bon pour Accord"', pageWidth - margin, sigY, { align: 'right' });

        // ===== LEGAL FOOTER (on all pages) =====
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            const footY = pageHeight - 16;
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.line(margin, footY - 3, pageWidth - margin, footY - 3);
            doc.setFontSize(7);
            doc.setTextColor(130, 130, 130);
            doc.setFont('helvetica', 'I', 7);
            doc.text(`${company.nom || 'Eqnovia'} S.A. - ${company.adresse || '20 rue Moussa Bnou Noussair'} ${company.ville || 'Casablanca'} - Capital : ${company.capital || '2 000 000'} Dhs - ICE : ${company.ice || '001445583000022'} - RC : ${company.rc || '236357'} - IF : ${company.if || '40397283'} - N° Taxe Professionnelle : ${company.tp || '35546302'}`, pageWidth / 2, footY, { align: 'center' });
            doc.text(`Page ${p} / ${totalPages}`, pageWidth / 2, footY + 4, { align: 'center' });
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
            },
            dateValidite: doc.dateValidite ? Utils.formatDate(doc.dateValidite) : '',
            remarques: doc.remarques || '',
        };
    }
};
