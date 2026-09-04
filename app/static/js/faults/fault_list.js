/**
   Kayseri Ulaşım - Arıza Listesi, Filtreleme, Harita Katmanları & Çekmece Görünümleri (FaultList)
 */

import { state, layerGroups, markersMap } from '../state.js';
import { ApiService } from '../api.js';
import { getMap } from '../map_manager.js';

export function toggleAdminFaultsDrawer() {
    const faultsPanel = document.getElementById('admin-faults-panel');
    const sidePanel = document.getElementById('admin-sidebar-panel');
    const toggleBtn = document.getElementById('admin-btn-quick-faults');
    const sideBtn = document.getElementById('admin-btn-toggle-sidebar');
    const isOpen = faultsPanel && faultsPanel.classList.contains('drawer-open');

    if (isOpen) {
        faultsPanel.classList.remove('drawer-open');
        if (toggleBtn) toggleBtn.classList.remove('active');
    } else {
        if (sidePanel) sidePanel.classList.remove('drawer-open');
        if (sideBtn) sideBtn.classList.remove('active');
        if (faultsPanel) faultsPanel.classList.add('drawer-open');
        if (toggleBtn) toggleBtn.classList.add('active');
        renderAdminFaultsDrawerList();
    }
}

export function switchAdminFaultsTab(tab) {
    state.adminFaultTab = tab === 'resolved' ? 'resolved' : 'route';
    const btnRoute = document.getElementById('btn-admin-tab-route');
    const btnResolved = document.getElementById('btn-admin-tab-resolved');
    const viewRoute = document.getElementById('admin-faults-route-view');
    const viewResolved = document.getElementById('admin-faults-resolved-view');

    if (btnRoute) btnRoute.classList.toggle('active', state.adminFaultTab === 'route');
    if (btnResolved) btnResolved.classList.toggle('active', state.adminFaultTab === 'resolved');

    if (viewRoute) viewRoute.style.display = state.adminFaultTab === 'route' ? 'flex' : 'none';
    if (viewResolved) viewResolved.style.display = state.adminFaultTab === 'resolved' ? 'flex' : 'none';

    renderAdminFaultsDrawerList();
}

export async function fetchFaultsData() {
    try {
        const [activeData, resolvedData] = await Promise.all([
            ApiService.getFaults('BEKLIYOR'),
            ApiService.getFaults('COZULDU')
        ]);

        if (activeData.basarili) {
            state.faultsData = activeData.arizalar || [];
        }
        if (resolvedData.basarili) {
            state.resolvedFaultsData = resolvedData.arizalar || [];
        }

        const activeCount = state.faultsData.length;
        const resolvedCount = state.resolvedFaultsData.length;
        const routeCount = (state.activeNavigationRoute && state.activeNavigationRoute.duraklar) ? state.activeNavigationRoute.duraklar.length : 0;
        
        const dahiliCount = state.faultsData.filter(f => f.sorumluluk === 'DAHILI').length;
        const taseronCount = state.faultsData.filter(f => f.sorumluluk === 'TASERON').length;
        const urgentCount = state.faultsData.filter(f => (f.oncelik_puani || 0) >= 100).length;

        const elAdminQuick = document.getElementById('admin-quick-fault-count');
        if (elAdminQuick) elAdminQuick.innerText = activeCount;

        const elActiveBadge = document.getElementById('admin-active-fault-badge');
        if (elActiveBadge) elActiveBadge.innerText = activeCount;

        const elRouteBadge = document.getElementById('admin-route-fault-badge');
        if (elRouteBadge) elRouteBadge.innerText = routeCount;

        const elResolvedBadge = document.getElementById('admin-resolved-fault-badge');
        if (elResolvedBadge) elResolvedBadge.innerText = resolvedCount;

        const elSubDahili = document.getElementById('admin-subcount-dahili');
        if (elSubDahili) elSubDahili.innerText = dahiliCount;

        const elSubTaseron = document.getElementById('admin-subcount-taseron');
        if (elSubTaseron) elSubTaseron.innerText = taseronCount;

        const elCountUrgent = document.getElementById('admin-count-urgent');
        if (elCountUrgent) elCountUrgent.innerText = urgentCount;

        renderAdminFaultsDrawerList();
        renderFaultLayers();
    } catch (err) {
        console.error('Arızalar yüklenirken hata:', err);
    }
}

