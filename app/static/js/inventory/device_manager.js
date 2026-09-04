/**
   Kayseri Ulaşım - İstasyon Donanım & Cihaz İşlemleri (DeviceManager)
 */

import { state } from '../state.js';
import { ApiService } from '../api.js';
import { showToast, openModal, closeModal } from '../ui_utils.js';
import { selectStation } from './station_manager.js';
import { getInventoryChangedListener } from './kiosk_manager.js';

export function openAddDeviceModal(stationCode) {
    document.getElementById('add-dev-station-code').value = stationCode;
    document.getElementById('add-dev-label').value = '';
    document.getElementById('add-dev-desc').value = '';
    openModal('modal-add-device');
}

export async function handleAddDeviceSubmit(e) {
    if (e) e.preventDefault();
    const stationCode = document.getElementById('add-dev-station-code').value;
    const devType = document.getElementById('add-dev-type').value;
    const devNo = parseInt(document.getElementById('add-dev-no').value);
    const label = document.getElementById('add-dev-label').value.trim();
    const desc = document.getElementById('add-dev-desc').value.trim();
    const resp = document.getElementById('add-dev-resp').value;
    const status = document.getElementById('add-dev-status').value;

    try {
        const res = await ApiService.addStationDevice({
            istasyon_kodu: stationCode,
            cihaz_turu: devType,
            cihaz_no: devNo,
            tur_etiket: label,
            aciklama: desc,
            sorumluluk: resp,
            durum: status
        });
        if (res.basarili) {
            closeModal('modal-add-device');
            showToast(res.mesaj, 'success');
            const listener = getInventoryChangedListener();
            if (listener) await listener();
            selectStation(stationCode);
        } else {
            showToast(res.mesaj, 'error');
        }
    } catch (err) {
        showToast('Cihaz eklenirken hata oluştu.', 'error');
    }
}

export function openEditDeviceModal(devCode, label, desc, resp, status) {
    let dev = null;
    if (label !== undefined && desc !== undefined) {
        dev = { cihaz_id: devCode, tur_etiket: label, aciklama: desc, sorumluluk: resp, durum: status };
    } else if (state.appData && state.appData.istasyonlar) {
        for (const [_, st] of Object.entries(state.appData.istasyonlar)) {
            const found = (st.cihazlar || []).find(d => d.cihaz_id === devCode);
            if (found) { dev = found; break; }
        }
    }
    if (!dev) return;

    document.getElementById('edit-dev-code').value = dev.cihaz_id;
    document.getElementById('edit-dev-code-display').value = dev.cihaz_id;
    document.getElementById('edit-dev-label').value = dev.tur_etiket || '';
    document.getElementById('edit-dev-desc').value = dev.aciklama || '';
    document.getElementById('edit-dev-resp').value = dev.sorumluluk || 'DAHILI';
    document.getElementById('edit-dev-status').value = dev.durum || 'NORMAL';
    openModal('modal-edit-device');
}

export async function handleEditDeviceSubmit(e) {
    if (e) e.preventDefault();
    const devCode = document.getElementById('edit-dev-code').value;
    const label = document.getElementById('edit-dev-label').value.trim();
    const desc = document.getElementById('edit-dev-desc').value.trim();
    const resp = document.getElementById('edit-dev-resp').value;
    const status = document.getElementById('edit-dev-status').value;

    try {
        const res = await ApiService.updateStationDevice(devCode, { tur_etiket: label, aciklama: desc, sorumluluk: resp, durum: status });
        if (res.basarili) {
            closeModal('modal-edit-device');
            showToast(res.mesaj, 'success');
            const listener = getInventoryChangedListener();
            if (listener) await listener();
            if (state.activeItemId) selectStation(state.activeItemId);
        } else {
            showToast(res.mesaj, 'error');
        }
    } catch (err) {
        showToast('Güncelleme sırasında hata oluştu.', 'error');
    }
}

export async function confirmDeleteDevice(devCode) {
    if (!confirm(`${devCode} kodlu cihazı sistemden tamamen kaldırmak istediğinize emin misiniz?`)) return;

    try {
        const res = await ApiService.deleteStationDevice(devCode);
        if (res.basarili) {
            closeModal('modal-edit-device');
            showToast(res.mesaj, 'success');
            const listener = getInventoryChangedListener();
            if (listener) await listener();
            if (state.activeItemId) selectStation(state.activeItemId);
        } else {
            showToast(res.mesaj, 'error');
        }
    } catch (err) {
        showToast('Silme işlemi başarısız oldu.', 'error');
    }
}

export function openRelocateDeviceModal(devCode, devLabel) {
    let dev = null;
    let currentStId = null;
    if (state.appData && state.appData.istasyonlar) {
        for (const [stId, st] of Object.entries(state.appData.istasyonlar)) {
            const found = (st.cihazlar || []).find(d => d.cihaz_id === devCode);
            if (found) { dev = found; currentStId = stId; break; }
        }
    }
    const labelText = devLabel || (dev ? dev.tur_etiket : '');

    document.getElementById('relocate-dev-code').value = devCode;
    document.getElementById('relocate-dev-name-display').value = `${devCode} (${labelText})`;

    const targetSelect = document.getElementById('relocate-target-station');
    targetSelect.innerHTML = '';

    const istasyonlar = state.appData.istasyonlar || {};
    for (const [stId, st] of Object.entries(istasyonlar)) {
        targetSelect.innerHTML += `<option value="${stId}" ${stId === currentStId ? 'disabled' : ''}>${st.ad} (${(st.hatlar || []).join(', ')})</option>`;
    }

    openModal('modal-relocate-device');
}

export async function handleRelocateDeviceSubmit(e) {
    if (e) e.preventDefault();
    const devCode = document.getElementById('relocate-dev-code').value;
    const targetStation = document.getElementById('relocate-target-station').value;

    try {
        const res = await ApiService.relocateStationDevice(devCode, targetStation);
        if (res.basarili) {
            closeModal('modal-relocate-device');
            showToast(res.mesaj, 'success');
            const listener = getInventoryChangedListener();
            if (listener) await listener();
            selectStation(targetStation);
        } else {
            showToast(res.mesaj, 'error');
        }
    } catch (err) {
        showToast('Yer değiştirme işleminde hata oluştu.', 'error');
    }
}
