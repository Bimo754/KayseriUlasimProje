/**
 * Kayseri Ulaşım - Harita Yöneticisi (Leaflet Harita, Katmanlar & Özel Pinler)
 */

import { state, layerGroups, markersMap } from './state.js';
import { closeAllDrawers, showToast } from './ui_utils.js';

let mapInstance = null;
let mainTileLayer = null;

export function getMap() {
    return mapInstance;
}

const CARTO_API_KEY = 'cb1_2g1p_1_6ded88ff531a205f2b724cea';

export function setMapTileTheme(theme) {
    if (!mainTileLayer) return;
    const tileUrl = (theme === 'light')
        ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`
        : `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;
    mainTileLayer.setUrl(tileUrl);
}

if (typeof window !== 'undefined') {
    window.setMapTileTheme = setMapTileTheme;
    window.getMap = getMap;
}

export function initMap(onCoordPickedCallback) {
    if (mapInstance) return mapInstance;

    mapInstance = L.map('map', {
        center: [38.725, 35.500],
        zoom: 13,
        zoomControl: false,
        preferCanvas: true,
        wheelDebounceTime: 30,
        wheelPxPerZoomLevel: 120,
        updateWhenZooming: false,
        updateWhenIdle: true,
        keepBuffer: 3
    });

    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

    const activeTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const tileUrl = (activeTheme === 'light')
        ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`
        : `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;

    mainTileLayer = L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        subdomains: 'abcd',
        tileSize: 256,
        keepBuffer: 3,
        updateWhenIdle: true,
        crossOrigin: true
    }).addTo(mapInstance);

    // Automatic silent tile error fallback to Esri World Dark / OpenStreetMap
    mainTileLayer.on('tileerror', (errorTile) => {
        if (errorTile.tile && !errorTile.tile.dataset.fallbackTried) {
            errorTile.tile.dataset.fallbackTried = 'true';
            const z = errorTile.coords.z;
            const x = errorTile.coords.x;
            const y = errorTile.coords.y;
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            if (currentTheme === 'light') {
                errorTile.tile.src = `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`;
            } else {
                errorTile.tile.src = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${z}/${y}/${x}`;
            }
        }
    });

    layerGroups.route = L.layerGroup().addTo(mapInstance);
    layerGroups.faults = L.layerGroup().addTo(mapInstance);
    layerGroups.lines = L.layerGroup();
    layerGroups.stations = L.layerGroup();
    layerGroups.kiosks = L.layerGroup();
    layerGroups.bayiler = L.layerGroup();
    layerGroups.base = L.layerGroup().addTo(mapInstance);
    layerGroups.vehicle = L.layerGroup().addTo(mapInstance);

    // Haritaya tıklanma olayı
    mapInstance.on('click', (e) => {
        if (state.coordPickingTarget) {
            handleMapCoordPicked(e.latlng.lat, e.latlng.lng);
            if (onCoordPickedCallback) onCoordPickedCallback(e.latlng.lat, e.latlng.lng);
            return;
        }
        closeAllDrawers();
    });

    return mapInstance;
}

/**
 * Rol Bazlı Katman Görünürlüğü
 * Saha Görünümü: Sadece Araç (Car), Ana Üs (Home), Sürüş Rotası (Route) ve Arıza Noktaları gösterilir.
 * Admin Görünümü: Tüm GIS katmanları (İstasyonlar, Hatlar, Kiosklar vb.) aktiftir.
 */
export function applyRoleLayerVisibility(roleView) {
    if (!mapInstance) return;

    const currentRole = (roleView === 'admin' || roleView === 'saha') ? roleView : (state.activeRoleView || 'saha');
    const roleState = (state.roleLayerStates && state.roleLayerStates[currentRole]) ? state.roleLayerStates[currentRole] : {
        route: true, faults: true, lines: currentRole === 'admin', stations: currentRole === 'admin', stationNames: true, kiosks: currentRole === 'admin', kioskNames: false, bayiler: false
    };

    const toggleRt = document.getElementById('toggle-route');
    const toggleFl = document.getElementById('toggle-faults');
    const toggleLn = document.getElementById('toggle-lines');
    const toggleSt = document.getElementById('toggle-stations');
    const toggleStNames = document.getElementById('toggle-station-names');
    const toggleKsk = document.getElementById('toggle-kiosks');
    const toggleKskNames = document.getElementById('toggle-kiosk-names');
    const toggleBayi = document.getElementById('toggle-bayiler');

    // DOM Checkbox özniteliklerini ilgili rolün bağımsız durumları ile eşle
    if (toggleRt) toggleRt.checked = !!roleState.route;
    if (toggleFl) toggleFl.checked = !!roleState.faults;
    if (toggleLn) toggleLn.checked = !!roleState.lines;
    if (toggleSt) toggleSt.checked = !!roleState.stations;
    if (toggleStNames) toggleStNames.checked = !!roleState.stationNames;
    if (toggleKsk) toggleKsk.checked = !!roleState.kiosks;
    if (toggleKskNames) toggleKskNames.checked = !!roleState.kioskNames;
    if (toggleBayi) toggleBayi.checked = !!roleState.bayiler;

    // Her zaman açık katmanlar (Araç ve Ana Garaj)
    if (layerGroups.vehicle && !mapInstance.hasLayer(layerGroups.vehicle)) mapInstance.addLayer(layerGroups.vehicle);
    if (layerGroups.base && !mapInstance.hasLayer(layerGroups.base)) mapInstance.addLayer(layerGroups.base);

    // Harita katman görünürlüklerini doğrudan roleState verisinden senkronize et
    const syncLayer = (isEnabled, layerGroup) => {
        if (!layerGroup || !mapInstance) return;
        if (isEnabled) {
            if (!mapInstance.hasLayer(layerGroup)) mapInstance.addLayer(layerGroup);
        } else {
            if (mapInstance.hasLayer(layerGroup)) mapInstance.removeLayer(layerGroup);
        }
    };

    syncLayer(roleState.route, layerGroups.route);
    syncLayer(roleState.faults, layerGroups.faults);
    syncLayer(roleState.lines, layerGroups.lines);
    syncLayer(roleState.stations, layerGroups.stations);
    syncLayer(roleState.kiosks, layerGroups.kiosks);
    syncLayer(roleState.bayiler, layerGroups.bayiler);

    // İsim etiketlerinin harita görünürlük sınıflarını senkronize et
    const mapEl = document.getElementById('map');
    if (mapEl) {
        mapEl.classList.toggle('show-station-names', !!roleState.stationNames);
        mapEl.classList.toggle('show-kiosk-names', !!roleState.kioskNames);
    }
}

export function renderMapLayers(appData, currentUser, handlers = {}) {
    if (!appData || !mapInstance) return;

    layerGroups.lines.clearLayers();
    layerGroups.stations.clearLayers();
    layerGroups.kiosks.clearLayers();
    layerGroups.bayiler.clearLayers();
    layerGroups.base.clearLayers();

    // 1. Ana Üs (Merkez Depo & Garaj / Home)
    const anaUs = appData.ana_us;
    if (anaUs && anaUs.enlem && anaUs.boylam) {
        const baseIcon = L.divIcon({
            className: 'custom-pin-wrap',
            html: `
                <div class="custom-pin pin-base" style="width:38px; height:38px;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                </div>
            `,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
            popupAnchor: [0, -19]
        });

        const baseMarker = L.marker([anaUs.enlem, anaUs.boylam], { icon: baseIcon })
            .bindPopup(`
                <div class="popup-card">
                    <span class="category-badge" style="background-color:#881337; color:#fecdd3;">BAKIM ÜSSÜ & MERKEZ GARAJ</span>
                    <div class="popup-title" style="margin-top:4px;">${anaUs.ad}</div>
                    <div class="popup-meta">${anaUs.adres}</div>
                    <div class="popup-meta"><strong>Koordinat:</strong> 38°42'51.3"N 35°29'28.0"E</div>
                </div>
            `);

        layerGroups.base.addLayer(baseMarker);
        markersMap[anaUs.id] = baseMarker;
    }

    // 2. Hat Çizgileri
    const hatlar = appData.hatlar || {};
    for (const [hatKod, hatData] of Object.entries(hatlar)) {
        const coords = (hatData.istasyonlar || []).map(st => [st.enlem, st.boylam]);
        if (coords.length > 1) {
            const polyline = L.polyline(coords, {
                color: hatData.renk || '#3b82f6',
                weight: 4.5,
                opacity: 0.85,
                smoothFactor: 1
            }).bindTooltip(`<b>${hatData.ad}</b> (${hatData.istasyon_sayisi} İstasyon)`, { sticky: true });

            layerGroups.lines.addLayer(polyline);
        }
    }

    // 3. İstasyon İşaretçileri (75 İstasyon)
    const istasyonlar = appData.istasyonlar || {};
    const activeFaults = state.faultsData || [];
    for (const [stId, st] of Object.entries(istasyonlar)) {
        const isStationDisabled = st.aktif === false || st.aktif === 0;
        const primaryLine = (st.hatlar && st.hatlar.length > 0) ? st.hatlar[0] : 'T1';
        const lineColors = { 'T1': '#ef4444', 'T2': '#3b82f6', 'T3': '#10b981', 'T4': '#f97316' };
        
        let pinColor = lineColors[primaryLine] || '#0f172a';
        let pinStyle = `width:28px; height:28px; background-color:${pinColor};`;

        if (isStationDisabled) {
            pinColor = '#475569';
            pinStyle = `width:28px; height:28px; background-color:#334155; border: 2px dashed #dc2626; opacity: 0.75; filter: grayscale(100%);`;
        }

        const stHasFault = activeFaults.some(f => 
            (f.durum === 'BEKLIYOR' || f.durum === 'BEKLEMEDE') && 
            (f.istasyon_id === Number(stId) || (f.lokasyon_adi && f.lokasyon_adi.toLowerCase().includes(st.ad.toLowerCase())))
        );

        let stLabelClass = stHasFault 
            ? 'marker-sub-label station-name-label fault-station-forced-label' 
            : 'marker-sub-label station-name-label';

        if (isStationDisabled) {
            stLabelClass += ' disabled-element-label';
        }

        const stationIcon = L.divIcon({
            className: 'custom-pin-wrap',
            html: `
                <div class="custom-pin pin-station" style="${pinStyle}">
                    <span style="font-size:10px; font-weight:700;">${isStationDisabled ? 'PASİF' : primaryLine}</span>
                </div>
                <div class="${stLabelClass}">${st.ad}${isStationDisabled ? ' (KAPALI)' : ''}</div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -14]
        });

        let popupContent = '';
        if (isStationDisabled) {
            popupContent = `
                <div class="popup-card">
                    <div style="margin-bottom:6px;">
                        <span class="status-badge status-urgent" style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:9999px; background:rgba(239, 68, 68, 0.15); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.35);">PASİF / HİZMET DIŞI</span>
                    </div>
                    <div class="popup-title" style="font-size:13.5px; font-weight:700; color:var(--text-head); margin-bottom:2px;">${st.ad}</div>
                    <div class="popup-meta" style="font-size:11px; color:var(--text-sub); margin-bottom:8px;">Hatlar: ${st.hatlar ? st.hatlar.join(' • ') : '-'} (Geçici Kapalı)</div>
                    <button class="btn btn-xs btn-success" style="width:100%; height:28px; font-size:11px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:5px;" onclick="event.stopPropagation(); window.toggleStationActiveStatus('${st.db_id || stId}', true)">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span>Yeniden Aktifleştir</span>
                    </button>
                </div>
            `;
        } else {
            let adminDeactivateBtn = '';
            if (currentUser && currentUser.rol === 'ADMIN') {
                adminDeactivateBtn = `
                    <button class="popup-btn" style="flex:1; height:28px; padding:0 8px; font-size:11.5px; font-weight:600; background:rgba(239, 68, 68, 0.12); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.3); display:flex; align-items:center; justify-content:center; white-space:nowrap;" onclick="event.stopPropagation(); window.toggleStationActiveStatus('${st.db_id || stId}', false)" title="İstasyonu Pasife Çek">
                        <span>Pasife Çek</span>
                    </button>
                `;
            }
            popupContent = `
                <div class="popup-card">
                    <span class="category-badge">TRAMVAY İSTASYONU</span>
                    <div class="popup-title" style="margin-top:4px;">${st.ad}</div>
                    <div class="popup-meta">Hatlar: ${st.hatlar ? st.hatlar.join(' • ') : '-'}</div>
                    <div style="display:flex; gap:6px; margin-top:8px;">
                        <button class="popup-btn" id="btn-popup-st-${stId}" onclick="event.stopPropagation(); window.selectStation('${stId}')" style="flex:1.4; height:28px; padding:0 8px; font-size:11.5px; font-weight:600; display:flex; align-items:center; justify-content:center; white-space:nowrap;">İstasyon Detayı</button>
                        ${adminDeactivateBtn}
                    </div>
                </div>
            `;
        }

        const stMarker = L.marker([st.enlem, st.boylam], { icon: stationIcon })
            .bindTooltip(`<b>${st.ad}</b> ${isStationDisabled ? '<b style="color:#ef4444;">(PASİF / KAPALI)</b>' : `(${st.hatlar ? st.hatlar.join(', ') : ''})`}`, { direction: 'top' })
            .bindPopup(popupContent);

        stMarker.on('click', () => {
            if (handlers.onSelectStation) handlers.onSelectStation(stId);
        });

        stMarker.on('popupopen', () => {
            const btn = document.getElementById(`btn-popup-st-${stId}`);
            if (btn) {
                btn.onclick = (e) => {
                    if (e) e.stopPropagation();
                    if (handlers.onSelectStation) handlers.onSelectStation(stId);
                };
            }
        });

        layerGroups.stations.addLayer(stMarker);
        markersMap[stId] = stMarker;
    }

    // 4. Otomatik Kiosklar (105 Kiosk)
    const kiosklar = appData.kiosklar || [];
    for (const kiosk of kiosklar) {
        const isKioskDisabled = kiosk.aktif === false || kiosk.aktif === 0 || kiosk.durum === 'PASIF';
        const kskHasFault = activeFaults.some(f => 
            (f.durum === 'BEKLIYOR' || f.durum === 'BEKLEMEDE') && 
            (f.kiosk_id === Number(kiosk.id) || (f.lokasyon_adi && f.lokasyon_adi.toLowerCase().includes(kiosk.ad.toLowerCase())))
        );

        let kskLabelClass = kskHasFault 
            ? 'marker-sub-label kiosk-name-label fault-station-forced-label' 
            : 'marker-sub-label kiosk-name-label';

        if (isKioskDisabled) {
            kskLabelClass += ' disabled-element-label';
        }

        let kskPinStyle = 'width:24px; height:24px;';
        if (isKioskDisabled) {
            kskPinStyle = 'width:24px; height:24px; background-color:#334155; border: 2px dashed #dc2626; opacity: 0.75; filter: grayscale(100%);';
        }

        const kioskIcon = L.divIcon({
            className: 'custom-pin-wrap',
            html: `
                <div class="custom-pin pin-kiosk" style="${kskPinStyle}">
                    <span style="font-size:10px; font-weight:700;">${isKioskDisabled ? 'OFF' : 'K'}</span>
                </div>
                <div class="${kskLabelClass}">${kiosk.ad}${isKioskDisabled ? ' (PASİF)' : ''}</div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12]
        });

        const targetKioskCode = kiosk.kiosk_kodu || kiosk.id;
        let adminPopupButtons = '';
        if (currentUser && currentUser.rol === 'ADMIN') {
            let statusBtnHtml = '';
            if (isKioskDisabled) {
                statusBtnHtml = `
                    <button class="popup-btn" style="flex:1; background:rgba(16, 185, 129, 0.15); color:#10b981; border:1px solid rgba(16, 185, 129, 0.3);" onclick="event.stopPropagation(); window.toggleKioskActiveStatus('${targetKioskCode}', true)" title="Kiosku Yeniden Aktifleştir">
                        <span>Aktifleştir</span>
                    </button>
                `;
            } else {
                statusBtnHtml = `
                    <button class="popup-btn" style="flex:1; background:rgba(239, 68, 68, 0.12); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.3);" onclick="event.stopPropagation(); window.toggleKioskActiveStatus('${targetKioskCode}', false)" title="Kiosku Pasife Çek">
                        <span>Pasife Çek</span>
                    </button>
                `;
            }

            adminPopupButtons = `
                <div class="popup-btn-group" style="display:flex; flex-direction:column; gap:5px; margin-top:8px;">
                    <div style="display:flex; gap:5px; width:100%;">
                        <button class="popup-btn popup-btn-edit" id="btn-popup-edit-k-${kiosk.id}" onclick="event.stopPropagation(); window.openEditKioskModal('${targetKioskCode}')" style="flex:1;">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            <span>Düzenle</span>
                        </button>
                        ${statusBtnHtml}
                    </div>
                    <div style="display:flex; width:100%;">
                        <button class="popup-btn popup-btn-delete" id="btn-popup-del-k-${kiosk.id}" onclick="event.stopPropagation(); window.confirmDeleteKiosk('${targetKioskCode}')" style="width:100%; display:flex; align-items:center; justify-content:center; gap:4px;">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            <span>Kiosku Sil</span>
                        </button>
                    </div>
                </div>
            `;
        }

        let kioskPopupContent = '';
        if (isKioskDisabled) {
            kioskPopupContent = `
                <div class="popup-card">
                    <div style="margin-bottom:6px;">
                        <span class="status-badge status-urgent" style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:9999px; background:rgba(239, 68, 68, 0.15); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.35);">PASİF KİOSK (DEVRE DIŞI)</span>
                    </div>
                    <div class="popup-title" style="font-size:13.5px; font-weight:700; color:var(--text-head); margin-bottom:2px;">${kiosk.ad}</div>
                    <div class="popup-meta" style="font-size:11px; color:var(--text-sub); margin-bottom:8px;">${kiosk.adres || '-'}</div>
                    <button class="btn btn-xs btn-success" style="width:100%; height:28px; font-size:11px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:5px;" onclick="event.stopPropagation(); window.toggleKioskActiveStatus(${kiosk.db_id || kiosk.id}, true)">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span>Kiosku Yeniden Aktifleştir</span>
                    </button>
                </div>
            `;
        } else {
            kioskPopupContent = `
                <div class="popup-card">
                    <span class="category-badge" style="background-color:#581c87; color:#e9d5ff;">OTOMATİK DOLUM CİHAZI</span>
                    <div class="popup-title" style="margin-top:4px;">${kiosk.ad}</div>
                    <div class="popup-meta">${kiosk.adres || '-'}</div>
                    <button class="popup-btn" id="btn-popup-ksk-${kiosk.id}" onclick="event.stopPropagation(); window.selectKiosk('${targetKioskCode}')">Kiosk Detayı</button>
                    ${adminPopupButtons}
                </div>
            `;
        }

        const kMarker = L.marker([kiosk.enlem, kiosk.boylam], { icon: kioskIcon })
            .bindTooltip(`<b>${kiosk.ad}</b> ${isKioskDisabled ? '<b style="color:#ef4444;">(PASİF KİOSK)</b>' : '(Otomatik Kiosk)'}`, { direction: 'top' })
            .bindPopup(kioskPopupContent);

        kMarker.on('click', () => {
            if (handlers.onSelectKiosk) handlers.onSelectKiosk(targetKioskCode);
        });

        kMarker.on('popupopen', () => {
            const btnDetail = document.getElementById(`btn-popup-ksk-${kiosk.id}`);
            if (btnDetail && handlers.onSelectKiosk) {
                btnDetail.onclick = (e) => {
                    if (e) e.stopPropagation();
                    handlers.onSelectKiosk(targetKioskCode);
                };
            }
            const btnEdit = document.getElementById(`btn-popup-edit-k-${kiosk.id}`);
            if (btnEdit && handlers.onEditKiosk) {
                btnEdit.onclick = (e) => {
                    if (e) e.stopPropagation();
                    handlers.onEditKiosk(targetKioskCode);
                };
            }
            const btnDel = document.getElementById(`btn-popup-del-k-${kiosk.id}`);
            if (btnDel && handlers.onDeleteKiosk) {
                btnDel.onclick = (e) => {
                    if (e) e.stopPropagation();
                    handlers.onDeleteKiosk(targetKioskCode);
                };
            }
        });

        layerGroups.kiosks.addLayer(kMarker);
        markersMap[kiosk.id] = kMarker;
    }

    // 5. Yetkili Dolum Bayileri (374 Bayi - High Performance Canvas CircleMarkers)
    const bayiler = appData.bayiler || [];
    const bayiCanvasRenderer = L.canvas({ padding: 0.5 });
    for (const bayi of bayiler) {
        const bMarker = L.circleMarker([bayi.enlem, bayi.boylam], {
            renderer: bayiCanvasRenderer,
            radius: 6,
            fillColor: '#0e7490',
            color: '#ffffff',
            weight: 1.5,
            opacity: 0.95,
            fillOpacity: 0.9
        })
            .bindTooltip(`<b>${bayi.ad}</b> (Yetkili Bayi)`, { direction: 'top' })
            .bindPopup(`
                <div class="popup-card">
                    <span class="category-badge" style="background-color:#164e63; color:#a5f3fc;">YETKİLİ DOLUM BAYİSİ</span>
                    <div class="popup-title" style="margin-top:4px;">${bayi.ad}</div>
                    <div class="popup-meta">${bayi.adres || '-'}</div>
                    <button class="popup-btn" id="btn-popup-bayi-${bayi.id}" onclick="event.stopPropagation(); window.selectBayi('${bayi.id}')">Bayi Detayı</button>
                </div>
            `);

        bMarker.on('click', () => {
            if (handlers.onSelectBayi) handlers.onSelectBayi(bayi.id);
        });

        bMarker.on('popupopen', () => {
            const btnDetail = document.getElementById(`btn-popup-bayi-${bayi.id}`);
            if (btnDetail && handlers.onSelectBayi) {
                btnDetail.onclick = (e) => {
                    if (e) e.stopPropagation();
                    handlers.onSelectBayi(bayi.id);
                };
            }
        });

        layerGroups.bayiler.addLayer(bMarker);
        markersMap[bayi.id] = bMarker;
    }

    // Aktif role göre katman görünürlüğünü uygula
    applyRoleLayerVisibility(state.activeRoleView);
}

