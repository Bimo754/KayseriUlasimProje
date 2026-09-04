/**
   Kayseri Ulaşım - İstasyon Arama, Liste & Detay Yöneticisi (StationManager)
 */

import { state, layerGroups, markersMap } from '../state.js';
import { ApiService } from '../api.js';
import { getMap } from '../map_manager.js';
import { calculateDistance, formatDriveTime, getFocusedVehiclePosition } from '../ui_utils.js';

export function toggleAdminSidebar() {
    const sidePanel = document.getElementById('admin-sidebar-panel');
    const faultsPanel = document.getElementById('admin-faults-panel');
    const toggleBtn = document.getElementById('admin-btn-toggle-sidebar');
    const faultBtn = document.getElementById('admin-btn-quick-faults');
    const isOpen = sidePanel && sidePanel.classList.contains('drawer-open');

    if (isOpen) {
        sidePanel.classList.remove('drawer-open');
        if (toggleBtn) toggleBtn.classList.remove('active');
    } else {
        if (faultsPanel) faultsPanel.classList.remove('drawer-open');
        if (faultBtn) faultBtn.classList.remove('active');
        if (sidePanel) sidePanel.classList.add('drawer-open');
        if (toggleBtn) toggleBtn.classList.add('active');
        renderList();
    }
}

export function renderList() {
    if (!state.appData) return;

    const sahaList = document.getElementById('saha-stations-list');
    const adminList = document.getElementById('admin-stations-list');

    const istasyonlar = state.appData.istasyonlar || {};
    const kiosklar = state.appData.kiosklar || [];
    const bayiler = state.appData.bayiler || [];
    const anaUs = state.appData.ana_us || {};

    let items = [];

    const vehPos = getFocusedVehiclePosition(state);
    const originLat = vehPos ? vehPos.enlem : (anaUs ? anaUs.enlem : 38.72);
    const originLon = vehPos ? vehPos.boylam : (anaUs ? anaUs.boylam : 35.48);

    // İstasyonlar
    if (state.currentFilter === 'all' || ['T1', 'T2', 'T3', 'T4'].includes(state.currentFilter)) {
        for (const [stId, st] of Object.entries(istasyonlar)) {
            if (state.currentFilter !== 'all' && (!st.hatlar || !st.hatlar.includes(state.currentFilter))) continue;

            if (state.currentSearchTerm) {
                const term = state.currentSearchTerm.toLowerCase('tr');
                const matchName = st.ad.toLowerCase('tr').includes(term);
                const matchLine = (st.hatlar || []).some(h => h.toLowerCase('tr').includes(term));
                if (!matchName && !matchLine) continue;
            }

            const dist = calculateDistance(originLat, originLon, st.enlem, st.boylam);

            items.push({
                id: stId,
                ad: st.ad,
                tip: 'ISTASYON',
                sub_label: 'Tramvay İstasyonu',
                hatlar: st.hatlar || [],
                enlem: st.enlem,
                boylam: st.boylam,
                mesafe: dist,
                aktif: st.aktif
            });
        }
    }

    // Otomatik Kiosklar
    if (state.currentFilter === 'all' || state.currentFilter === 'KIOSK') {
        for (const kiosk of kiosklar) {
            if (state.currentSearchTerm) {
                const term = state.currentSearchTerm.toLowerCase('tr');
                const matchName = kiosk.ad.toLowerCase('tr').includes(term);
                const matchAddress = (kiosk.adres || '').toLowerCase('tr').includes(term);
                if (!matchName && !matchAddress) continue;
            }

            const dist = calculateDistance(originLat, originLon, kiosk.enlem, kiosk.boylam);

            items.push({
                id: kiosk.id,
                ad: kiosk.ad,
                tip: 'KIOSK',
                sub_label: 'Kart Dolum Otomatı',
                hatlar: ['KIOSK'],
                enlem: kiosk.enlem,
                boylam: kiosk.boylam,
                mesafe: dist,
                aktif: true
            });
        }
    }

    // Yetkili Dolum Bayileri
    if (state.currentFilter === 'all' || state.currentFilter === 'BAYI') {
        for (const bayi of bayiler) {
            if (state.currentSearchTerm) {
                const term = state.currentSearchTerm.toLowerCase('tr');
                const matchName = bayi.ad.toLowerCase('tr').includes(term);
                const matchAddress = (bayi.adres || '').toLowerCase('tr').includes(term);
                if (!matchName && !matchAddress) continue;
            }

            const dist = calculateDistance(originLat, originLon, bayi.enlem, bayi.boylam);

            items.push({
                id: bayi.id,
                ad: bayi.ad,
                tip: 'BAYI',
                sub_label: 'Yetkili Satış Bayisi',
                hatlar: ['BAYI'],
                enlem: bayi.enlem,
                boylam: bayi.boylam,
                mesafe: dist,
                aktif: true
            });
        }
    }

    items.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));

    let html = '';
    if (items.length === 0) {
        html = `
            <div class="empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                <div class="empty-title">Nokta Bulunamadı</div>
                <div class="empty-desc">Arama kriterinize uygun durak veya kiosk bulunamadı.</div>
            </div>
        `;
    } else {
        for (const item of items) {
            const isSelected = item.id === state.activeItemId ? 'selected' : '';
            const lineTagsHtml = (item.hatlar || []).map(h => `<span class="line-tag line-tag-${h}">${h}</span>`).join(' ');
            
            let dotColor = '#ef4444';
            if (item.tip === 'KIOSK') dotColor = '#a855f7';
            else if (item.tip === 'BAYI') dotColor = '#06b6d4';
            else if (item.hatlar[0] === 'T2') dotColor = '#3b82f6';
            else if (item.hatlar[0] === 'T3') dotColor = '#10b981';
            else if (item.hatlar[0] === 'T4') dotColor = '#f97316';

            let clickFn = `window.selectStation('${item.id}')`;
            if (item.tip === 'KIOSK') clickFn = `window.selectKiosk('${item.id}')`;
            if (item.tip === 'BAYI') clickFn = `window.selectBayi('${item.id}')`;

            html += `
                <div class="list-item ${isSelected}" onclick="${clickFn}">
                    <div class="item-left">
                        <div class="item-badge-dot" style="background-color: ${dotColor}"></div>
                        <div class="item-info">
                            <div class="item-name">${item.ad}</div>
                            <div class="item-sub">${item.sub_label}</div>
                        </div>
                    </div>
                    <div class="item-right" style="display:flex; align-items:center; gap:8px;">
                        ${lineTagsHtml}
                        <span class="status-badge badge-low">${item.mesafe} km</span>
                    </div>
                </div>
            `;
        }
    }

    if (sahaList) sahaList.innerHTML = html;
    if (adminList) adminList.innerHTML = html;
}

