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

        // ===== FACTURE: completely custom layout matching FACTURE.pdf =====
        if (docType === 'FACTURE') {
            return this.generateFacturePDF(doc, data, company, pageWidth, pageHeight, margin, contentWidth);
        }

        // ===== BON DE COMMANDE: completely custom layout matching boncommend.pdf =====
        if (docType === 'BON DE COMMANDE') {
            return this.generateBonCommandePDF(doc, data, company, pageWidth, pageHeight, margin, contentWidth);
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
        doc.text(company.website, col1X, companyAddrY + 9);

        const companyEndY = companyAddrY + 13.5;

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
            ['Désignation', '% TVA', 'Quantité', 'Unité', 'Prix unitaire', 'Prix total'],
            ['', '', '', '', 'HT', 'HT']
        ] : [
            ['Désignation', '% TVA', 'Montant TVA', 'Qté', 'Unité', 'Prix unitaire HT', 'Prix total HT']
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
            head: tableHeader,
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
            didParseCell: function (data) {
                // For DEVIS two-row header: make the "HT" subheader row smaller and normal weight
                if (isDevis && data.row.index === 1 && data.section === 'head') {
                    data.cell.styles.fontSize = compact ? 6.5 : 7;
                    data.cell.styles.fontStyle = 'normal';
                }
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
            // Note personnalisée : reprend la remarque du devis si renseignée, sinon le texte par défaut
        const noteText = (data.remarques && data.remarques.trim())
            ? data.remarques.trim()
            : '*Hors fourniture et installation des modules photovoltaïques et de leurs structures de fixation (éléments déjà installés par le client)';
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
            doc.setTextColor(0, 0, 0);
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

    async downloadPDF(docType, data, filename) {
        try {
            if (typeof window.jspdf === 'undefined') {
                Toast.error('Bibliothèque jsPDF non chargée. Vérifiez votre connexion internet et rafraîchissez la page.');
                return;
            }
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
        } catch (e) {
            console.error('Erreur génération PDF:', e.message, e.stack);
            Toast.error('Erreur PDF : ' + (e.message || e) + '\n(' + (e.stack ? e.stack.split('\n')[1] || '' : '') + ')');
        }
    },

    /**
     * Télécharger le PDF depuis la popup d'aperçu
     */
    telechargerDepuisApercu() {
        const pending = this._pendingPdf;
        if (!pending) return;

        try {
            // Déclenche le téléchargement du fichier
            const a = document.createElement('a');
            a.href = pending.url;
            a.download = pending.filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            // Retarder la suppression pour laisser le navigateur démarrer le téléchargement
            setTimeout(() => {
                if (a.parentNode) a.parentNode.removeChild(a);
            }, 200);

            // Sauvegarde une copie dans le dossier local en arrière-plan
            if (FileStorage.isReady()) {
                FileStorage.saveFile(pending.blob, pending.docType, pending.filename).then(saved => {
                    if (saved) console.log(`PDF sauvegardé dans ${pending.docType}`);
                }).catch(e => console.warn('Sauvegarde locale échouée:', e));
            }

            Toast.success('PDF téléchargé avec succès');
        } catch (e) {
            console.error('Erreur téléchargement PDF:', e);
            Toast.error('Erreur lors du téléchargement : ' + (e.message || e));
        }
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
     * Préfixe une remarque d'une astérisque (une seule fois, même si déjà préfixée)
     */
    avecEtoile(text) {
        const t = (text || '').trim();
        if (!t) return '';
        return t.startsWith('*') ? t : '* ' + t;
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
    },

    /**
     * DEVIS-specific PDF generation — réplique fidèle de model.pdf :
     * titre DEVIS bleu à droite, logo en haut à gauche, panneau société gris + encadré client,
     * dates/référence en 3 colonnes, Objet, bande d'en-tête de tableau grise, lignes séparées
     * par des filets (sans bordures verticales), totaux surlignés à droite, note,
     * deux encadrés (coordonnées bancaires / cachet-signature) et pied de page légal 2 lignes.
     * Polices : Montserrat/Arial du modèle approchées par Helvetica (métrique proche).
     */
    generateDevisPDF(doc, data, company, pageWidth, pageHeight, margin, contentWidth) {
        const LX = 14.7;                  // bord gauche du modèle (mm)
        const RX = pageWidth - 13.5;      // bord droit du modèle (≈ 196.5 sur A4)
        const CW = RX - LX;               // largeur utile ≈ 181.8
        const BLACK = [0, 0, 0];
        const GREY_TXT = [77, 77, 77];    // #4D4D4D : lignes du tableau, coordonnées bancaires
        const C_PANEL = [242, 242, 242];  // #F2F2F2 : panneau société + cellule Total HT
        const C_HEAD = [191, 191, 191];   // #BFBFBF : bande d'en-tête du tableau + filet pied de page
        const C_SEP = [217, 217, 217];    // #D9D9D9 : séparateurs de lignes + cellule Total TTC
        const C_BORDER = [166, 166, 166]; // #A6A6A6 : encadrés client / banque / cachet
        const C_BLUE = [68, 114, 196];    // #4472C4 : titre DEVIS

        const setF = (style, size, color) => {
            doc.setFont('helvetica', style);
            doc.setFontSize(size);
            doc.setTextColor(color[0], color[1], color[2]);
        };

        // ===== LOGO (haut gauche) =====
        try {
            const logoBase64 = this.getLogoBase64();
            if (logoBase64) doc.addImage(logoBase64, 'PNG', 16.0, 14.4, 58.6, 17.8, undefined, 'FAST');
        } catch (e) {}

        // ===== TITRE DEVIS (bleu, aligné à droite) =====
        setF('bold', 19.68, C_BLUE);
        doc.text('DEVIS', RX, 26.5, { align: 'right' });

        // ===== PANNEAU SOCIÉTÉ (gris clair, gauche) =====
        doc.setFillColor(C_PANEL[0], C_PANEL[1], C_PANEL[2]);
        doc.rect(LX, 38.1, 93.7, 23.0, 'F');
        setF('bold', 8.16, BLACK);
        doc.text(company.nom || 'Eqnovia', 17.9, 43.4);
        setF('normal', 8.16, BLACK);
        doc.text(company.adresse || '20 rue Moussa Bnou Noussair', 17.9, 48.1);
        doc.text(company.ville || 'Casablanca', 17.9, 53.0);
        doc.text(company.website || 'www.eqnovia.ma', 17.9, 57.7);

        // ===== ENCADRÉ CLIENT (droite, bordure fine, sans fond) =====
        doc.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2]);
        doc.setLineWidth(0.25);
        doc.rect(121.7, 38.0, 74.8, 22.9, 'S');
        setF('bold', 8.16, BLACK);
        doc.text(data.clientNom || '', 124.9, 43.4);
        setF('normal', 8.16, BLACK);
        let clientY = 48.1;
        if (data.clientAdresse) {
            const addrLines = doc.splitTextToSize(data.clientAdresse, 70);
            addrLines.forEach(l => { doc.text(l, 124.9, clientY); clientY += 3.6; });
        }
        if (data.clientVille) {
            clientY = Math.max(clientY, 53.0);
            doc.text(data.clientVille, 124.9, clientY);
            clientY += 4.9;
        }
        doc.text(`ICE : ${data.clientIce || '-'}`, 124.9, Math.max(clientY, 57.7));

        // ===== DATES / RÉFÉRENCE (3 colonnes : libellé gras, valeur en dessous) =====
        setF('bold', 8.16, BLACK);
        doc.text('Date du devis :', 15.3, 69.3);
        doc.text('Date de fin de validité :', 109.0, 69.3);
        doc.text('Référence :', 171.7, 69.3);
        setF('normal', 8.16, BLACK);
        doc.text(data.date || '', 15.3, 74.3);
        doc.text(data.dateValidite || '', 109.0, 74.3);
        doc.text(data.reference || '', 171.7, 74.3);

        // ===== OBJET =====
        setF('bold', 8.16, BLACK);
        doc.text('Objet', 15.3, 84.5);
        setF('normal', 8.16, BLACK);
        const objetLines = doc.splitTextToSize(` : ${data.objet || ''}`, RX - 23.6);
        objetLines.forEach((l, i) => doc.text(l, 23.6, 84.5 + i * 4.9));

        // ===== MENTION MONTANTS =====
        setF('italic', 8.16, BLACK);
        doc.text('Montants exprimés en Dhs', RX, 89.2, { align: 'right' });

        // ===== TABLEAU : colonnes du modèle (sans bordures verticales) =====
        const headY = 90.3, headH = 8.8;
        const headCols = [
            { label: 'Désignation', x: 17.8, left: true },
            { label: '% TVA', x: 114.8 },
            { label: 'Quantité', x: 129.4 },
            { label: 'Unité', x: 143.2 },
            { label: ['Prix unitaire', 'HT'], x: 158.4 },
            { label: ['Prix total', 'HT'], x: 182.2 }
        ];
        const drawTableHeader = (top) => {
            doc.setFillColor(C_HEAD[0], C_HEAD[1], C_HEAD[2]);
            doc.rect(LX, top, CW, headH, 'F');
            setF('bold', 8.16, BLACK);
            headCols.forEach(c => {
                if (Array.isArray(c.label)) {
                    doc.text(c.label[0], c.x, top + 3.4, { align: 'center' });
                    doc.text(c.label[1], c.x, top + 7.2, { align: 'center' });
                } else {
                    doc.text(c.label, c.x, top + 5.3, { align: c.left ? 'left' : 'center' });
                }
            });
        };
        drawTableHeader(headY);

        const colDesX = 15.25, colDesW = 92;
        const colTvaX = 114.8, colQtyX = 129.4, colUniteX = 143.2;
        const colPuX = 169.1, colTotalX = 193.1;
        const rowH = 6.7;
        let y = headY + headH; // 99.1
        setF('normal', 8.16, GREY_TXT);

        let totalHT = 0, totalTVA = 0;
        const lignes = data.lines || [];

        lignes.forEach(line => {
            const qty = line.quantite || 0;
            const pu = line.prixUnitaire || 0;
            const tvaRate = line.tva || 0;
            const lineTotalHT = qty * pu;
            totalHT += lineTotalHT;
            totalTVA += lineTotalHT * tvaRate / 100;

            // Saut de page : bande d'en-tête répétée sur la nouvelle page
            if (y + rowH > 271.3) {
                doc.addPage();
                drawTableHeader(20);
                y = 20 + headH;
                setF('normal', 8.16, GREY_TXT);
            }

            // Désignation (renvoi à la ligne resserré comme dans le modèle)
            const desLines = doc.splitTextToSize(line.designation || '', colDesW);
            const n = Math.max(1, desLines.length);
            const firstBase = y + (rowH - (n - 1) * 3.6) / 2 + 1.0;
            desLines.forEach((l, i) => doc.text(l, colDesX, firstBase + i * 3.6));

            // Autres colonnes, centrées verticalement dans la ligne
            const midY = y + rowH / 2 + 1.0;
            doc.text(`${tvaRate}%`, colTvaX, midY, { align: 'center' });
            doc.text(`${qty}`, colQtyX, midY, { align: 'center' });
            doc.text(line.unite || '', colUniteX, midY, { align: 'center' });
            doc.text(this.formatNumber(pu), colPuX, midY, { align: 'right' });
            doc.text(this.formatNumber(lineTotalHT), colTotalX, midY, { align: 'right' });

            y += rowH;
            // Filet de séparation sous la ligne
            doc.setFillColor(C_SEP[0], C_SEP[1], C_SEP[2]);
            doc.rect(LX, y - 0.25, CW, 0.25, 'F');
        });

        if (!lignes.length) {
            totalHT = data.totalHT || 0;
            totalTVA = data.totalTVA || 0;
        }
        const totalTTC = totalHT + totalTVA;

        // ===== BLOC BAS : totaux + note + encadrés =====
        // Note personnalisée : reprend la remarque du devis (préfixée d'une *) si renseignée, sinon le texte par défaut
        const noteText = (data.remarques && data.remarques.trim())
            ? this.avecEtoile(data.remarques)
            : '*Hors fourniture et installation des modules photovoltaïques et de leurs structures de fixation (éléments déjà installés par le client)';
        const noteLines = doc.splitTextToSize(noteText, CW);
        const noteH = noteLines.length * 4.2;
        const BOTTOM_NEED = 17.4 + 3.7 + noteH + 6.5 + 22.3;
        let totalsY, noteY, boxesY;
        if (y + 4 <= 216.2 && 216.2 + BOTTOM_NEED <= 277.3) {
            // Ancrages exacts du modèle (page unique)
            totalsY = 216.2; noteY = 237.9; boxesY = 248.7;
        } else {
            totalsY = y + 4;
            if (totalsY + BOTTOM_NEED > 277.3) {
                doc.addPage();
                totalsY = 20;
            }
            noteY = totalsY + 17.4 + 3.7;
            boxesY = noteY + noteH - 4.9 + 6.5;
        }

        // ===== TOTAUX (bloc droit : HT gris clair, TVA blanc, TTC gris) =====
        const txX = 137.1, txW = 59.4, lblX = 145.8, valX = 193.2;
        doc.setFillColor(C_PANEL[0], C_PANEL[1], C_PANEL[2]);
        doc.rect(txX, totalsY, txW, 5.9, 'F');
        doc.setFillColor(C_SEP[0], C_SEP[1], C_SEP[2]);
        doc.rect(txX, totalsY + 10.6, txW, 7.0, 'F');
        setF('bold', 8.16, BLACK);
        doc.text('Total HT', lblX, totalsY + 3.9);
        doc.text(this.formatNumber(totalHT), valX, totalsY + 3.9, { align: 'right' });
        const tvaBaseY = totalsY + 5.9 + 4.7 / 2 + 1.0;
        doc.text('Total TVA', lblX, tvaBaseY);
        doc.text(this.formatNumber(totalTVA), valX, tvaBaseY, { align: 'right' });
        doc.text('Total TTC', lblX, totalsY + 10.6 + 4.3);
        doc.text(this.formatNumber(totalTTC), valX, totalsY + 10.6 + 4.3, { align: 'right' });

        // ===== NOTE (sous les totaux) =====
        setF('normal', 7.44, BLACK);
        noteLines.forEach((l, i) => doc.text(l, 15.3, noteY + i * 4.2));

        // ===== ENCADRÉS : COORDONNÉES BANCAIRES / CACHET-SIGNATURE =====
        doc.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2]);
        doc.setLineWidth(0.25);
        doc.rect(14.7, boxesY, 93.7, 22.3, 'S');
        doc.rect(121.7, boxesY, 74.8, 22.3, 'S');
        setF('bold', 8.16, BLACK);
        doc.text('Coordonnées bancaires :', 17.8, boxesY + 3.9);
        const bd = data.bankDetails || {
            banque: 'Crédit du Maroc',
            beneficiaire: company.nom || 'Eqnovia',
            rib: '021 780 0000 177030150208 49'
        };
        setF('normal', 8.16, GREY_TXT);
        doc.text(`Banque : ${bd.banque}`, 20.3, boxesY + 9.3);
        doc.text(`Bénéficiaire : ${bd.beneficiaire}`, 20.3, boxesY + 14.8);
        doc.text(`RIB : ${bd.rib}`, 20.3, boxesY + 20.3);
        // Dans le modèle, la mention est juste AU-DESSUS de l'encadré droit (vide, réservé au cachet)
        setF('normal', 8.16, BLACK);
        doc.text('Cachet, Date, Signature et mention "Bon pour Accord"', 159.1, boxesY - 0.9, { align: 'center' });

        // ===== PIED DE PAGE LÉGAL (toutes les pages) =====
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            doc.setFillColor(C_HEAD[0], C_HEAD[1], C_HEAD[2]);
            doc.rect(LX, 277.3, CW, 0.8, 'F');
            setF('bold', 8.16, BLACK);
            const footLine1 = `${company.nom || 'Eqnovia'} S.A. - ${company.adresse || '20 rue Moussa Bnou Noussair'} ${company.ville || 'Casablanca'} - Capital : ${company.capital || '2 000 000 Dhs'}`;
            const footLine2 = `ICE : ${company.ice || '001445583000022'} - RC : ${company.rc || '236357'} - IF : ${company.if || '40397283'} - N° Taxe Professionnelle : ${company.tp || '35546302'}`;
            doc.text(footLine1, (LX + RX) / 2, 283.0, { align: 'center' });
            doc.text(footLine2, (LX + RX) / 2, 286.7, { align: 'center' });
        }

        return doc.output('blob');
    },

    /**
     * FACTURE-specific PDF generation — réplique fidèle de FACTURE.pdf :
     * titre FACTURE bleu en haut à droite, logo en haut à gauche, panneau société gris
     * + encadré client, date/référence en 2 colonnes, Objet, bande d'en-tête de tableau
     * grise ("Prix unitaire HT" / "Prix total HT"), lignes séparées par des filets,
     * encadré bancaire à gauche + totaux surlignés à droite (Total TVA à X%),
     * suivi des paiements éventuel, pied de page légal 2 lignes.
     * Polices : Montserrat/Arial du modèle approchées par Helvetica (métrique proche).
     */
    async generateFacturePDF(doc, data, company, pageWidth, pageHeight, margin, contentWidth) {
        const LX = 15.2;                  // bord gauche du modèle (mm)
        const RX = 195.0;                 // bord droit du modèle (mm)
        const CW = RX - LX;               // largeur utile ≈ 179.8
        const BLACK = [0, 0, 0];
        const GREY_TXT = [77, 77, 77];    // #4D4D4D : lignes du tableau, coordonnées bancaires
        const C_PANEL = [242, 242, 242];  // #F2F2F2 : panneau société + cellule Total HT
        const C_HEAD = [191, 191, 191];   // #BFBFBF : bande d'en-tête du tableau + filet pied de page
        const C_SEP = [217, 217, 217];    // #D9D9D9 : séparateurs de lignes + cellule Total TTC
        const C_BORDER = [166, 166, 166]; // #A6A6A6 : encadrés client / banque
        const C_BLUE = [68, 114, 196];    // #4472C4 : titre FACTURE

        const setF = (style, size, color) => {
            doc.setFont('helvetica', style);
            doc.setFontSize(size);
            doc.setTextColor(color[0], color[1], color[2]);
        };

        // ===== LOGO (haut gauche) =====
        try {
            const logoBase64 = this.getLogoBase64();
            if (logoBase64) doc.addImage(logoBase64, 'PNG', 16.5, 27.9, 58.6, 17.8, undefined, 'FAST');
        } catch (e) {}

        // ===== TITRE FACTURE (bleu, aligné à droite) =====
        setF('bold', 19.68, C_BLUE);
        doc.text('FACTURE', 159.1, 40.0);

        // ===== PANNEAU SOCIÉTÉ (gris clair, gauche) =====
        doc.setFillColor(C_PANEL[0], C_PANEL[1], C_PANEL[2]);
        doc.rect(LX, 51.6, 89.5, 22.9, 'F');
        setF('bold', 8.16, BLACK);
        doc.text(company.nom || 'Eqnovia', 18.4, 56.8);
        setF('normal', 8.16, BLACK);
        doc.text(company.adresse || '20 rue Moussa Bnou Noussair', 18.4, 61.7);
        doc.text(company.ville || 'Casablanca', 18.4, 66.4);
        doc.text(company.website || 'www.eqnovia.ma', 18.4, 71.1);

        // ===== ENCADRÉ CLIENT (droite, bordure fine, sans fond) =====
        doc.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2]);
        doc.setLineWidth(0.25);
        doc.rect(118.5, 51.5, 76.4, 23.0, 'S');
        setF('bold', 8.16, BLACK);
        doc.text(data.clientNom || '', 121.7, 56.8);
        setF('normal', 8.16, BLACK);
        let clientY = 61.7;
        if (data.clientAdresse) {
            const addrLines = doc.splitTextToSize(data.clientAdresse, 70);
            addrLines.forEach(l => { doc.text(l, 121.7, clientY); clientY += 3.6; });
        }
        if (data.clientVille) {
            clientY = Math.max(clientY, 66.4);
            doc.text(data.clientVille, 121.7, clientY);
            clientY += 4.7;
        }
        doc.text(`ICE : ${data.clientIce || '-'}`, 121.7, Math.max(clientY, 71.1));

        // ===== DATE / RÉFÉRENCE (2 colonnes : libellé gras, valeur en dessous) =====
        setF('bold', 8.16, BLACK);
        doc.text('Date de facturation :', 15.8, 82.9);
        doc.text('Référence :', 170.9, 82.9);
        setF('normal', 8.16, BLACK);
        doc.text(data.date || '', 15.8, 87.9);
        doc.text(data.reference || '', 170.9, 87.9);

        // ===== OBJET =====
        setF('bold', 8.16, BLACK);
        doc.text('Objet', 15.8, 98.5);
        setF('normal', 8.16, BLACK);
        const objetLines = doc.splitTextToSize(` : ${data.objet || ''}`, RX - 24.1);
        objetLines.forEach((l, i) => doc.text(l, i === 0 ? 24.1 : 15.8, 98.5 + i * 4.6));

        // ===== MENTION MONTANTS =====
        setF('italic', 8.16, BLACK);
        doc.text('Montants exprimés en Dhs', RX, 109.8, { align: 'right' });

        // ===== TABLEAU : colonnes du modèle (sans bordures verticales) =====
        const headY = 110.8, headH = 9.7;
        const headCols = [
            { label: 'Désignation', x: 18.3, align: 'left' },
            { label: '% TVA', x: 110.7, align: 'center' },
            { label: 'Quantité', x: 126.2, align: 'center' },
            { label: 'Unité', x: 139.5, align: 'center' },
            { label: 'Prix unitaire HT', x: 157.8, align: 'center' },
            { label: ['Prix total', 'HT'], x: 182.7, align: 'center' }
        ];
        const drawTableHeader = (top) => {
            doc.setFillColor(C_HEAD[0], C_HEAD[1], C_HEAD[2]);
            doc.rect(LX, top, CW, headH, 'F');
            setF('bold', 8.16, BLACK);
            headCols.forEach(c => {
                if (Array.isArray(c.label)) {
                    doc.text(c.label[0], c.x, top + 4.1, { align: 'center' });
                    doc.text(c.label[1], c.x, top + 7.8, { align: 'center' });
                } else {
                    doc.text(c.label, c.x, top + 5.9, { align: c.align });
                }
            });
            // Filet sous la bande d'en-tête
            doc.setFillColor(C_SEP[0], C_SEP[1], C_SEP[2]);
            doc.rect(LX, top + headH - 0.25, CW, 0.25, 'F');
        };
        drawTableHeader(headY);

        const colDesX = 15.8, colDesW = 90;
        const colTvaX = 110.7, colQtyX = 126.2, colUniteX = 139.5;
        const colPuX = 167.1, colTotalX = 192.0;
        const rowBaseH = 7.9, lineStep = 3.6;
        const ROW_LIMIT = 258;   // les lignes s'arrêtent avant le filet du pied de page (259.4)
        let y = headY + headH + 0.05;
        setF('normal', 8.16, GREY_TXT);

        let totalHT = 0, totalTVA = 0;
        const lignes = data.lines || [];

        const rowHeight = (line) => {
            const n = Math.max(1, doc.splitTextToSize(line.designation || '', colDesW).length);
            return rowBaseH + (n - 1) * lineStep;
        };

        const drawRow = (line) => {
            const qty = line.quantite || 0;
            const pu = line.prixUnitaire || 0;
            const tvaRate = line.tva || 0;
            const lineTotalHT = qty * pu;
            totalHT += lineTotalHT;
            totalTVA += lineTotalHT * tvaRate / 100;

            // Désignation (renvoi à la ligne resserré comme dans le modèle)
            const desLines = doc.splitTextToSize(line.designation || '', colDesW);
            const n = Math.max(1, desLines.length);
            const rowH = rowBaseH + (n - 1) * lineStep;
            const firstBase = y + (rowH - (n - 1) * lineStep) / 2 + 1.15;
            desLines.forEach((l, i) => doc.text(l, colDesX, firstBase + i * lineStep));

            // Autres colonnes, centrées verticalement dans la ligne
            const midY = y + rowH / 2 + 1.15;
            doc.text(`${tvaRate}%`, colTvaX, midY, { align: 'center' });
            doc.text(`${qty}`, colQtyX, midY, { align: 'center' });
            doc.text(line.unite || '', colUniteX, midY, { align: 'center' });
            doc.text(this.formatNumber(pu), colPuX, midY, { align: 'right' });
            doc.text(this.formatNumber(lineTotalHT), colTotalX, midY, { align: 'right' });

            y += rowH;
            // Filet de séparation sous la ligne
            doc.setFillColor(C_SEP[0], C_SEP[1], C_SEP[2]);
            doc.rect(LX, y - 0.25, CW, 0.25, 'F');
        };

        lignes.forEach(line => {
            // Saut de page : bande d'en-tête répétée sur la nouvelle page
            if (y + rowHeight(line) > ROW_LIMIT) {
                doc.addPage();
                drawTableHeader(20);
                y = 20 + headH + 0.05;
                setF('normal', 8.16, GREY_TXT);
            }
            drawRow(line);
        });

        if (!lignes.length) {
            totalHT = data.totalHT || 0;
            totalTVA = data.totalTVA || 0;
        }
        const totalTTC = totalHT + totalTVA;

        // ===== BLOC BAS : encadré bancaire (gauche) + totaux (droite) =====
        const paiements = data.paiements || [];
        const hasPayments = paiements.length > 0;
        let tvaLabel = 'Total TVA';
        const ht = totalHT || data.totalHT || 0;
        const tva = totalTVA || data.totalTVA || 0;
        if (ht > 0 && tva > 0) {
            const tvaRate = Math.round((tva / ht) * 100);
            if (tvaRate > 0) tvaLabel = `Total TVA à ${tvaRate}%`;
        }

        const ROW = 6.85;                          // pas vertical des lignes de totaux
        const bottomTop = hasPayments ? 228.2 - ROW : 228.2;  // ancrage du modèle (remonté si paiements)
        let bt;
        if (y + 2 <= bottomTop) {
            bt = bottomTop;      // ancrages exacts du modèle (page unique)
        } else {
            doc.addPage();
            bt = 30;             // bloc bas rejeté en haut de la page suivante
        }

        // ===== TOTAUX (bloc droit : HT gris clair, TVA blanc, TTC gris) =====
        const txX = 133.3, txW = 61.7, lblX = 139.0, valX = 193.4;
        doc.setFillColor(C_PANEL[0], C_PANEL[1], C_PANEL[2]);
        doc.rect(txX, bt, txW, 6.9, 'F');
        doc.setFillColor(C_SEP[0], C_SEP[1], C_SEP[2]);
        doc.rect(txX, bt + 13.7, txW, 7.0, 'F');
        setF('bold', 8.16, BLACK);
        doc.text('Total HT', lblX, bt + 4.4);
        doc.text(this.formatNumber(ht), valX, bt + 4.4, { align: 'right' });
        doc.text(tvaLabel, lblX, bt + 11.25);
        doc.text(this.formatNumber(tva), valX, bt + 11.25, { align: 'right' });
        doc.text('Total TTC', lblX, bt + 18.2);
        doc.text(this.formatNumber(totalTTC), valX, bt + 18.2, { align: 'right' });
        if (hasPayments) {
            const montantPaye = data.montantPaye || 0;
            const reste = data.resteAPayer != null ? data.resteAPayer : Math.max(0, totalTTC - montantPaye);
            setF('normal', 8.16, GREY_TXT);
            doc.text('Montant payé', lblX, bt + 24.95);
            doc.text(this.formatNumber(montantPaye), valX, bt + 24.95, { align: 'right' });
            if (reste > 0) setF('bold', 8.16, BLACK); else setF('normal', 8.16, GREY_TXT);
            doc.text('Reste à payer', lblX, bt + 31.8);
            doc.text(this.formatNumber(reste), valX, bt + 31.8, { align: 'right' });
        }

        // ===== ENCADRÉ COORDONNÉES BANCAIRES (gauche) =====
        doc.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2]);
        doc.setLineWidth(0.25);
        doc.rect(LX, bt, 89.5, 27.8, 'S');
        setF('bold', 8.16, BLACK);
        doc.text('Coordonnées bancaires :', 18.3, bt + 4.4);
        const bd = data.bankDetails || {
            banque: 'Crédit du Maroc',
            beneficiaire: company.nom || 'Eqnovia',
            rib: '021 780 0000 177030150208 49'
        };
        setF('normal', 8.16, GREY_TXT);
        doc.text(`Banque : ${bd.banque}`, 20.8, bt + 11.3);
        doc.text(`Bénéficiaire : ${bd.beneficiaire}`, 20.8, bt + 18.2);
        doc.text(`RIB : ${bd.rib}`, 20.8, bt + 25.2);

        // ===== REMARQUES (optionnel) : en bas de la facture, préfixée d'une * =====
        const remarqueTxt = this.avecEtoile(data.remarques);
        if (remarqueTxt) {
            const rmLines = doc.splitTextToSize(remarqueTxt, CW);
            const rh = rmLines.length * 4.2;
            setF('italic', 7.44, [100, 100, 100]);
            if (bt > 100) {
                // Bloc ancré en bas : remarque collée au-dessus du bloc des totaux
                let ry = bt - 3 - rh;
                if (ry < y + 3) ry = y + 3;                     // jamais au-dessus de la fin du tableau
                if (ry + rh <= bt - 0.5) {
                    rmLines.forEach((l, i) => doc.text(l, 15.8, ry + i * 4.2));
                } else if (bt + 34.8 + rh <= 257.4) {              // sinon : sous le bloc des totaux si ça tient
                    const ry2 = bt + 34.8;
                    rmLines.forEach((l, i) => doc.text(l, 15.8, ry2 + i * 4.2));
                }
            } else {
                // Bloc rejeté en haut de page : remarque sous le bloc
                const ry = bt + 36;
                rmLines.forEach((l, i) => doc.text(l, 15.8, ry + i * 4.2));
            }
        }

        // ===== PIÈCES JOINTES (photos ajoutées à la facture) =====
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

        // ===== PIED DE PAGE LÉGAL (toutes les pages) =====
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            doc.setFillColor(C_HEAD[0], C_HEAD[1], C_HEAD[2]);
            doc.rect(LX, 259.4, CW, 0.8, 'F');
            setF('bold', 8.16, BLACK);
            const footLine1 = `${company.nom || 'Eqnovia'} S.A. - ${company.adresse || '20 rue Moussa Bnou Noussair'} ${company.ville || 'Casablanca'} - Capital : ${company.capital || '2 000 000 Dhs'}`;
            const footLine2 = `ICE : ${company.ice || '001445583000022'} - RC : ${company.rc || '236357'} - IF : ${company.if || '40397283'} - N° Taxe Professionnelle : ${company.tp || '35546302'}`;
            doc.text(footLine1, (LX + RX) / 2, 267.0, { align: 'center' });
            doc.text(footLine2, (LX + RX) / 2, 270.7, { align: 'center' });
        }

        return doc.output('blob');
    },

    /**
     * BON DE COMMANDE — réplique fidèle de boncommend.pdf :
     * titre bleu en haut à droite, logo en haut à gauche, panneau société gris
     * + encadré client, date/référence en 2 colonnes, bande d'en-tête de tableau
     * grise, lignes séparées par des filets, cachet dans la zone vide du tableau,
     * totaux surlignés à droite (HT gris clair / TVA blanc / TTC gris),
     * pied de page légal 2 lignes. Pas d'encadré bancaire ni de zone signature
     * (conforme au modèle).
     * Polices : Montserrat/Arial du modèle approchées par Helvetica (métrique proche).
     */
    async generateBonCommandePDF(doc, data, company, pageWidth, pageHeight, margin, contentWidth) {
        const LX = 18.7;                  // bord gauche du modèle (mm)
        const RX = 189.0;                 // bord droit du modèle (mm)
        const CW = RX - LX;               // largeur utile = 170.3
        const BLACK = [0, 0, 0];
        const GREY_TXT = [77, 77, 77];    // #4D4D4D : lignes du tableau
        const C_PANEL = [242, 242, 242];  // #F2F2F2 : panneau société + cellule Total HT
        const C_HEAD = [191, 191, 191];   // #BFBFBF : bande d'en-tête + filet pied de page
        const C_SEP = [217, 217, 217];    // #D9D9D9 : séparateurs de lignes + cellule Total TTC
        const C_BORDER = [166, 166, 166]; // #A6A6A6 : encadré client
        const C_BLUE = [68, 114, 196];    // #4472C4 : titre

        const setF = (style, size, color) => {
            doc.setFont('helvetica', style);
            doc.setFontSize(size);
            doc.setTextColor(color[0], color[1], color[2]);
        };

        // ===== LOGO (haut gauche) =====
        try {
            const logoBase64 = this.getLogoBase64();
            if (logoBase64) doc.addImage(logoBase64, 'PNG', 20.0, 24.2, 58.6, 17.5, undefined, 'FAST');
        } catch (e) {}

        // ===== TITRE (bleu, aligné à droite) =====
        setF('bold', 19.2, C_BLUE);
        doc.text('BON DE COMMANDE', 186.0, 36.1, { align: 'right' });

        // ===== PANNEAU SOCIÉTÉ (gris clair, gauche) =====
        doc.setFillColor(C_PANEL[0], C_PANEL[1], C_PANEL[2]);
        doc.rect(LX, 47.5, 79.0, 22.5, 'F');
        setF('bold', 8.16, BLACK);
        doc.text(company.nom || 'Eqnovia', 22.1, 52.6);
        setF('normal', 8.16, BLACK);
        doc.text(company.adresse || '20 rue Moussa Bnou Noussair', 22.0, 57.4);
        doc.text(company.ville || 'Casablanca', 22.0, 62.1);
        doc.text(company.website || 'www.eqnovia.ma', 22.0, 66.8);

        // ===== ENCADRÉ CLIENT (droite, bordure fine, sans fond) =====
        doc.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2]);
        doc.setLineWidth(0.25);
        doc.rect(114.1, 47.4, 75.1, 22.7, 'S');
        setF('bold', 8.16, BLACK);
        doc.text(data.clientNom || '', 117.6, 52.6);
        setF('normal', 8.16, BLACK);
        let clientY = 57.4;
        if (data.clientAdresse) {
            const addrLines = doc.splitTextToSize(data.clientAdresse, 69);
            addrLines.forEach(l => { doc.text(l, 117.5, clientY); clientY += 3.6; });
        }
        if (data.clientVille) {
            clientY = Math.max(clientY, 62.1);
            doc.text(data.clientVille, 117.5, clientY);
            clientY += 4.7;
        }
        doc.text(`ICE : ${data.clientIce || '-'}`, 117.5, Math.max(clientY, 66.8));

        // ===== DATE / RÉFÉRENCE (2 colonnes : libellé gras, valeur en dessous) =====
        setF('bold', 8.16, BLACK);
        doc.text('Date de commande :', 19.4, 78.4);
        doc.text('Référence :', 166.1, 78.4);
        setF('normal', 8.16, BLACK);
        doc.text(data.date || '', 19.4, 83.3);
        doc.text(data.reference || '', 166.0, 83.3);

        // ===== OBJET / DATE DE LIVRAISON (le modèle réserve cette zone vide) =====
        let zoneY = 89.0;
        if (data.dateLivraison) {
            setF('normal', 8.16, BLACK);
            doc.text(`Date de livraison : ${data.dateLivraison}`, 19.4, zoneY);
            zoneY += 5.5;
        }
        if (data.objet) {
            setF('bold', 8.16, BLACK);
            doc.text('Objet', 19.4, zoneY);
            setF('normal', 8.16, BLACK);
            const objetLines = doc.splitTextToSize(` : ${data.objet}`, RX - 28.3);
            objetLines.forEach((l, i) => doc.text(l, i === 0 ? 28.3 : 19.4, zoneY + i * 4.6));
        }

        // ===== MENTION MONTANTS =====
        setF('italic', 8.16, BLACK);
        doc.text('Montants exprimés en Dhs', 184.6, 104.4, { align: 'right' });

        // ===== TABLEAU : colonnes du modèle (sans bordures verticales) =====
        const headY = 105.4, headH = 7.0;
        const headCols = [
            { label: 'Désignation', x: 58.2, align: 'center' },
            { label: '% TVA', x: 106.0, align: 'center' },
            { label: 'Quantité', x: 122.35, align: 'center' },
            { label: 'Unité', x: 136.5, align: 'center' },
            { label: 'Prix unitaire HT', x: 150.7, align: 'center' },
            { label: ['Prix total', 'HT'], x: 177.15, align: 'center' }
        ];
        const drawTableHeader = (top) => {
            doc.setFillColor(C_HEAD[0], C_HEAD[1], C_HEAD[2]);
            doc.rect(LX, top, CW, headH, 'F');
            setF('bold', 8.16, BLACK);
            headCols.forEach(c => {
                if (Array.isArray(c.label)) {
                    doc.text(c.label[0], c.x, top + 2.7, { align: 'center' });
                    doc.text(c.label[1], c.x, top + 6.3, { align: 'center' });
                } else {
                    doc.text(c.label, c.x, top + 4.5, { align: c.align });
                }
            });
            // Filet sous la bande d'en-tête
            doc.setFillColor(C_SEP[0], C_SEP[1], C_SEP[2]);
            doc.rect(LX, top + headH - 0.25, CW, 0.25, 'F');
        };
        drawTableHeader(headY);

        const colDesX = 19.3, colDesW = 76;
        const colTvaX = 106.0, colQtyX = 122.4, colUniteX = 136.5;
        const colPuX = 163.8, colTotalX = 187.3;
        const rowBaseH = 7.3, lineStep = 3.4;
        const ROW_LIMIT = 222.6;  // les lignes s'arrêtent avant le bloc des totaux (224.6)
        let y = headY + headH + 0.05;
        setF('normal', 8.16, GREY_TXT);

        let totalHT = 0, totalTVA = 0;
        const lignes = data.lines || [];

        const rowHeight = (line) => {
            const n = Math.max(1, doc.splitTextToSize(line.designation || '', colDesW).length);
            return rowBaseH + (n - 1) * lineStep;
        };

        const drawRow = (line) => {
            const qty = line.quantite || 0;
            const pu = line.prixUnitaire || 0;
            const tvaRate = line.tva || 0;
            const lineTotalHT = qty * pu;
            totalHT += lineTotalHT;
            totalTVA += lineTotalHT * tvaRate / 100;

            // Désignation (renvoi à la ligne resserré comme dans le modèle)
            const desLines = doc.splitTextToSize(line.designation || '', colDesW);
            const n = Math.max(1, desLines.length);
            const rowH = rowBaseH + (n - 1) * lineStep;
            const firstBase = y + (rowH - (n - 1) * lineStep) / 2 - 0.65;
            desLines.forEach((l, i) => doc.text(l, colDesX, firstBase + i * lineStep));

            // Autres colonnes, centrées verticalement dans la ligne
            const midY = y + rowH / 2 - 0.65;
            doc.text(`${tvaRate}%`, colTvaX, midY, { align: 'center' });
            doc.text(`${qty}`, colQtyX, midY, { align: 'center' });
            doc.text(line.unite || '', colUniteX, midY, { align: 'center' });
            doc.text(this.formatNumber(pu), colPuX, midY, { align: 'right' });
            doc.text(this.formatNumber(lineTotalHT), colTotalX, midY, { align: 'right' });

            y += rowH;
            // Filet de séparation sous la ligne
            doc.setFillColor(C_SEP[0], C_SEP[1], C_SEP[2]);
            doc.rect(LX, y - 0.25, CW, 0.25, 'F');
        };

        lignes.forEach(line => {
            // Saut de page : bande d'en-tête répétée sur la nouvelle page
            if (y + rowHeight(line) > ROW_LIMIT) {
                doc.addPage();
                drawTableHeader(20);
                y = 20 + headH + 0.05;
                setF('normal', 8.16, GREY_TXT);
            }
            drawRow(line);
        });

        if (!lignes.length) {
            totalHT = data.totalHT || 0;
            totalTVA = data.totalTVA || 0;
        }
        const totalTTC = totalHT + totalTVA;

        // ===== BLOC BAS : totaux à droite (ancrage du modèle : 224.6) =====
        let bt;
        if (y + 2 <= 224.6) {
            bt = 224.6;          // ancrage exact du modèle (page unique)
        } else {
            doc.addPage();
            bt = 30;             // bloc bas rejeté en haut de la page suivante
        }

        const txX = 130.6, txW = 58.5, lblX = 131.2, valX = 189.4;
        doc.setFillColor(C_PANEL[0], C_PANEL[1], C_PANEL[2]);
        doc.rect(txX, bt, txW, 6.9, 'F');
        doc.setFillColor(C_SEP[0], C_SEP[1], C_SEP[2]);
        doc.rect(txX, bt + 13.7, txW, 6.9, 'F');
        setF('bold', 8.16, BLACK);
        doc.text('Total HT', lblX, bt + 4.3);
        doc.text(this.formatNumber(totalHT), valX, bt + 4.3, { align: 'right' });
        doc.text('Total TVA', lblX, bt + 11.15);
        doc.text(this.formatNumber(totalTVA), valX, bt + 11.15, { align: 'right' });
        doc.text('Total TTC', lblX, bt + 18.0);
        doc.text(this.formatNumber(totalTTC), valX, bt + 18.0, { align: 'right' });

        // ===== CACHET dans la zone vide du tableau (position du modèle) =====
        if (bt === 224.6 && y + 2 <= 190.5) {
            try {
                const stampBase64 = this.getStampBase64();
                if (stampBase64) {
                    doc.addImage(stampBase64, 'PNG', 97.4, 190.5, 48.7, 24.3, undefined, 'FAST');
                }
            } catch (e) {}
        }

        // ===== REMARQUES (optionnel) : en bas du bon de commande, préfixée d'une * =====
        const remarqueTxt = this.avecEtoile(data.remarques);
        if (remarqueTxt) {
            const rmLines = doc.splitTextToSize(remarqueTxt, CW);
            const rh = rmLines.length * 4.2;
            setF('italic', 7.44, [100, 100, 100]);
            if (bt > 100) {
                // Zone blanche entre le bloc des totaux (fin 245.2) et le filet du pied de page (263.5)
                let ry = 263.5 - 2.5 - rh;
                if (ry < y + 3) ry = Math.max(y + 3, 246.5);
                if (ry + rh <= 263.0) {
                    rmLines.forEach((l, i) => doc.text(l, LX + 0.6, ry + i * 4.2));
                }
            } else {
                // Bloc rejeté en haut de page : remarque sous le bloc
                const ry = bt + 27.6 + 4;
                rmLines.forEach((l, i) => doc.text(l, LX + 0.6, ry + i * 4.2));
            }
        }

        // ===== PIÈCES JOINTES (photos ajoutées au bon de commande) =====
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

        // ===== PIED DE PAGE LÉGAL (toutes les pages) =====
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            doc.setFillColor(C_HEAD[0], C_HEAD[1], C_HEAD[2]);
            doc.rect(LX, 263.5, CW, 0.8, 'F');
            setF('bold', 8.16, BLACK);
            const footLine1 = `${company.nom || 'Eqnovia'} S.A. - ${company.adresse || '20 rue Moussa Bnou Noussair'} ${company.ville || 'Casablanca'} - Capital : ${company.capital || '2 000 000 Dhs'}`;
            const footLine2 = `ICE : ${company.ice || '001445583000022'} - RC : ${company.rc || '236357'} - IF : ${company.if || '40397283'} - N° Taxe Professionnelle : ${company.tp || '35546302'}`;
            doc.text(footLine1, (LX + RX) / 2, 270.8, { align: 'center' });
            doc.text(footLine2, (LX + RX) / 2, 274.4, { align: 'center' });
        }

        return doc.output('blob');
    }

};
