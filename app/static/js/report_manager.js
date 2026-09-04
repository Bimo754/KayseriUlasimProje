import { ApiService } from './api.js';
import { showToast, closeModal, openModal } from './ui_utils.js';

function handleAuthError(msg) {
    if (msg && (msg.includes('yönetici yetkisi') || msg.includes('giriş'))) {
        closeModal('modal-report-manager');
        sessionStorage.removeItem('appUser');
        sessionStorage.removeItem('clientRoleView');
        document.body.className = 'auth-required';
        showToast('Oturum süreniz doldu veya yetkiniz kalmadı. Lütfen yönetici olarak yeniden giriş yapınız.', 'error');
        return true;
    }
    return false;
}

export function switchReportTab(tabName) {
    const tabs = ['fault', 'kiosk', 'turnike'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}-report`) || document.getElementById(`tab-btn-${t}-maint`);
        const panel = document.getElementById(`tab-panel-${t}`);
        if (btn) {
            btn.classList.toggle('active', t === tabName);
        }
        if (panel) {
            panel.style.display = (t === tabName) ? 'block' : 'none';
        }
    });
}

export function openReportManagerModal(defaultTab = 'fault') {
    openModal('modal-report-manager');
    switchReportTab(defaultTab);
    loadReportHistory();
}

export async function loadReportHistory() {
    const listContainer = document.getElementById('report-history-table-body');
    if (!listContainer) return;

    listContainer.innerHTML = '<tr><td colspan="4" class="loading-state">Rapor geçmişi yükleniyor...</td></tr>';

    try {
        const res = await ApiService.getReports();
        if (!res.basarili || !res.raporlar) {
            if (handleAuthError(res.mesaj)) return;
            listContainer.innerHTML = `<tr><td colspan="4" class="error-state">${res.mesaj || 'Raporlar yüklenemedi.'}</td></tr>`;
            return;
        }

        const reports = res.raporlar;

        if (reports.length === 0) {
            listContainer.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">
                        Henüz veritabanına kaydedilmiş sistem raporu bulunmamaktadır.
                    </td>
                </tr>`;
            return;
        }

        let html = '';
        for (const r of reports) {
            const ozet = r.ozet || {};
            const dateFormatted = r.olusturulma_tarihi ? new Date(r.olusturulma_tarihi).toLocaleString('tr-TR') : '-';
            const sizeKb = (r.dosya_boyutu / 1024).toFixed(1);

            let rangeBadge = '<span class="status-badge status-normal" style="font-size:10px; padding:1px 6px;">Tüm Zamanlar</span>';
            if (r.tarih_araligi === 'BUGUN') rangeBadge = '<span class="status-badge status-urgent" style="font-size:10px; padding:1px 6px;">Son 24 Saat</span>';
            else if (r.tarih_araligi === 'SON_7_GUN') rangeBadge = '<span class="status-badge status-high" style="font-size:10px; padding:1px 6px;">Son 7 Gün</span>';
            else if (r.tarih_araligi === 'SON_30_GUN') rangeBadge = '<span class="status-badge status-medium" style="font-size:10px; padding:1px 6px;">Son 30 Gün</span>';
            else if (r.tarih_araligi === 'BU_AY') rangeBadge = '<span class="status-badge status-urgent" style="font-size:10px; padding:1px 6px;">Bu Ay</span>';

            let formatBadge = '<span class="badge-chip pill-primary" style="padding:1px 5px; font-size:9.5px;">PDF</span>';
            if (r.rapor_formati === 'EXCEL') formatBadge = '<span class="badge-chip pill-success" style="padding:1px 5px; font-size:9.5px;">EXCEL</span>';
            else if (r.rapor_formati === 'HEPSI') formatBadge = '<span class="badge-chip pill-primary" style="padding:1px 5px; font-size:9.5px;">PDF + EXCEL</span>';

            let summaryContent = '';
            if (ozet.toplam_durak) {
                summaryContent = `<span class="badge-chip pill-primary" style="padding:1px 6px; font-size:10.5px;">${ozet.toplam_durak} Nokta Bakım (${ozet.toplam_mesafe_km || 0} km)</span>`;
            } else {
                summaryContent = `
                    <span class="badge-chip pill-success" style="padding:1px 5px; font-size:10.5px;">${ozet.toplam_cozulen || 0} Çözülen</span>
                    <span class="badge-chip pill-danger" style="padding:1px 5px; font-size:10.5px; margin-left:2px;">${ozet.toplam_bekleyen || 0} Bekleyen</span>
                `;
            }

            const showPdfBtn = r.rapor_formati !== 'EXCEL' && r.has_pdf !== 0;
            const showExcelBtn = r.has_excel !== 0 || r.rapor_formati === 'EXCEL' || r.rapor_formati === 'HEPSI';

            html += `
                <tr>
                    <td style="word-break: break-word; padding: 6px 10px;">
                        <strong style="color:var(--text-bright); display:block; font-size:12.5px; line-height:1.3; margin-bottom:2px;">${r.rapor_basligi}</strong>
                        <span style="font-size:11px; color:var(--text-sub); display:block;">${r.olusturan_kullanici} • ${dateFormatted}</span>
                        <span style="font-size:10.5px; color:var(--text-muted); font-family:monospace; display:block; margin-top:1px;">${sizeKb} KB</span>
                    </td>
                    <td style="padding: 6px 10px;">
                        <div>${formatBadge}</div>
                        <div style="margin-top:2px;">${rangeBadge}</div>
                    </td>
                    <td style="padding: 6px 10px;">${summaryContent}</td>
                    <td style="text-align:right; white-space:nowrap; padding: 6px 10px;">
                        <div style="display:inline-flex; justify-content:flex-end; gap:6px; align-items:center;">
                            ${showExcelBtn ? `
                            <a href="/api/raporlar/${r.id}/indir-excel" target="_blank" class="btn btn-xs btn-success" title="Excel Dosyasını İndir" style="padding: 4px 8px; font-size:11px; display:inline-flex; align-items:center; gap:3px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                <span>Excel</span>
                            </a>` : ''}
                            ${showPdfBtn ? `
                            <a href="/api/raporlar/${r.id}/indir" target="_blank" class="btn btn-xs btn-primary" title="PDF Dosyasını İndir" style="padding: 4px 8px; font-size:11px; display:inline-flex; align-items:center; gap:3px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                <span>PDF</span>
                            </a>` : ''}
                            <button class="btn btn-xs btn-danger-outline" onclick="window.deleteReportRecord(${r.id})" title="Raporu Veritabanından Sil" style="padding: 4px 6px; display:inline-flex; align-items:center;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </td>
                </tr>`;
        }

        listContainer.innerHTML = html;

    } catch (err) {
        listContainer.innerHTML = `<tr><td colspan="4" class="error-state">Bağlantı hatası: ${err.message}</td></tr>`;
    }
}