export function selectStation(stId, openPopup = true) {
    if (!state.appData || !state.appData.istasyonlar) return;
    let targetKey = stId;
    let st = state.appData.istasyonlar[targetKey];
    if (!st) {
        for (const [k, s] of Object.entries(state.appData.istasyonlar)) {
            if (s.db_id === Number(stId) || s.id === String(stId)) {
                targetKey = k;
                st = s;
                break;
            }
        }
    }
    if (!st) return;

    state.activeItemId = targetKey;
    state.activeItemType = 'ISTASYON';
    renderList();

    const map = getMap();
    if (map) {
        if (openPopup && map.hasLayer(layerGroups.stations) && markersMap[targetKey]) {
            markersMap[targetKey].openPopup();
        }
    }

    const panel = document.getElementById('detail-panel');
    const isAdmin = state.currentUser && state.currentUser.rol === 'ADMIN';
    if (panel) {
        panel.style.display = isAdmin ? 'flex' : 'none';
    }
    if (!isAdmin) return;

    document.getElementById('detail-badge').innerText = st.aktif ? 'TRAMVAY İSTASYONU' : 'KAPALI İSTASYON';
    document.getElementById('detail-badge').style.backgroundColor = '';
    document.getElementById('detail-name').innerText = st.ad;
    document.getElementById('detail-address').innerText = `Kayseri Tramvay Ağı (${(st.hatlar || []).join(' - ')})`;

    const vehPos = getFocusedVehiclePosition(state);
    const originLat = vehPos ? vehPos.enlem : (state.appData?.ana_us?.enlem || 38.72);
    const originLon = vehPos ? vehPos.boylam : (state.appData?.ana_us?.boylam || 35.48);
    const originLabel = vehPos ? vehPos.label : 'Üs';

    const dist = calculateDistance(originLat, originLon, st.enlem, st.boylam);
    const driveKm = Math.round(dist * 1.35 * 10) / 10;
    const driveMins = formatDriveTime(driveKm);

    document.getElementById('detail-distance').innerText = `${dist} km`;
    document.getElementById('detail-drive-time').innerText = `Sürüş: ~${driveKm} km (${driveMins} dk) • ${originLabel}`;

    document.getElementById('detail-lines').innerHTML = (st.hatlar || []).map(h => `<span class="line-tag line-tag-${h}">${h}</span>`).join(' ');

    const adminBar = document.getElementById('admin-action-bar');
    const adminBtns = document.getElementById('admin-buttons-container');
    const addDevBtn = document.getElementById('btn-add-station-device');

    let barBtnsHtml = '';
    if (state.currentUser && state.currentUser.rol === 'ADMIN') {
        if (addDevBtn) {
            addDevBtn.style.display = 'inline-flex';
            addDevBtn.onclick = () => window.openAddDeviceModal(stId);
        }
        if (st.aktif) {
            barBtnsHtml = `
                <button class="btn btn-xs btn-danger" onclick="window.toggleStationActiveStatus('${st.db_id || st.id || stId}', false)" title="İstasyonu Pasife Çek (Devre Dışı Bırak)">
                    <span>İstasyonu Pasife Çek</span>
                </button>
            `;
        } else {
            barBtnsHtml = `
                <button class="btn btn-xs btn-success" onclick="window.toggleStationActiveStatus('${st.db_id || st.id || stId}', true)" title="İstasyonu Yeniden Aktifleştir">
                    <span>Yeniden Aktifleştir</span>
                </button>
            `;
        }
    } else {
        if (addDevBtn) addDevBtn.style.display = 'none';
    }

    if (adminBar) {
        adminBar.style.display = 'flex';
    }
    if (adminBtns) {
        adminBtns.innerHTML = barBtnsHtml;
    }

    document.getElementById('detail-section-title').innerText = 'İstasyon Donanım Cihazları';
    const devices = st.cihazlar || [];
    document.getElementById('detail-device-count').innerText = `${devices.length} Cihaz`;

    let devHtml = '';
    for (const dev of devices) {
        let adminActionButtons = '';
        if (state.currentUser && state.currentUser.rol === 'ADMIN') {
            adminActionButtons = `
                <div class="device-item-actions">
                    <button class="btn btn-xs btn-secondary" onclick="window.openEditDeviceModal('${dev.cihaz_id}')" title="Düzenle">Düzenle</button>
                    <button class="btn btn-xs btn-secondary" onclick="window.openRelocateDeviceModal('${dev.cihaz_id}')" title="Taşı">Taşı</button>
                </div>
            `;
        }

        devHtml += `
            <div class="device-item-card ${dev.durum === 'ARIZALI' ? 'faulty' : ''}">
                <div class="device-item-top-row">
                    <div class="device-item-left">
                        <div class="device-item-title">${dev.aciklama || dev.tur_etiket}</div>
                        <div class="device-item-sub">${dev.cihaz_id} • ${dev.sorumluluk || 'DAHILI'}</div>
                    </div>
                    <span class="status-badge ${dev.durum === 'NORMAL' ? 'badge-low' : 'badge-urgent'}">${dev.durum}</span>
                </div>
                ${adminActionButtons}
            </div>
        `;
    }
    document.getElementById('detail-device-list').innerHTML = devHtml;

    loadNearestPoints(st.enlem, st.boylam, stId);
}

