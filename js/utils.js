/**
 * UTILS - Helper functions for formatting, modal, toast, etc.
 */
const Utils = {
    // Format a number as Moroccan Dirham
    formatMoney(amount) {
        return new Intl.NumberFormat('fr-MA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount) + ' Dhs';
    },
    // Format a date for display (dd/mm/yyyy)
    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    },
    // Format a date for <input type="date">
    formatDateInput(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    },
    // Clean a string to be used as a filename
    cleanFileName(name) {
        if (!name) return '';
        return name.trim()
            .replace(/[\\/]/g, '-')
            .replace(/[:*?"<>|]/g, '');
    },
    // Calculate totals for document lines (HT, TVA, TTC)
    calculateTotals(lines) {
        let totalHT = 0, totalTVA = 0;
        lines.forEach(l => {
            const qty = parseFloat(l.quantite) || 0;
            const price = parseFloat(l.prixUnitaire) || 0;
            const tva = parseFloat(l.tva) || 0;
            const lineHT = qty * price;
            const lineTVA = lineHT * (tva / 100);
            totalHT += lineHT;
            totalTVA += lineTVA;
        });
        return { totalHT, totalTVA, totalTTC: totalHT + totalTVA };
    },
    // Simple unique id generator (not cryptographic)
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    // Escape HTML to avoid injection
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Modal manager (singleton)
const Modal = {
    element: null,
    init() { this.element = document.getElementById('modal'); },
    ouvrir(title, content) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = content;
        this.element.classList.add('active');
    },
    fermer() { this.element.classList.remove('active'); }
};

// Toast notifications manager
const Toast = {
    show(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-message">${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },
    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    warning(msg) { this.show(msg, 'warning'); },
    info(msg) { this.show(msg, 'info'); }
};
