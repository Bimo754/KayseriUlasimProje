/**
 * Kayseri Ulaşım - Pasif Cihaz & İstasyon Yönetimi (Disabled Elements Manager)
 */

import { ApiService } from './api.js';
import { showToast, openModal, closeModal } from './ui_utils.js';

export async function openDisabledManagerModal() {
    openModal('modal-disabled-manager');
    await loadDisabledItems();
}

export async function loadDisabledItems() {
    const listContainer = document.getElementById('disabled-items-table-body');
    const summaryText = document.getElementById('disabled-items-count-summary');
    const badgeCount = document.getElementById('disabled-items-badge-count');
    if (!listContainer) return;

    listContainer.innerHTML = '<tr><td colspan="4" class="loading-state">Pasif elemanlar yükleniyor...</td></tr>';

    try {
        const res = await fetch('/api/pasif-elemanlar');
        const data = await res.json();

        if (!data.basarili) {
            listContainer.innerHTML = `<tr><td colspan="4" class="error-state">${data.mesaj || 'Veriler yüklenemedi.'}</td></tr>`;
            return;
        }

        const stations = data.pasif_istasyonlar || [];
        const kiosks = data.pasif_kiosk_lar || [];
        const totalCount = data.toplam_pasif_sayisi || 0;

        if (summaryText) summaryText.textContent = `Toplam ${totalCount} pasif kayıt (İstasyon: ${stations.length}, Kiosk: ${kiosks.length})`;
        if (badgeCount) badgeCount.textContent = totalCount;

        if (totalCount === 0) {
            listContainer.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">
                        Sistemde devre dışı bırakılmış istasyon veya kiosk bulunmamaktadır.
                    </td>
                </tr>`;
            return;
        }

        let html = '';

        // Render Disabled Stations
        for (const st of stations) {
            html += `
                <tr>
                    <td style="padding: 8px 10px;">
                        <strong style="color:var(--text-bright); font-size:12.5px; display:block;">${st.ad}</strong>
                        <span style="font-size:10.5px; color:var(--text-muted); font-family:monospace;">${st.kod}</span>
                    </td>
                    <td style="padding: 8px 10px;">
                        <span class="badge-chip pill-primary" style="font-size:9.5px; padding:1px 6px;">TRAMVAY İSTASYONU</span>
                        <span style="font-size:10.5px; color:var(--text-sub); display:block; margin-top:2px;">${st.hat_bilgisi || 'Hatsız'}</span>
                    </td>
                    <td style="padding: 8px 10px;">
                        <span class="status-badge status-urgent" style="font-size:10px; padding:2px 8px; background:#dc2626; color:#fff;">PASİF / KAPALI</span>
                    </td>
                    <td style="text-align:right; padding: 8px 10px;">
                        <button class="btn btn-xs btn-success" onclick="window.toggleStationActiveStatus(${st.id}, true)" style="padding:4px 10px; font-size:11px; display:inline-flex; align-items:center; gap:4px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <span>Aktifleştir</span>
                        </button>
                    </td>
                </tr>`;
        }

        // Render Disabled Kiosks
        for (const k of kiosks) {
            html += `
                <tr>
                    <td style="padding: 8px 10px;">
                        <strong style="color:var(--text-bright); font-size:12.5px; display:block;">${k.ad}</strong>
                        <span style="font-size:10.5px; color:var(--text-muted); font-family:monospace;">${k.kod}</span>
                    </td>
                    <td style="padding: 8px 10px;">
                        <span class="badge-chip pill-success" style="font-size:9.5px; padding:1px 6px; background:#581c87; color:#e9d5ff;">OTOMATİK KİOSK</span>
                        <span style="font-size:10.5px; color:var(--text-sub); display:block; margin-top:2px;">${k.adres || '-'}</span>
                    </td>
                    <td style="padding: 8px 10px;">
                        <span class="status-badge status-urgent" style="font-size:10px; padding:2px 8px; background:#dc2626; color:#fff;">DEVRE DIŞI (PASİF)</span>
                    </td>
                    <td style="text-align:right; padding: 8px 10px;">
                        <button class="btn btn-xs btn-success" onclick="window.toggleKioskActiveStatus(${k.id}, true)" style="padding:4px 10px; font-size:11px; display:inline-flex; align-items:center; gap:4px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <span>Aktifleştir</span>
                        </button>
                    </td>
                </tr>`;
        }

        listContainer.innerHTML = html;

    } catch (err) {
        listContainer.innerHTML = `<tr><td colspan="4" class="error-state">Bağlantı hatası: ${err.message}</td></tr>`;
    }
}

export async function toggleStationActiveStatus(stationId, activeState) {
    try {
        const res = await fetch('/api/istasyon/durum-degistir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ istasyon_id: stationId, aktif: activeState })
        });

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            showToast('Sunucu yanıt hatası. Lütfen yönetici olarak oturum açınız.', 'error');
            return;
        }

        if (data.basarili) {
            showToast(data.mesaj || 'İstasyon durumu güncellendi.', 'success');
            if (typeof window.fetchSystemData === 'function') {
                await window.fetchSystemData();
            }
            if (typeof window.selectStation === 'function') {
                const targetToSelect = stationId || (window.state && window.state.activeItemId);
                if (targetToSelect) {
                    window.selectStation(targetToSelect, true);
                }
            }
            await loadDisabledItems();
        } else {
            showToast(data.mesaj || 'İşlem başarısız.', 'error');
        }
    } catch (err) {
        showToast('Bağlantı hatası: ' + err.message, 'error');
    }
}

export async function toggleKioskActiveStatus(kioskId, activeState) {
    try {
        const res = await fetch('/api/kiosk/durum-degistir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kiosk_id: kioskId, aktif: activeState })
        });

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            showToast('Sunucu yanıt hatası. Lütfen yönetici olarak oturum açınız.', 'error');
            return;
        }

        if (data.basarili) {
            showToast(data.mesaj || 'Kiosk durumu güncellendi.', 'success');
            if (typeof window.fetchSystemData === 'function') {
                await window.fetchSystemData();
            }
            if (typeof window.selectKiosk === 'function') {
                const targetToSelect = kioskId || (window.state && window.state.activeItemId);
                if (targetToSelect) {
                    window.selectKiosk(targetToSelect, true);
                }
            }
            await loadDisabledItems();
        } else {
            showToast(data.mesaj || 'İşlem başarısız.', 'error');
        }
    } catch (err) {
        showToast('Bağlantı hatası: ' + err.message, 'error');
    }
}

export async function updateDisabledCountBadge() {
    const badgeCount = document.getElementById('disabled-items-badge-count');
    if (!badgeCount) return;
    try {
        const res = await fetch('/api/pasif-elemanlar');
        const data = await res.json();
        if (data.basarili) {
            badgeCount.textContent = data.toplam_pasif_sayisi || 0;
        }
    } catch (e) {
        // silent fallback
    }
}

if (typeof window !== 'undefined') {
    window.openDisabledManagerModal = openDisabledManagerModal;
    window.loadDisabledItems = loadDisabledItems;
    window.toggleStationActiveStatus = toggleStationActiveStatus;
    window.toggleKioskActiveStatus = toggleKioskActiveStatus;
    window.updateDisabledCountBadge = updateDisabledCountBadge;
    
    // Auto-update badge count on page load
    setTimeout(updateDisabledCountBadge, 300);
}