export function selectBayi(bayiId) {
    if (!state.appData || !state.appData.bayiler) return;
    const bayi = state.appData.bayiler.find(b => b.id === bayiId);
    if (!bayi) return;

    state.activeItemId = bayiId;
    state.activeItemType = 'BAYI';
    renderList();

    const map = getMap();
    if (map) {
        map.flyTo([bayi.enlem, bayi.boylam], 15, { duration: 0.8 });
        if (map.hasLayer(layerGroups.bayiler) && markersMap[bayiId]) {
            markersMap[bayiId].openPopup();
        }
    }

    const panel = document.getElementById('detail-panel');
    const isAdmin = state.currentUser && state.currentUser.rol === 'ADMIN';
    if (panel) {
        panel.style.display = isAdmin ? 'flex' : 'none';
    }
    if (!isAdmin) return;

    document.getElementById('detail-badge').innerText = 'YETKİLİ DOLUM BAYİSİ';
    document.getElementById('detail-badge').style.backgroundColor = '#0284c7';
    document.getElementById('detail-name').innerText = bayi.ad;
    document.getElementById('detail-address').innerText = bayi.adres || 'Adres bilgisi mevcut değil';

    const vehPos = getFocusedVehiclePosition(state);
    const originLat = vehPos ? vehPos.enlem : (state.appData?.ana_us?.enlem || 38.72);
    const originLon = vehPos ? vehPos.boylam : (state.appData?.ana_us?.boylam || 35.48);
    const originLabel = vehPos ? vehPos.label : 'Üs';

    const dist = calculateDistance(originLat, originLon, bayi.enlem, bayi.boylam);
    const driveKm = Math.round(dist * 1.35 * 10) / 10;
    const driveMins = formatDriveTime(driveKm);

    document.getElementById('detail-distance').innerText = `${dist} km`;
    document.getElementById('detail-drive-time').innerText = `Sürüş: ~${driveKm} km (${driveMins} dk) • ${originLabel}`;

    document.getElementById('detail-lines').innerHTML = '<span class="line-tag line-tag-BAYI">BAYİ</span>';

    const adminBar = document.getElementById('admin-action-bar');
    if (adminBar) adminBar.style.display = 'none';
    const addDevBtn = document.getElementById('btn-add-station-device');
    if (addDevBtn) addDevBtn.style.display = 'none';

    document.getElementById('detail-section-title').innerText = 'Bayi POS Terminali';
    document.getElementById('detail-device-count').innerText = '1 POS';
    document.getElementById('detail-device-list').innerHTML = `
        <div class="device-item-card">
            <div class="device-item-left">
                <div>
                    <div class="device-item-title">${bayi.ad} POS Terminali</div>
                    <div class="device-item-sub">${bayi.id} • Aktif Bayi</div>
                </div>
            </div>
            <span class="status-badge badge-low">AKTİF</span>
        </div>
    `;

    loadNearestPoints(bayi.enlem, bayi.boylam, bayiId);
}