// =========================================================================
// İNTERAKTİF KOORDİNAT SEÇİCİ
// =========================================================================

export function startPickingCoordinates(targetMode) {
    state.coordPickingTarget = targetMode; // 'add' veya 'edit'
    
    const banner = document.getElementById('map-coord-picker-banner');
    if (banner) banner.style.display = 'flex';

    // Açık modalları geçici olarak gizle
    const modalAdd = document.getElementById('modal-add-kiosk');
    const modalEdit = document.getElementById('modal-edit-kiosk');
    if (modalAdd) modalAdd.classList.remove('active');
    if (modalEdit) modalEdit.classList.remove('active');

    showToast('Kiosk konumunu belirlemek için haritada bir noktaya tıklayınız.', 'info');
}

export function cancelPickingCoordinates() {
    state.coordPickingTarget = null;
    const banner = document.getElementById('map-coord-picker-banner');
    if (banner) banner.style.display = 'none';

    if (state.tempPickMarker && mapInstance) {
        mapInstance.removeLayer(state.tempPickMarker);
        state.tempPickMarker = null;
    }
}

export function handleMapCoordPicked(lat, lon) {
    const latFixed = Number(lat).toFixed(6);
    const lonFixed = Number(lon).toFixed(6);

    if (state.coordPickingTarget === 'add') {
        const inputLat = document.getElementById('add-kiosk-lat');
        const inputLon = document.getElementById('add-kiosk-lon');
        if (inputLat) inputLat.value = latFixed;
        if (inputLon) inputLon.value = lonFixed;
        
        const modal = document.getElementById('modal-add-kiosk');
        if (modal) modal.classList.add('active');
    } else if (state.coordPickingTarget === 'edit') {
        const inputLat = document.getElementById('edit-kiosk-lat');
        const inputLon = document.getElementById('edit-kiosk-lon');
        if (inputLat) inputLat.value = latFixed;
        if (inputLon) inputLon.value = lonFixed;

        const modal = document.getElementById('modal-edit-kiosk');
        if (modal) modal.classList.add('active');
    }

    cancelPickingCoordinates();
    showToast(`Koordinat seçildi: ${latFixed}, ${lonFixed}`, 'success');
}
