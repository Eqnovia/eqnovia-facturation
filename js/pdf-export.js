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
        y = Math.max(companyEndY, clientLineY) + 6;

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

        y += 7;

        // ===== OBJET =====
        if (data.objet) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8.5);
            doc.setTextColor(60, 60, 60);
            const objetLines = doc.splitTextToSize(`Objet : ${data.objet}`, contentWidth);
            objetLines.forEach((line, idx) => {
                doc.text(line, col1X, y + idx * 4);
            });
            y += objetLines.length * 4 + 4;
        }

        // ===== "Montants exprimés en Dhs" =====
        y += 2;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('Montants exprimés en Dhs', pageWidth - margin, y, { align: 'right' });

        y += 6;

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
            margin: { left: margin + tableMargin / 2, right: margin + tableMargin / 2 },
            tableWidth: contentWidth - tableMargin,
            theme: 'grid',
            tableLineColor: [150, 150, 150],
            tableLineWidth: 0.4,
            headStyles: {
                fillColor: [248, 248, 250],
                textColor: [30, 30, 30],
                fontStyle: 'bold',
                fontSize: 8,
                lineColor: [150, 150, 150],
                lineWidth: 0.4,
                cellPadding: 3.5
            },
            bodyStyles: {
                fontSize: 8,
                textColor: [40, 40, 40],
                fillColor: [255, 255, 255],
                lineColor: [190, 190, 190],
                lineWidth: 0.3,
                cellPadding: 3
            },
            alternateRowStyles: {
                fillColor: [242, 244, 248]
            },
            columnStyles: {
                0: { cellWidth: 'auto', halign: 'center' },
                1: { cellWidth: 13, halign: 'center' },
                2: { cellWidth: 28, halign: 'center' },
                3: { cellWidth: 13, halign: 'center' },
                4: { cellWidth: 14, halign: 'center' },
                5: { cellWidth: 30, halign: 'center' },
                6: { cellWidth: 30, halign: 'center' }
            }
        });

        let tableEndY = doc.lastAutoTable.finalY;

        // ===== BOTTOM SECTION: Push totals, bank, and stamp to bottom =====
        const remaining = pageHeight - tableEndY - 20; // space from table end to footer
        const bottomBlockHeight = 100; // approx height for totals + bank + stamp

        // Check if we have enough space; if not, add a new page
        if (remaining < bottomBlockHeight) {
            doc.addPage();
            y = margin;
            tableEndY = margin;
        }

        // Position the block: push down from table end, leaving some breathing room
        y = Math.max(tableEndY + 10, pageHeight - bottomBlockHeight - 18);

        // ===== TOTALS (right-aligned) =====
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

        // Draw a thin line above totals
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.3);
        doc.line(totalsX, y - 3, pageWidth - margin, y - 3);

        doc.setFontSize(8.5);
        totals.forEach((item, idx) => {
            const rowY = y + idx * 6;
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

        y += totals.length * 6 + 7;

        // ===== BANK DETAILS (left side, for invoices) =====
        if (docType === 'FACTURE') {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(0, 0, 0);
            doc.text('Coordonnées bancaires :', col1X, y);
            y += 5;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(60, 60, 60);
            const bankDetails = data.bankDetails || {
                banque: 'Crédit du Maroc',
                beneficiaire: company.nom,
                rib: '021 780 0000 177030150208 49'
            };
            doc.text(`Banque : ${bankDetails.banque}`, col1X, y);
            y += 4.5;
            doc.text(`Bénéficiaire : ${bankDetails.beneficiaire}`, col1X, y);
            y += 4.5;
            doc.text(`RIB : ${bankDetails.rib}`, col1X, y);
            y += 8;
        }

        // ===== CACHET / STAMP PNG (centered, positioned dynamically) =====
        // Applied to all document types
        if (docType === 'FACTURE' || docType === 'DEVIS' || docType === 'BON DE COMMANDE' || docType === 'BON DE LIVRAISON' || docType === 'FACTURE PRO FORMA') {
            const stampWidth = 60;
            const stampHeight = 40;
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

        // ===== FOOTER (centered at bottom) =====
        const footerY = pageHeight - 16;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

        doc.setFontSize(7);
        doc.setTextColor(130, 130, 130);
        doc.setFont('helvetica', 'normal');

        const footerText = `${company.nom} S.A. - ${company.adresse} ${company.ville} - Capital : ${company.capital} - ICE : ${company.ice} - RC : ${company.rc} - IF : ${company.if} - N° Taxe Professionnelle : ${company.tp}`;
        const footerLines = doc.splitTextToSize(footerText, contentWidth);
        footerLines.forEach((line, idx) => {
            doc.text(line, pageWidth / 2, footerY + idx * 3, { align: 'center' });
        });

        return doc.output('blob');
    },

    /**
     * Download a PDF document and save a copy to the local folder
     */
    async downloadPDF(docType, data, filename) {
        const blob = await this.generatePDF(docType, data);
        
        // Trigger browser download IMMEDIATELY (no delay for user)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `${docType}_${data.reference}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Then save a copy to the local folder in the background
        if (FileStorage.isReady()) {
            // Fire-and-forget: doesn't block the user experience
            FileStorage.saveFile(blob, docType, filename).then(saved => {
                if (saved) console.log(`PDF sauvegardé dans ${docType}`);
            }).catch(e => console.warn('Sauvegarde locale échouée:', e));
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
     * Format number with French locale
     */
    formatNumber(amount) {
        return new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: false
        }).format(amount);
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
        return {
            reference: reference,
            date: Utils.formatDate(doc.date || new Date()),
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
            bankDetails: {
                banque: 'Crédit du Maroc',
                beneficiaire: 'Eqnovia',
                rib: '021 780 0000 177030150208 49'
            }
        };
    }
};