export async function loadNearestPoints(lat, lon, excludeId) {
    const container = document.getElementById('detail-nearest-list');
    if (!container) return;
    container.innerHTML = '<div class="loading-state">En yakın noktalar aranıyor...</div>';

    try {
        const points = await ApiService.getNearestPoints(lat, lon, 3, excludeId);
        if (!points || points.length === 0) {
            container.innerHTML = '<div class="loading-state">Yakında dolum noktası bulunamadı.</div>';
            return;
        }

        let html = '';
        for (const p of points) {
            const driveKm = Math.round(p.mesafe_km * 1.35 * 10) / 10;
            const driveMins = formatDriveTime(driveKm);
            const isKiosk = p.tip === 'KIOSK';
            const clickFn = isKiosk ? `window.selectKiosk('${p.id}')` : `window.selectStation('${p.id}')`;

            html += `
                <div class="nearest-item-card" onclick="${clickFn}">
                    <div class="nearest-item-left">
                        <div class="nearest-item-title">${p.ad}</div>
                        <div class="nearest-item-sub">${p.tip_etiket}</div>
                    </div>
                    <div class="nearest-item-right">
                        <div class="nearest-dist-val">${p.mesafe_km} km</div>
                        <div class="nearest-dist-sub">~${driveMins} dk</div>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = '<div class="loading-state">Hesaplama yapılamadı.</div>';
    }
}