if (typeof window !== 'undefined') {
    window.loadReportHistory = loadReportHistory;
}

export async function handleGenerateReportSubmit(event) {
    if (event) event.preventDefault();

    const titleInput = document.getElementById('report-title-input');
    const formatInput = document.getElementById('report-format-select');
    const rangeInput = document.getElementById('report-range-select');
    const scopeInput = document.getElementById('report-scope-select');
    const submitBtn = document.getElementById('btn-submit-generate-report');

    const title = titleInput?.value.trim() || 'Kayseri Ulaşım Saha Operasyon Raporu';
    const format = formatInput?.value || 'HEPSI';
    const range = rangeInput?.value || 'TUMU';
    const scope = scopeInput?.value || 'TUM_SISTEM';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>RAPOR ÜRETİLİYOR...</span>';
    }

    try {
        const res = await ApiService.createReport({
            rapor_basligi: title,
            tarih_araligi: range,
            kapsam: scope,
            rapor_formati: format
        });

        if (res.basarili && res.rapor) {
            showToast('Rapor başarıyla üretildi ve veritabanına kaydedildi.', 'success');
            
            // Reload history table
            loadReportHistory();

            // Automatically trigger download for primary format
            if (res.rapor.excel_download_url && (format === 'EXCEL' || format === 'HEPSI')) {
                window.open(res.rapor.excel_download_url, '_blank');
            } else if (res.rapor.download_url) {
                window.open(res.rapor.download_url, '_blank');
            }
        } else {
            if (!handleAuthError(res.mesaj)) {
                showToast(res.mesaj || 'Rapor üretilemedi.', 'error');
            }
        }
    } catch (err) {
        showToast(`Rapor hatası: ${err.message}`, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>RAPOR ÜRET VE KAYDET</span>';
        }
    }
}

export async function deleteReportRecord(reportId) {
    if (!confirm('Bu sistem raporunu veritabanından kalıcı olarak silmek istediğinizden emin misiniz?')) {
        return;
    }

    try {
        const res = await ApiService.deleteReport(reportId);
        if (res.basarili) {
            showToast('Rapor veritabanından silindi.', 'success');
            loadReportHistory();
        } else {
            if (!handleAuthError(res.mesaj)) {
                showToast(res.mesaj || 'Rapor silinemedi.', 'error');
            }
        }
    } catch (err) {
        showToast(`Silme hatası: ${err.message}`, 'error');
    }
}

if (typeof window !== 'undefined') {
    window.openReportManagerModal = openReportManagerModal;
    window.handleGenerateReportSubmit = handleGenerateReportSubmit;
    window.deleteReportRecord = deleteReportRecord;
    window.loadReportHistory = loadReportHistory;
    window.switchReportTab = switchReportTab;
}
