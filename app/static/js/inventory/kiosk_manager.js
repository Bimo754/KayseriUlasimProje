/**
   Kayseri Ulaşım - Kiosk Yönetimi & CRUD İşlemleri (KioskManager)
 */

import { state, layerGroups, markersMap } from '../state.js';
import { ApiService } from '../api.js';
import { getMap } from '../map_manager.js';
import { showToast, openModal, closeModal, calculateDistance, formatDriveTime, getFocusedVehiclePosition } from '../ui_utils.js';
import { renderList, loadNearestPoints } from './station_manager.js';

let onInventoryChangedGlobal = null;

export function setInventoryChangedListener(fn) {
    onInventoryChangedGlobal = fn;
}

export function getInventoryChangedListener() {
    return onInventoryChangedGlobal;
}

export function selectKiosk(kioskId, openPopup = true) {
    if (!state.appData || !state.appData.kiosklar) return;
    const kiosk = state.appData.kiosklar.find(k => 
        k.id === kioskId || 
        k.kiosk_kodu === kioskId || 
        String(k.id) === String(kioskId) || 
        String(k.kiosk_kodu) === String(kioskId) ||
        k.db_id === Number(kioskId)
    );
    if (!kiosk) return;

    const targetKey = kiosk.kiosk_kodu || kiosk.id;
    state.activeItemId = targetKey;
    state.activeItemType = 'KIOSK';
    renderList();

    const map = getMap();
    if (map) {
        if (openPopup && map.hasLayer(layerGroups.kiosks) && markersMap[targetKey]) {
            markersMap[targetKey].openPopup();
        }
    }

    const panel = document.getElementById('detail-panel');
    const isAdmin = state.currentUser && state.currentUser.rol === 'ADMIN';
    if (panel) {
        panel.style.display = isAdmin ? 'flex' : 'none';
    }
    if (!isAdmin) return;

    document.getElementById('detail-badge').innerText = 'OTOMATİK KİOSK';
    document.getElementById('detail-badge').style.backgroundColor = '#9333ea';
    document.getElementById('detail-name').innerText = kiosk.ad;
    document.getElementById('detail-address').innerText = kiosk.adres;

    const vehPos = getFocusedVehiclePosition(state);
    const originLat = vehPos ? vehPos.enlem : (state.appData?.ana_us?.enlem || 38.72);
    const originLon = vehPos ? vehPos.boylam : (state.appData?.ana_us?.boylam || 35.48);
    const originLabel = vehPos ? vehPos.label : 'Üs';

    const dist = calculateDistance(originLat, originLon, kiosk.enlem, kiosk.boylam);
    const driveKm = Math.round(dist * 1.35 * 10) / 10;
    const driveMins = formatDriveTime(driveKm);

    document.getElementById('detail-distance').innerText = `${dist} km`;
    document.getElementById('detail-drive-time').innerText = `Sürüş: ~${driveKm} km (${driveMins} dk) • ${originLabel}`;

    document.getElementById('detail-lines').innerHTML = '<span class="line-tag line-tag-KIOSK">KIOSK</span>';

    const adminBar = document.getElementById('admin-action-bar');
    const adminBtns = document.getElementById('admin-buttons-container');
    const addDevBtn = document.getElementById('btn-add-station-device');
    if (addDevBtn) addDevBtn.style.display = 'none';

    const activeFaults = state.faultsData || [];
    const kskHasFault = activeFaults.some(f => 
        (f.durum === 'BEKLIYOR' || f.durum === 'BEKLEMEDE') && 
        (f.kiosk_id === Number(kiosk.id) || (f.lokasyon_adi && f.lokasyon_adi.toLowerCase().includes(kiosk.ad.toLowerCase())))
    );

    let kskBarBtnsHtml = '';
    if (kskHasFault) {
        kskBarBtnsHtml += `
            <button class="btn btn-xs btn-outline" style="border-color:#ef4444; color:#ef4444;" onclick="window.toggleAdminFaultsDrawer()">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>
                <span>Arıza Paneline Git</span>
            </button>
        `;
    }
    if (state.currentUser && state.currentUser.rol === 'ADMIN') {
        const isKioskDisabled = kiosk.durum === 'PASIF' || kiosk.durum === 'DEVRE_DISI';
        let statusToggleBtn = '';
        if (isKioskDisabled) {
            statusToggleBtn = `
                <button class="btn btn-xs btn-success" style="flex:1;" onclick="window.toggleKioskActiveStatus('${kiosk.id}', true)">
                    <span>Yeniden Aktifleştir</span>
                </button>
            `;
        } else {
            statusToggleBtn = `
                <button class="btn btn-xs btn-danger" style="flex:1; background:rgba(239, 68, 68, 0.15); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.3);" onclick="window.toggleKioskActiveStatus('${kiosk.id}', false)">
                    <span>Pasife Çek</span>
                </button>
            `;
        }

        kskBarBtnsHtml += `
            <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
                <div style="display:flex; gap:6px; width:100%;">
                    <button class="btn btn-xs btn-primary" style="flex:1;" onclick="window.openEditKioskModal('${kiosk.id}')">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        <span>Düzenle</span>
                    </button>
                    <button class="btn btn-xs btn-secondary" style="flex:1;" onclick="window.openSwapKioskModal('${kiosk.id}')">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 3 21 3 21 8"></polyline><line x1="10" y1="14" x2="21" y2="3"></line><polyline points="8 21 3 21 3 16"></polyline><line x1="14" y1="10" x2="3" y2="21"></line></svg>
                        <span>Takas Et</span>
                    </button>
                    ${statusToggleBtn}
                </div>
                <div style="display:flex; width:100%;">
                    <button class="btn btn-xs btn-danger" style="width:100%; display:flex; align-items:center; justify-content:center; gap:5px;" onclick="window.confirmDeleteKiosk('${kiosk.id}')">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        <span>Kiosku Sil</span>
                    </button>
                </div>
            </div>
        `;
    }

    if (adminBar) {
        adminBar.style.display = (kskBarBtnsHtml !== '') ? 'flex' : 'none';
    }
    if (adminBtns) {
        adminBtns.innerHTML = kskBarBtnsHtml;
    }

    document.getElementById('detail-section-title').innerText = 'Kiosk Cihaz Bilgisi';
    document.getElementById('detail-device-count').innerText = '1 Cihaz';
    document.getElementById('detail-device-list').innerHTML = `
        <div class="device-item-card ${kiosk.durum === 'ARIZALI' ? 'faulty' : ''}">
            <div class="device-item-left">
                <div>
                    <div class="device-item-title">${kiosk.ad} Dolum Ünitesi</div>
                    <div class="device-item-sub">${kiosk.id} • Sorumluluk: ${kiosk.sorumluluk || 'DAHILI'}</div>
                </div>
            </div>
            <span class="status-badge ${kiosk.durum === 'NORMAL' ? 'badge-low' : 'badge-urgent'}">${kiosk.durum}</span>
        </div>
    `;

    loadNearestPoints(kiosk.enlem, kiosk.boylam, kioskId);
}