export function renderAdminFaultsDrawerList() {
    if (state.adminFaultTab === 'resolved') {
        renderAdminResolvedFaultsList();
    } else {
        renderAdminRouteFaultsList();
    }
}

export const renderFaultsDrawerList = renderAdminFaultsDrawerList;

export function renderAdminActiveFaultsList() {
    const listContainer = document.getElementById('admin-faults-drawer-list');
    if (!listContainer) return;

    let filtered = [...state.faultsData];

    if (state.currentFaultFilter !== 'ALL') {
        if (state.currentFaultFilter === 'DAHILI') filtered = filtered.filter(f => f.sorumluluk === 'DAHILI');
        else if (state.currentFaultFilter === 'TASERON') filtered = filtered.filter(f => f.sorumluluk === 'TASERON');
        else if (state.currentFaultFilter === 'ACIL') filtered = filtered.filter(f => (f.oncelik_puani || 0) >= 100);
        else if (state.currentFaultFilter === 'KIOSK') filtered = filtered.filter(f => f.ariza_tipi === 'KIOSK_ARIZASI');
        else if (state.currentFaultFilter === 'TURNIKE') filtered = filtered.filter(f => (f.ariza_tipi || '').includes('TURNIKE'));
    }

    if (state.currentFaultSearchTerm) {
        const term = state.currentFaultSearchTerm.toLowerCase('tr');
        filtered = filtered.filter(f => 
            (f.lokasyon_adi || '').toLowerCase('tr').includes(term) ||
            (f.ariza_metni || '').toLowerCase('tr').includes(term) ||
            (f.cihaz_etiket || '').toLowerCase('tr').includes(term)
        );
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                <div class="empty-title">Arıza Bulunamadı</div>
                <div class="empty-desc">Filtreye uygun arıza kaydı bulunmamaktadır.</div>
            </div>
        `;
        return;
    }

    let html = '';
    for (const f of filtered) {
        const isSelected = state.activeItemId === `fault_${f.id}` ? 'selected' : '';
        const isTaseron = f.sorumluluk === 'TASERON';
        const isUrgent = (f.oncelik_puani || 0) >= 100;

        html += `
            <div class="fault-item-card ${isSelected} ${isTaseron ? 'is-taseron' : ''}" onclick="window.selectFaultItem(${f.id})">
                <div class="fault-item-header">
                    <div class="fault-item-title-group">
                        <span class="fault-dot ${isTaseron ? 'dot-taseron' : (isUrgent ? 'dot-urgent' : 'dot-dahili')}"></span>
                        <span class="fault-item-title">${f.lokasyon_adi}</span>
                    </div>
                    <div class="fault-item-badges">
                        ${isTaseron ? '<span class="fault-tag tag-taseron">Taşeron</span>' : ''}
                        ${isUrgent ? '<span class="fault-tag tag-urgent">Acil</span>' : ''}
                    </div>
                </div>

                <div class="fault-item-body">${f.ariza_metni}</div>

                <div class="fault-item-footer">
                    <span class="fault-item-date">${f.bildirim_zamani ? f.bildirim_zamani.substring(0, 16) : ''}</span>
                    <div class="fault-item-actions" onclick="event.stopPropagation()">
                        <button class="btn-subtle" onclick="window.toggleFaultResponsibility(${f.id})" title="Sorumluluk değiştir">
                            ${isTaseron ? 'Dahiliye Al' : 'Taşerona Ata'}
                        </button>
                        <button class="btn-subtle btn-subtle-success" onclick="window.resolveSpecificFault(${f.id})" title="Onarıldı olarak işaretle">
                            Onar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    listContainer.innerHTML = html;
}

export function renderAdminRouteFaultsList() {
    const listContainer = document.getElementById('admin-route-faults-list');
    const summaryEl = document.getElementById('admin-route-view-summary');
    const routeBadgeEl = document.getElementById('admin-route-fault-badge');
    if (!listContainer) return;

    const duraklar = (state.activeNavigationRoute && state.activeNavigationRoute.duraklar) || [];
    if (routeBadgeEl) routeBadgeEl.innerText = duraklar.length;

    if (summaryEl) {
        if (state.activeNavigationRoute && state.activeNavigationRoute.toplam_mesafe_km) {
            summaryEl.innerText = `${duraklar.length} Durak • ${state.activeNavigationRoute.toplam_mesafe_km} km • ~${state.activeNavigationRoute.toplam_sure_dk} dk`;
        } else {
            summaryEl.innerText = 'Bekleyen rota görevi bulunmamaktadır.';
        }
    }

    let filtered = [...duraklar];
    if (state.currentRouteSearchTerm) {
        const term = state.currentRouteSearchTerm.toLowerCase('tr');
        filtered = filtered.filter(st => 
            (st.lokasyon_adi || '').toLowerCase('tr').includes(term) ||
            (st.ariza_metni || '').toLowerCase('tr').includes(term)
        );
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                <div class="empty-title">Rota Görevi Bulunamadı</div>
                <div class="empty-desc">Aracın rotasında bekleyen arıza kaydı bulunmamaktadır.</div>
            </div>
        `;
        return;
    }

    let html = '';
    for (let i = 0; i < filtered.length; i++) {
        const st = filtered[i];
        const isCurrent = i === 0;
        const isTaseron = st.sorumluluk === 'TASERON';

        html += `
            <div class="fault-item-card ${isCurrent ? 'selected' : ''}" onclick="window.focusOnLeg(${i})">
                <div class="fault-item-header">
                    <div class="fault-item-title-group">
                        <span class="fault-seq-badge ${isCurrent ? 'seq-current' : ''}">#${st.sira_no || (i + 1)}</span>
                        <span class="fault-item-title">${st.lokasyon_adi}</span>
                    </div>
                    <div class="fault-item-badges">
                        ${isTaseron ? '<span class="fault-tag tag-taseron">Taşeron</span>' : ''}
                        <span class="fault-tag" style="background:var(--bg-base); color:var(--text-muted); border:1px solid var(--border-card);">${st.bacak_mesafe_km} km</span>
                    </div>
                </div>

                <div class="fault-item-body">${st.ariza_metni}</div>

                <div class="fault-item-footer">
                    <span class="fault-item-date">~${st.bacak_sure_dk} dk sürüş</span>
                    <div class="fault-item-actions" onclick="event.stopPropagation()">
                        <button class="btn-subtle" onclick="window.toggleFaultResponsibility(${st.id})" title="Sorumluluk değiştir">
                            ${isTaseron ? 'Dahiliye Al' : 'Taşerona Ata'}
                        </button>
                        <button class="btn-subtle btn-subtle-success" onclick="window.resolveSpecificFault(${st.id})" title="Onarıldı olarak işaretle">
                            Onar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    listContainer.innerHTML = html;
}

export function renderAdminResolvedFaultsList() {
    const listContainer = document.getElementById('admin-resolved-faults-list');
    if (!listContainer) return;

    let filtered = [...state.resolvedFaultsData];

    if (state.currentResolvedFaultSearchTerm) {
        const term = state.currentResolvedFaultSearchTerm.toLowerCase('tr');
        filtered = filtered.filter(f => 
            (f.lokasyon_adi || '').toLowerCase('tr').includes(term) ||
            (f.ariza_metni || '').toLowerCase('tr').includes(term)
        );
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <div class="empty-title">Onarılan Kayıt Yok</div>
                <div class="empty-desc">Sistemde henüz çözülmüş arıza kaydı bulunmuyor.</div>
            </div>
        `;
        return;
    }

    let html = '';
    const isAdmin = state.currentUser && state.currentUser.rol === 'ADMIN';
    for (const f of filtered) {
        const isTaseron = f.sorumluluk === 'TASERON';
        const adminDeleteBtn = isAdmin ? `
            <button class="btn-subtle btn-subtle-danger" onclick="window.deleteFaultAction(${f.id})" title="Kaydı sil">
                Sil
            </button>
        ` : '';

        html += `
            <div class="fault-item-card resolved" onclick="window.selectFaultItem(${f.id})">
                <div class="fault-item-header">
                    <div class="fault-item-title-group">
                        <span class="fault-dot dot-resolved"></span>
                        <span class="fault-item-title">${f.lokasyon_adi}</span>
                    </div>
                    <div class="fault-item-badges">
                        ${isTaseron ? '<span class="fault-tag tag-taseron">Taşeron</span>' : ''}
                    </div>
                </div>

                <div class="fault-item-body" style="color: var(--text-muted);">${f.ariza_metni}</div>

                <div class="fault-item-footer">
                    <span class="fault-item-date">${f.cozum_zamani ? 'Onarım: ' + f.cozum_zamani.substring(0, 16) : 'Tamamlandı'}</span>
                    <div class="fault-item-actions" onclick="event.stopPropagation()">
                        <button class="btn-subtle" onclick="window.reopenFaultAction(${f.id})" title="Yeniden aç">
                            Yeniden Aç
                        </button>
                        ${adminDeleteBtn}
                    </div>
                </div>
            </div>
        `;
    }

    listContainer.innerHTML = html;
}

export function findAssociatedStationOrKioskId(f) {
    if (!f || !state.appData) return { type: null, id: null };

    if (f.istasyon_id && state.appData.istasyonlar) {
        if (state.appData.istasyonlar[f.istasyon_id]) {
            return { type: 'station', id: String(f.istasyon_id) };
        }
        const stList = Array.isArray(state.appData.istasyonlar) ? state.appData.istasyonlar : Object.values(state.appData.istasyonlar);
        const st = stList.find(s => s && (s.id === f.istasyon_id || String(s.id) === String(f.istasyon_id)));
        if (st) return { type: 'station', id: String(st.id) };
    }

    if (f.kiosk_id && state.appData.kiosklar) {
        const kList = Array.isArray(state.appData.kiosklar) ? state.appData.kiosklar : Object.values(state.appData.kiosklar);
        const k = kList.find(item => item && (item.id === f.kiosk_id || String(item.id) === String(f.kiosk_id) || item.kiosk_kodu === f.kiosk_kodu));
        if (k) return { type: 'kiosk', id: String(k.id || k.kiosk_kodu) };
    }

    if (f.cihaz_id && state.appData.istasyonlar) {
        const stList = Array.isArray(state.appData.istasyonlar) ? state.appData.istasyonlar : Object.values(state.appData.istasyonlar);
        for (const st of stList) {
            if (st && st.cihazlar && st.cihazlar.some(d => d.id === f.cihaz_id || String(d.id) === String(f.cihaz_id) || d.cihaz_id === f.cihaz_kodu)) {
                return { type: 'station', id: String(st.id) };
            }
        }
    }

    if (f.lokasyon_adi) {
        const normLoc = f.lokasyon_adi.toLowerCase().trim();
        if (state.appData.istasyonlar) {
            const stList = Array.isArray(state.appData.istasyonlar) ? state.appData.istasyonlar : Object.values(state.appData.istasyonlar);
            for (const st of stList) {
                if (st && st.ad && (normLoc.includes(st.ad.toLowerCase()) || st.ad.toLowerCase().includes(normLoc))) {
                    return { type: 'station', id: String(st.id) };
                }
            }
        }
        if (state.appData.kiosklar) {
            const kList = Array.isArray(state.appData.kiosklar) ? state.appData.kiosklar : Object.values(state.appData.kiosklar);
            const k = kList.find(item => item && item.ad && (normLoc.includes(item.ad.toLowerCase()) || item.ad.toLowerCase().includes(normLoc)));
            if (k) return { type: 'kiosk', id: String(k.id || k.kiosk_kodu) };
        }
    }

    return { type: null, id: null };
}

export function renderFaultLayers() {
    if (!layerGroups.faults) return;
    layerGroups.faults.clearLayers();

    const activeRole = state.activeRoleView || 'saha';
    const isSaha = activeRole === 'saha';
    const roleState = (state.roleLayerStates && state.roleLayerStates[activeRole]) ? state.roleLayerStates[activeRole] : { faults: true };
    const isFaultsEnabled = roleState.faults !== false;

    const map = getMap();
    if (!isFaultsEnabled) {
        if (map && map.hasLayer(layerGroups.faults)) {
            map.removeLayer(layerGroups.faults);
        }
        return;
    }

    if (map && !map.hasLayer(layerGroups.faults)) {
        map.addLayer(layerGroups.faults);
    }

    const stopVehicleMap = new Map();
    const dualSummary = state.activeNavigationRoute?.cift_arac_ozeti;

    if (dualSummary) {
        Object.values(dualSummary).forEach((vehSummary) => {
            const vehicleStops = vehSummary.duraklar || [];
            const imei = vehSummary.imei;
            const plaka = vehSummary.plaka || (imei === '861000000000002' ? '38 BKM 002' : '38 BKM 001');
            const is089 = imei === '861000000000002';

            vehicleStops.forEach((st) => {
                const fId = st.id ?? st.ariza_id;
                if (fId !== undefined && fId !== null) {
                    stopVehicleMap.set(Number(fId), {
                        orderNo: st.sira_no,
                        imei: imei,
                        plaka: plaka,
                        shortPlate: is089 ? '089' : '093',
                        color: is089 ? '#f59e0b' : '#10b981',
                        vehClass: is089 ? 'veh-089' : 'veh-093'
                    });
                }
            });
        });
    }

    if (stopVehicleMap.size === 0) {
        const navStops = state.activeNavigationRoute?.duraklar || [];
        const is089Active = state.activeVehicleImei === '861000000000002';
        navStops.forEach((st) => {
            const fId = st.id ?? st.ariza_id;
            if (fId !== undefined && fId !== null) {
                stopVehicleMap.set(Number(fId), {
                    orderNo: st.sira_no,
                    imei: state.activeVehicleImei,
                    plaka: is089Active ? '38 BKM 002' : '38 BKM 001',
                    shortPlate: is089Active ? '089' : '093',
                    color: is089Active ? '#f59e0b' : '#10b981',
                    vehClass: is089Active ? 'veh-089' : 'veh-093'
                });
            }
        });
    }

    const resolveFaultCoords = (f) => {
        let lat = (f.enlem !== undefined && f.enlem !== null && f.enlem !== '') ? Number(f.enlem) : null;
        let lon = (f.boylam !== undefined && f.boylam !== null && f.boylam !== '') ? Number(f.boylam) : null;

        if ((!lat || !lon) && state.appData) {
            const assoc = findAssociatedStationOrKioskId(f);
            if (assoc.type === 'station' && assoc.id && state.appData.istasyonlar) {
                const st = state.appData.istasyonlar[assoc.id] ||
                    (Array.isArray(state.appData.istasyonlar)
                        ? state.appData.istasyonlar.find(s => s && String(s.id) === String(assoc.id))
                        : Object.values(state.appData.istasyonlar).find(s => s && String(s.id) === String(assoc.id)));
                if (st && st.enlem && st.boylam) {
                    lat = Number(st.enlem);
                    lon = Number(st.boylam);
                }
            } else if (assoc.type === 'kiosk' && assoc.id && state.appData.kiosklar) {
                const kList = Array.isArray(state.appData.kiosklar) ? state.appData.kiosklar : Object.values(state.appData.kiosklar);
                const k = kList.find(item => item && (String(item.id) === String(assoc.id) || item.kiosk_kodu === assoc.id));
                if (k && k.enlem && k.boylam) {
                    lat = Number(k.enlem);
                    lon = Number(k.boylam);
                }
            }
        }
        return { lat, lon };
    };

    const groupsByLocation = new Map();
    const processedFaultIds = new Set();

    // 1. Process state.faultsData
    (state.faultsData || []).forEach((f, idx) => {
        const { lat, lon } = resolveFaultCoords(f);
        if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;

        f.enlem = lat;
        f.boylam = lon;
        processedFaultIds.add(Number(f.id));

        const normLoc = (f.lokasyon_adi || '').trim().toLowerCase();
        const roundedLat = lat.toFixed(3);
        const roundedLon = lon.toFixed(3);
        const key = normLoc ? `loc_${normLoc}_${roundedLat}_${roundedLon}` : `coord_${roundedLat}_${roundedLon}`;

        if (!groupsByLocation.has(key)) {
            groupsByLocation.set(key, []);
        }

        const vehInfo = stopVehicleMap.get(Number(f.id));
        const orderNo = vehInfo ? vehInfo.orderNo : (idx + 1);
        const vehClass = vehInfo ? vehInfo.vehClass : 'future';
        const shortPlate = vehInfo ? vehInfo.shortPlate : (f.sorumluluk === 'TASERON' ? 'TŞR' : 'ARZ');

        groupsByLocation.get(key).push({ fault: f, orderNo, vehInfo, vehClass, shortPlate });
    });

    // 2. Process any remaining navigation stops (e.g. from activeNavigationRoute) not in state.faultsData
    if (stopVehicleMap.size > 0) {
        stopVehicleMap.forEach((vehInfo, faultId) => {
            if (processedFaultIds.has(Number(faultId))) return;

            const navStops = state.activeNavigationRoute?.duraklar || [];
            const navStop = navStops.find(st => Number(st.id ?? st.ariza_id) === Number(faultId));
            if (!navStop) return;

            const { lat, lon } = resolveFaultCoords(navStop);
            if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;

            navStop.enlem = lat;
            navStop.boylam = lon;
            processedFaultIds.add(Number(faultId));

            const normLoc = (navStop.lokasyon_adi || '').trim().toLowerCase();
            const roundedLat = lat.toFixed(3);
            const roundedLon = lon.toFixed(3);
            const key = normLoc ? `loc_${normLoc}_${roundedLat}_${roundedLon}` : `coord_${roundedLat}_${roundedLon}`;

            if (!groupsByLocation.has(key)) {
                groupsByLocation.set(key, []);
            }

            groupsByLocation.get(key).push({
                fault: navStop,
                orderNo: vehInfo.orderNo,
                vehInfo: vehInfo,
                vehClass: vehInfo.vehClass,
                shortPlate: vehInfo.shortPlate
            });
        });
    }

    const currentSahaImei = state.sahaActiveVehicleImei || state.activeVehicleImei;

    groupsByLocation.forEach((items) => {
        if (isSaha && currentSahaImei && stopVehicleMap.size > 0) {
            const filtered = items.filter(it => !it.vehInfo || it.vehInfo.imei === currentSahaImei);
            if (filtered.length === 0) return;
            items = filtered;
        }

        const firstItem = items[0];
        const lat = firstItem.fault.enlem;
        const lon = firstItem.fault.boylam;
        const locationName = firstItem.fault.lokasyon_adi;
        const assoc = findAssociatedStationOrKioskId(firstItem.fault);

        items.sort((a, b) => a.orderNo - b.orderNo);
        const minOrder = items[0].orderNo;
        const hasFirst = items.some(it => it.orderNo === 1);
        const hasSecond = items.some(it => it.orderNo === 2);
        const primaryItem = items[0];
        const containerClass = primaryItem.vehClass ? `mission-pin-${primaryItem.vehClass}` : 'mission-pin-future';

        let pinHtml = '';
        let iconSize = [64, 32];
        let iconAnchor = [32, 16];

        if (items.length === 1) {
            const orderLabel = primaryItem.vehInfo ? `${primaryItem.shortPlate} #${primaryItem.orderNo}` : `#${primaryItem.orderNo}`;
            pinHtml = `
                <div class="custom-pin fault-number-pin ${containerClass}" style="min-width:62px; width:auto; padding: 2px 8px;">
                    <span style="font-size:11.5px; font-weight:900; font-family:var(--font-sans); line-height:1; white-space:nowrap;">${orderLabel}</span>
                </div>
                <div class="marker-sub-label fault-name-label">${locationName}</div>
            `;
            iconSize = [68, 32];
            iconAnchor = [34, 16];
        } else {
            const badgesHtml = items.map(it => {
                const miniClass = it.vehClass ? `mini-badge-${it.vehClass}` : 'mini-badge-future';
                const label = it.vehInfo ? `${it.shortPlate} #${it.orderNo}` : `#${it.orderNo}`;
                return `<span class="fault-mini-num-badge ${miniClass}" style="padding:2px 6px; min-width:auto; font-size:11px; font-weight:800;">${label}</span>`;
            }).join('');

            const width = Math.max(75, items.length * 52 + 16);
            pinHtml = `
                <div class="custom-pin fault-multi-number-pin ${containerClass}" style="min-width:${width}px; width:auto; padding: 2px 6px;">
                    ${badgesHtml}
                </div>
                <div class="marker-sub-label fault-name-label">${locationName}</div>
            `;
            iconSize = [width + 12, 38];
            iconAnchor = [Math.floor((width + 12) / 2), 19];
        }

        const faultIcon = L.divIcon({
            className: 'custom-pin-wrap',
            html: pinHtml,
            iconSize: iconSize,
            iconAnchor: iconAnchor,
            popupAnchor: [0, -iconAnchor[1]]
        });

        let itemsPopupHtml = '';
        items.forEach((it) => {
            const f = it.fault;
            const isTaseron = f.sorumluluk === 'TASERON';
            const actionBtn = isSaha
                ? `<button class="btn btn-xs btn-success" style="width:100%; margin-top:6px;" onclick="window.resolveSpecificFault(${f.id})">Bu Arızayı Onar & İlerle</button>`
                : `<button class="btn btn-xs btn-outline" style="width:100%; margin-top:6px;" onclick="window.toggleAdminFaultsDrawer()">Arıza Paneline Git</button>`;

            let itemBadgeBg = '#334155';
            let itemTagText = `${it.orderNo}. GELECEK GÖREV`;
            if (it.orderNo === 1) {
                itemBadgeBg = '#ef4444';
                itemTagText = '1. HEDEF (Aktif Odak)';
            } else if (it.orderNo === 2) {
                itemBadgeBg = '#f97316';
                itemTagText = '2. SIRADAKİ GÖREV';
            }

            itemsPopupHtml += `
                <div style="padding:${items.length > 1 ? '8px 0' : '0'}; border-bottom:${items.length > 1 ? '1px solid var(--border-subtle)' : 'none'};">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                        <span class="category-badge" style="background-color:${itemBadgeBg}; color:#ffffff; font-weight:800; font-size:10px;">
                            ${itemTagText} • ${f.oncelik_seviyesi || 'ÖNCELİKLİ'}
                        </span>
                        <span class="status-badge" style="background-color:${isTaseron ? '#475569' : '#1e3a8a'}; color:#ffffff; font-size:9px;">
                            ${isTaseron ? 'TAŞERON' : 'DAHİLİ'}
                        </span>
                    </div>
                    <div class="popup-meta" style="color:#ef4444; font-weight:700; margin-top:4px;">${f.ariza_metni}</div>
                    ${actionBtn}
                </div>
            `;
        });

        const multiHeader = items.length > 1
            ? `<div style="font-size:11px; color:#38bdf8; font-weight:700; margin-bottom:4px;">Bu Lokasyonda Toplam ${items.length} Arıza Bulunuyor</div>`
            : '';

        let detailBtn = '';
        const isAdmin = state.currentUser && state.currentUser.rol === 'ADMIN';
        if (isAdmin) {
            if (assoc.type === 'station' && window.selectStation) {
                detailBtn = `<button class="btn btn-xs btn-primary" style="width:100%; margin-top:8px;" onclick="event.stopPropagation(); window.selectStation('${assoc.id}')">İstasyon Donanım Paneli</button>`;
            } else if (assoc.type === 'kiosk' && window.selectKiosk) {
                detailBtn = `<button class="btn btn-xs btn-primary" style="width:100%; margin-top:8px;" onclick="event.stopPropagation(); window.selectKiosk('${assoc.id}')">Kiosk Donanım Paneli</button>`;
            }
        }

        let markerZIndex = 2000 - minOrder * 10;
        if (hasFirst) markerZIndex = 3000;
        else if (hasSecond) markerZIndex = 2500;

        const marker = L.marker([lat, lon], { icon: faultIcon, zIndexOffset: markerZIndex })
            .bindPopup(`
                <div class="popup-card" style="min-width:240px;">
                    <div class="popup-title">${locationName}</div>
                    ${multiHeader}
                    <div style="margin-top:6px;">
                        ${itemsPopupHtml}
                    </div>
                    ${detailBtn}
                </div>
            `);

        marker.on('click', () => {
            const isAdmin = state.currentUser && state.currentUser.rol === 'ADMIN';
            if (isAdmin) {
                if (assoc.type === 'station' && window.selectStation) {
                    window.selectStation(assoc.id, false);
                } else if (assoc.type === 'kiosk' && window.selectKiosk) {
                    window.selectKiosk(assoc.id, false);
                }
            }
        });

        layerGroups.faults.addLayer(marker);
        items.forEach(it => {
            markersMap[`fault_${it.fault.id}`] = marker;
        });
    });
}

export function selectFault(faultId) {
    let fault = state.faultsData.find(f => f.id === faultId);
    if (!fault) {
        fault = state.resolvedFaultsData.find(f => f.id === faultId);
    }
    if (!fault) return;

    state.activeItemId = `fault_${faultId}`;
    state.activeItemType = 'ARIZA';

    const map = getMap();
    if (map && fault.enlem && fault.boylam) {
        if (!map.hasLayer(layerGroups.faults)) {
            map.addLayer(layerGroups.faults);
            const toggleFl = document.getElementById('toggle-faults');
            if (toggleFl) toggleFl.checked = true;
        }
        map.flyTo([fault.enlem, fault.boylam], 16, { duration: 0.8 });
        const marker = markersMap[`fault_${faultId}`];
        if (marker) marker.openPopup();
    }

    const isAdmin = state.currentUser && state.currentUser.rol === 'ADMIN';
    if (isAdmin) {
        const assoc = findAssociatedStationOrKioskId(fault);
        if (assoc.type === 'station' && window.selectStation) {
            window.selectStation(assoc.id, false);
        } else if (assoc.type === 'kiosk' && window.selectKiosk) {
            window.selectKiosk(assoc.id, false);
        }
    }

    renderAdminFaultsDrawerList();
}