export function openKioskManagerModal() {
    renderKioskTable();
    openModal('modal-kiosk-manager');
}

export function renderKioskTable(searchTerm = '') {
    const tbody = document.getElementById('kiosk-table-body');
    if (!tbody || !state.appData) return;

    let kiosklar = state.appData.kiosklar || [];
    if (searchTerm) {
        const term = searchTerm.toLowerCase('tr');
        kiosklar = kiosklar.filter(k => 
            (k.ad || '').toLowerCase('tr').includes(term) || 
            (k.adres || '').toLowerCase('tr').includes(term) ||
            (k.id || '').toLowerCase('tr').includes(term)
        );
    }

    let html = '';
    for (const k of kiosklar) {
        html += `
            <tr>
                <td style="font-family:monospace; font-weight:700;">${k.id}</td>
                <td><strong>${k.ad}</strong></td>
                <td>${k.adres || '-'}</td>
                <td><span class="status-badge">${k.sorumluluk || 'DAHILI'}</span></td>
                <td><span class="status-badge ${k.durum === 'NORMAL' ? 'badge-low' : 'badge-urgent'}">${k.durum}</span></td>
                <td style="text-align:right; white-space:nowrap;">
                    <button class="btn btn-xs btn-secondary" onclick="window.openEditKioskModal('${k.id}')">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        <span>Düzenle</span>
                    </button>
                    <button class="btn btn-xs btn-danger" onclick="window.confirmDeleteKiosk('${k.id}')">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        <span>Sil</span>
                    </button>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

export function openAddKioskModal() {
    document.getElementById('add-kiosk-name').value = '';
    document.getElementById('add-kiosk-lat').value = '';
    document.getElementById('add-kiosk-lon').value = '';
    document.getElementById('add-kiosk-address').value = '';
    openModal('modal-add-kiosk');
}

export async function handleAddKioskSubmit(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('add-kiosk-name').value.trim();
    const lat = document.getElementById('add-kiosk-lat').value;
    const lon = document.getElementById('add-kiosk-lon').value;
    const address = document.getElementById('add-kiosk-address').value.trim();
    const resp = document.getElementById('add-kiosk-resp').value;
    const status = document.getElementById('add-kiosk-status').value;

    try {
        const res = await ApiService.addKiosk({ ad: name, enlem: lat, boylam: lon, adres: address, sorumluluk: resp, durum: status });
        if (res.basarili) {
            closeModal('modal-add-kiosk');
            showToast(res.mesaj, 'success');
            if (onInventoryChangedGlobal) await onInventoryChangedGlobal();
            if (res.kiosk_kodu) selectKiosk(res.kiosk_kodu);
        } else {
            showToast(res.mesaj, 'error');
        }
    } catch (err) {
        showToast('Kiosk eklenirken hata oluştu.', 'error');
    }
}

export function openEditKioskModal(kioskCode, name, lat, lon, address, resp, status) {
    let kiosk = null;
    if (typeof kioskCode === 'object' && kioskCode !== null) {
        kiosk = kioskCode;
    } else if (name !== undefined && lat !== undefined) {
        kiosk = { id: kioskCode, ad: name, enlem: lat, boylam: lon, adres: address, sorumluluk: resp, durum: status };
    } else if (state.appData && state.appData.kiosklar) {
        kiosk = state.appData.kiosklar.find(k => 
            k.id === kioskCode || 
            k.kiosk_kodu === kioskCode || 
            String(k.id) === String(kioskCode) || 
            String(k.kiosk_kodu) === String(kioskCode)
        );
    }
    if (!kiosk) return;

    const actualCode = kiosk.kiosk_kodu || kiosk.id;
    document.getElementById('edit-kiosk-code').value = actualCode;
    document.getElementById('edit-kiosk-code-display').value = actualCode;
    document.getElementById('edit-kiosk-name').value = kiosk.ad || '';
    document.getElementById('edit-kiosk-lat').value = kiosk.enlem || '';
    document.getElementById('edit-kiosk-lon').value = kiosk.boylam || '';
    document.getElementById('edit-kiosk-address').value = kiosk.adres || '';
    document.getElementById('edit-kiosk-resp').value = kiosk.sorumluluk || 'DAHILI';
    document.getElementById('edit-kiosk-status').value = kiosk.durum || 'NORMAL';
    openModal('modal-edit-kiosk');
}

export async function handleEditKioskSubmit(e) {
    if (e) e.preventDefault();
    const kioskCode = document.getElementById('edit-kiosk-code').value;
    const name = document.getElementById('edit-kiosk-name').value.trim();
    const lat = document.getElementById('edit-kiosk-lat').value;
    const lon = document.getElementById('edit-kiosk-lon').value;
    const address = document.getElementById('edit-kiosk-address').value.trim();
    const resp = document.getElementById('edit-kiosk-resp').value;
    const status = document.getElementById('edit-kiosk-status').value;

    try {
        const res = await ApiService.updateKiosk(kioskCode, { ad: name, enlem: lat, boylam: lon, adres: address, sorumluluk: resp, durum: status });
        if (res.basarili) {
            closeModal('modal-edit-kiosk');
            showToast(res.mesaj, 'success');
            if (onInventoryChangedGlobal) await onInventoryChangedGlobal();
            selectKiosk(kioskCode);
        } else {
            showToast(res.mesaj, 'error');
        }
    } catch (err) {
        showToast('Kiosk güncellenirken hata oluştu.', 'error');
    }
}

export async function confirmDeleteKiosk(kioskCode) {
    let targetCode = kioskCode;
    if (state.appData && state.appData.kiosklar) {
        const k = state.appData.kiosklar.find(item => 
            item.id === kioskCode || 
            item.kiosk_kodu === kioskCode || 
            String(item.id) === String(kioskCode) || 
            String(item.kiosk_kodu) === String(kioskCode)
        );
        if (k) targetCode = k.kiosk_kodu || k.id;
    }
    if (!confirm(`${targetCode} kodlu kiosku veritabanından tamamen silmek istediğinize emin misiniz?`)) return;

    try {
        const res = await ApiService.deleteKiosk(targetCode);
        if (res.basarili) {
            closeModal('modal-edit-kiosk');
            showToast(res.mesaj, 'success');
            const panel = document.getElementById('detail-panel');
            if (panel) panel.style.display = 'none';
            state.activeItemId = null;
            if (onInventoryChangedGlobal) await onInventoryChangedGlobal();
            renderKioskTable();
        } else {
            showToast(res.mesaj, 'error');
        }
    } catch (err) {
        showToast('Silme işlemi başarısız oldu.', 'error');
    }
}

export function openSwapKioskModal(currentKioskId) {
    const s1 = document.getElementById('swap-kiosk-1');
    const s2 = document.getElementById('swap-kiosk-2');
    if (!s1 || !s2) return;
    s1.innerHTML = '';
    s2.innerHTML = '';

    const kiosklar = state.appData ? (state.appData.kiosklar || []) : [];
    for (const k of kiosklar) {
        const isSelected = (k.id === currentKioskId || k.kiosk_kodu === currentKioskId || String(k.id) === String(currentKioskId) || String(k.kiosk_kodu) === String(currentKioskId));
        const val = k.kiosk_kodu || k.id;
        const opt1 = `<option value="${val}" ${isSelected ? 'selected' : ''}>${k.ad} (${k.adres || '-'})</option>`;
        const opt2 = `<option value="${val}" ${!isSelected ? 'selected' : ''}>${k.ad} (${k.adres || '-'})</option>`;
        s1.innerHTML += opt1;
        s2.innerHTML += opt2;
    }
    openModal('modal-swap-kiosk');
}

export async function handleSwapKioskSubmit(e) {
    if (e) e.preventDefault();
    const k1 = document.getElementById('swap-kiosk-1').value;
    const k2 = document.getElementById('swap-kiosk-2').value;

    if (k1 === k2) {
        showToast('Lütfen iki farklı kiosk seçiniz!', 'error');
        return;
    }

    try {
        const res = await ApiService.swapKiosks(k1, k2);
        if (res.basarili) {
            closeModal('modal-swap-kiosk');
            showToast(res.mesaj, 'success');
            if (onInventoryChangedGlobal) await onInventoryChangedGlobal();
            selectKiosk(k1);
        } else {
            showToast(res.mesaj, 'error');
        }
    } catch (err) {
        showToast('Takas işlemi sırasında hata oluştu.', 'error');
    }
}
