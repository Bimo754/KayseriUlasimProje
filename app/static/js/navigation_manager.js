/**
 * Kayseri Ulaşım - Akıllı Rota ve Sürüş Navigasyon Yöneticisi (NavigationManager)
 * - Saha Görev Kartı (Mission HUD) & Admin Kompakt Navigasyon HUD
 * - Sıradaki Müdahale Listesi ve Araç Takibi
 * - Tek Tıkla Onarım & İlerleme
 */

import { state, layerGroups, markersMap } from './state.js';
import { ApiService } from './api.js';
import { getMap } from './map_manager.js';
import { showToast } from './ui_utils.js';
import { renderFaultLayers } from './faults_manager.js';
import { selectStation, selectBayi } from './inventory/station_manager.js';
import { selectKiosk } from './inventory/kiosk_manager.js';

let currentFaultResolvedCallback = null;

export function setFaultResolvedCallback(cb) {
    currentFaultResolvedCallback = cb;
}

export async function toggleAdminNavigationHUD() {
    const banner = document.getElementById('admin-nav-hud-panel');
    const navBtn = document.getElementById('admin-btn-toggle-nav-mode');
    const navLabel = document.getElementById('admin-btn-nav-label');
    const map = getMap();

    if (!banner) return;

    if (banner.style.display === 'none' || banner.style.display === '') {
        await loadAndRenderNavigation();
        banner.style.display = 'flex';
        if (navBtn) navBtn.classList.add('active');
        if (navLabel) navLabel.innerText = 'Rotayı Gizle';

        if (state.activeNavigationRoute && state.activeNavigationRoute.arac_konumu && map) {
            const v = state.activeNavigationRoute.arac_konumu;
            map.flyTo([v.enlem, v.boylam], 16, { duration: 0.9 });
        }
    } else {
        banner.style.display = 'none';
        if (layerGroups.route) layerGroups.route.clearLayers();
        if (navBtn) navBtn.classList.remove('active');
        if (navLabel) navLabel.innerText = 'Akıllı Rota';
    }
}

export function toggleAdminStepsDropdown() {
    const drop = document.getElementById('admin-banner-steps-dropdown');
    if (!drop) return;
    drop.style.display = (drop.style.display === 'none' || drop.style.display === '') ? 'block' : 'none';
}

export async function toggleDispatchModeAction() {
    const currentMode = state.activeDispatchMode || 'DUAL_SPLIT';
    const newMode = currentMode === 'DUAL_SPLIT' ? 'SINGLE_VEHICLE' : 'DUAL_SPLIT';
    state.activeDispatchMode = newMode;

    try {
        const res = await ApiService.setDispatchMode(newMode);
        if (res.basarili) {
            showToast(res.mesaj, 'success');
            await loadAndRenderNavigation();
        } else {
            showToast(res.mesaj || 'Mod değiştirilemedi', 'error');
        }
    } catch (_e) {
        showToast('Mod değiştirilemedi', 'error');
    }
}

export function openSahaVehicleSelectModal() {
    if (typeof window.openModal === 'function') {
        window.openModal('modal-saha-vehicle-select');
    } else {
        const el = document.getElementById('modal-saha-vehicle-select');
        if (el) el.classList.add('active');
    }
}

export async function setSahaVehicleAction(imei) {
    if (!imei) return;
    state.sahaActiveVehicleImei = imei;
    try { sessionStorage.setItem('sahaVehicleImei', imei); } catch (_e) {}

    const is089 = imei === '861000000000002';
    const plateText = is089 ? '38 BKM 002' : '38 BKM 001';
    const plateColor = is089 ? '#f59e0b' : '#10b981';

    const plateTextEl = document.getElementById('saha-vehicle-plate-text');
    if (plateTextEl) {
        plateTextEl.innerText = plateText;
    }

    const badgeBtn = document.getElementById('saha-header-vehicle-badge');
    if (badgeBtn) {
        badgeBtn.style.borderColor = plateColor;
        badgeBtn.style.color = plateColor;
    }

    if (typeof window.closeModal === 'function') {
        window.closeModal('modal-saha-vehicle-select');
    }

    if (state.activeRoleView === 'saha') {
        state.activeVehicleImei = imei;
    }

    await loadAndRenderNavigation(imei);
    await focusOnVehicle(imei);
}

export async function selectMissionVehicle(imei) {
    if (!imei) return;
    state.adminActiveVehicleImei = imei;
    if (state.activeRoleView === 'admin') {
        state.activeVehicleImei = imei;
    }
    await loadAndRenderNavigation(imei);
    await focusOnVehicle(imei);
}

export async function loadAndRenderNavigation(targetImei = null) {
    try {
        const isSahaMode = state.activeRoleView === 'saha';

        if (isSahaMode) {
            if (!state.sahaActiveVehicleImei) {
                const savedSahaImei = sessionStorage.getItem('sahaVehicleImei');
                if (savedSahaImei) {
                    state.sahaActiveVehicleImei = savedSahaImei;
                } else if (!targetImei) {
                    openSahaVehicleSelectModal();
                }
            }
        }

        const effectiveImei = targetImei || (isSahaMode ? state.sahaActiveVehicleImei : state.adminActiveVehicleImei) || '861000000000001';
        state.activeVehicleImei = effectiveImei;

        const data = await ApiService.getNavigationRoute(effectiveImei, state.activeDispatchMode);

        if (isSahaMode && data.cift_arac_ozeti && data.cift_arac_ozeti[effectiveImei]) {
            const vehSummary = data.cift_arac_ozeti[effectiveImei];
            if (vehSummary.duraklar && vehSummary.duraklar.length > 0) {
                data.duraklar = vehSummary.duraklar;
                data.toplam_durak = vehSummary.toplam_durak;
                data.toplam_mesafe_km = vehSummary.toplam_mesafe_km;
                data.toplam_sure_dk = vehSummary.toplam_sure_dk;
            }
        }

        state.activeNavigationRoute = data;

        const plateTextEl = document.getElementById('saha-vehicle-plate-text');
        const badgeBtn = document.getElementById('saha-header-vehicle-badge');
        const is089Eff = effectiveImei === '861000000000002';
        const activePlate = is089Eff ? '38 BKM 002' : '38 BKM 001';
        const activeColor = is089Eff ? '#f59e0b' : '#10b981';

        if (plateTextEl) {
            plateTextEl.innerText = activePlate;
        }
        if (badgeBtn) {
            badgeBtn.style.borderColor = activeColor;
            badgeBtn.style.color = activeColor;
        }

        if (data.dagitim_modu) {
            state.activeDispatchMode = data.dagitim_modu;
            const modeTitleEl = document.getElementById('txt-dispatch-mode-title');
            const modeSubEl = document.getElementById('txt-dispatch-mode-sub');
            if (modeTitleEl) {
                modeTitleEl.innerText = data.dagitim_modu === 'SINGLE_VEHICLE' ? 'Mod: Tek Araç Odaklı' : 'Mod: Çift Araç Paylaşımı';
            }
            if (modeSubEl) {
                modeSubEl.innerText = data.dagitim_modu === 'SINGLE_VEHICLE' ? 'Tıkla: Çift Araç Paylaşımına Geç' : 'Tıkla: Tek Araç Yüküne Geç';
            }
        }

        // Update admin-route-info-box dual vehicle cards
        if (data.cift_arac_ozeti) {
            const sum093 = data.cift_arac_ozeti['861000000000001'];
            const sum089 = data.cift_arac_ozeti['861000000000002'];
            const btn093 = document.getElementById('btn-route-select-093');
            const btn089 = document.getElementById('btn-route-select-089');
            const dot093 = document.getElementById('dot-route-active-093');
            const dot089 = document.getElementById('dot-route-active-089');
            const stats093 = document.getElementById('route-stats-093');
            const stats089 = document.getElementById('route-stats-089');
            const stops093 = document.getElementById('route-stops-093');
            const stops089 = document.getElementById('route-stops-089');

            if (sum093) {
                if (stats093) stats093.innerText = `${sum093.toplam_mesafe_km} km • ~${sum093.toplam_sure_dk} dk`;
                if (stops093) stops093.innerText = `${sum093.toplam_durak} Görev Durağı`;
            }
            if (sum089) {
                if (stats089) stats089.innerText = `${sum089.toplam_mesafe_km} km • ~${sum089.toplam_sure_dk} dk`;
                if (stops089) stops089.innerText = `${sum089.toplam_durak} Görev Durağı`;
            }

            const activeImei = data.secili_imei || state.activeVehicleImei || '861000000000001';
            const is093Active = activeImei === '861000000000001';

            // HUD Focus Button background & label update
            const focusBtn = document.getElementById('btn-admin-vehicle-focus');
            const focusBtnText = document.getElementById('txt-admin-vehicle-focus');
            const focusBtnDot = document.getElementById('dot-admin-vehicle-focus');
            const sub093 = document.getElementById('txt-focus-sub-093');
            const sub089 = document.getElementById('txt-focus-sub-089');

            if (focusBtnText) focusBtnText.innerText = is093Active ? '38 BKM 001' : '38 BKM 002';
            if (focusBtnDot) focusBtnDot.style.background = '#ffffff';
            if (sub093) sub093.innerText = is093Active ? '1. Saha Hizmet Aracı (Odaklı)' : '1. Saha Hizmet Aracı';
            if (sub089) sub089.innerText = !is093Active ? '2. Saha Hizmet Aracı (Odaklı)' : '2. Saha Hizmet Aracı';

            if (focusBtn) {
                if (is093Active) {
                    focusBtn.style.backgroundColor = '#10b981';
                    focusBtn.style.borderColor = '#059669';
                    focusBtn.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.4)';
                    focusBtn.style.color = '#ffffff';
                } else {
                    focusBtn.style.backgroundColor = '#d97706';
                    focusBtn.style.borderColor = '#b45309';
                    focusBtn.style.boxShadow = '0 2px 8px rgba(217, 119, 6, 0.4)';
                    focusBtn.style.color = '#ffffff';
                }
            }

            if (btn093 && btn089) {
                if (is093Active) {
                    btn093.className = 'btn-vehicle-route-select active';
                    btn089.className = 'btn-vehicle-route-select';
                    if (dot093) dot093.style.background = '#10b981';
                    if (dot089) dot089.style.background = 'transparent';
                } else {
                    btn093.className = 'btn-vehicle-route-select';
                    btn089.className = 'btn-vehicle-route-select active-amber';
                    if (dot093) dot093.style.background = 'transparent';
                    if (dot089) dot089.style.background = '#f59e0b';
                }
            }

            const summaryEl = document.getElementById('admin-route-view-summary');
            if (summaryEl) {
                const activePlaka = is093Active ? '38 BKM 001' : '38 BKM 002';
                const modeLabel = data.dagitim_modu === 'SINGLE_VEHICLE' ? 'Tek Araç Yükü' : 'Çift Araç Paylaşımı';
                summaryEl.innerText = `Aktif Araç: ${activePlaka} • ${data.toplam_durak || 0} Durak (${data.toplam_mesafe_km || 0} km) • [${modeLabel}]`;
            }
        }

        if (typeof window.renderAdminRouteFaultsList === 'function') {
            window.renderAdminRouteFaultsList();
        }

        if (state.activeItemId && state.activeItemType) {
            if (state.activeItemType === 'ISTASYON') selectStation(state.activeItemId, false);
            else if (state.activeItemType === 'KIOSK') selectKiosk(state.activeItemId, false);
            else if (state.activeItemType === 'BAYI') selectBayi(state.activeItemId, false);
        }

        // Element Referansları (Saha ve Admin HUD)
        const targetNames = [document.getElementById('saha-hud-target-name'), document.getElementById('admin-hud-target-name')];
        const targetFaults = [document.getElementById('saha-hud-target-fault'), document.getElementById('admin-hud-target-fault')];
        const targetEtas = [document.getElementById('saha-hud-target-eta'), document.getElementById('admin-hud-target-eta')];
        const targetDists = [document.getElementById('saha-hud-target-dist'), document.getElementById('admin-hud-target-dist')];
        const resolveBtns = [document.getElementById('saha-btn-resolve-fault'), document.getElementById('admin-btn-resolve-fault')];
        const hudSummaries = [document.getElementById('saha-hud-total-summary'), document.getElementById('admin-hud-total-summary')];
        const stepsPreviews = [document.getElementById('saha-hud-stops-preview'), document.getElementById('admin-hud-stops-preview')];
        const legsListContainer = document.getElementById('mission-legs-list');
        const vehicleNameEl = document.getElementById('saha-sidebar-vehicle-name');
        const queueCountEl = document.getElementById('saha-sidebar-queue-count');

        const hudStepPills = [document.getElementById('saha-hud-step-pill'), document.getElementById('admin-hud-step-pill')];
        const hudSeqBadges = document.querySelectorAll('.hud-seq-badge');

        if (vehicleNameEl && data.arac_konumu) {
            vehicleNameEl.innerText = data.arac_konumu.ad || 'Merkez Garaj / Sahada';
        }

        if (!data.basarili || !data.duraklar || data.duraklar.length === 0) {
            hudSummaries.forEach(el => { if (el) el.innerText = 'Arıza Yok'; });
            targetNames.forEach(el => { if (el) el.innerText = 'Tüm Arızalar Çözüldü'; });
            targetFaults.forEach(el => { if (el) el.innerText = 'Şu anda sahada bekleyen aktif arıza bulunmamaktadır.'; });
            targetEtas.forEach(el => { if (el) el.innerText = '0 dk'; });
            targetDists.forEach(el => { if (el) el.innerText = '0 km'; });
            hudStepPills.forEach(el => { if (el) el.innerText = '✓'; });
            hudSeqBadges.forEach(el => { if (el) el.classList.add('resolved'); });
            resolveBtns.forEach(el => { if (el) el.style.display = 'none'; });
            stepsPreviews.forEach(el => { if (el) el.innerHTML = ''; });
            if (queueCountEl) queueCountEl.innerText = '0 İstasyon';
            
            if (legsListContainer) {
                legsListContainer.innerHTML = `
                    <div class="empty-state">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                        <div class="empty-title">Tüm Arızalar Giderildi</div>
                        <div class="empty-desc">Tüm ekip tebrikler! Bekleyen aktif arıza kaydı bulunmuyor.</div>
                    </div>
                `;
            }

            if (layerGroups.route) layerGroups.route.clearLayers();
            try {
                const vehicleRes = await ApiService.getVehiclePosition();
                if (vehicleRes && vehicleRes.tum_araclar) {
                    renderVehicleMarker(vehicleRes.tum_araclar);
                } else if (data.arac_konumu) {
                    renderVehicleMarker(data.arac_konumu);
                }
            } catch (_e) {
                renderVehicleMarker(data.arac_konumu);
            }
            return;
        }

        hudSeqBadges.forEach(el => { if (el) el.classList.remove('resolved'); });
        resolveBtns.forEach(el => { if (el) el.style.display = 'inline-flex'; });
        const totalStops = data.toplam_durak;
        if (queueCountEl) queueCountEl.innerText = `${totalStops} Nokta Bekliyor`;

        const summaryText = `${totalStops} Durak`;
        hudSummaries.forEach(el => { if (el) el.innerText = summaryText; });

        // 1. Hedef Durak
        const firstStop = data.duraklar[0];
        state.currentTargetStop = firstStop;

        const firstSeqNo = firstStop.sira_no || 1;
        const seqText = totalStops > 0 ? `${firstSeqNo}/${totalStops}` : `${firstSeqNo}`;
        hudStepPills.forEach(el => { if (el) el.innerText = seqText; });
        targetNames.forEach(el => { if (el) el.innerText = firstStop.lokasyon_adi; });
        targetFaults.forEach(el => { if (el) el.innerText = firstStop.ariza_metni; });
        targetEtas.forEach(el => { if (el) el.innerText = `~${firstStop.bacak_sure_dk} dk`; });
        targetDists.forEach(el => { if (el) el.innerText = `${firstStop.bacak_mesafe_km} km`; });

        // Sol Paneldeki Görev Adımları Listesi & Dropdown
        let legsHtml = '';
        let dropdownHtml = '';
        const legs = data.bacaklar || [];

        for (let i = 0; i < data.duraklar.length; i++) {
            const st = data.duraklar[i];
            const leg = legs[i] || {};
            const isCurrent = i === 0;
            const isNext = i === 1;

            let tagLabel = `${st.sira_no}. Durak (Sırada)`;
            let cardClass = 'queued-target';
            if (isCurrent) {
                tagLabel = '1. HEDEF (Aktif)';
                cardClass = 'active-target';
            } else if (isNext) {
                tagLabel = '2. SIRADAKİ';
            }

            legsHtml += `
                <div class="mission-leg-card ${cardClass}" onclick="window.focusOnLeg(${i})">
                    <div class="leg-index-badge">${st.sira_no}</div>
                    <div class="leg-info-block">
                        <div class="leg-name">${st.lokasyon_adi}</div>
                        <div class="leg-fault">${st.ariza_metni}</div>
                        <div class="leg-meta">
                            <span class="status-badge ${st.oncelik_puani >= 100 ? 'badge-urgent' : 'badge-high'}">${st.oncelik_seviyesi || 'Öncelikli'}</span>
                            <span>• Mesafe: ${leg.mesafe_km || st.bacak_mesafe_km} km (~${leg.sure_dk || st.bacak_sure_dk} dk)</span>
                        </div>
                    </div>
                </div>
            `;

            dropdownHtml += `
                <div class="hud-stop-row ${isCurrent ? 'active-stop-row' : ''}" onclick="window.focusOnLeg(${i})">
                    <div class="hud-stop-index">${st.sira_no}</div>
                    <div class="hud-stop-content">
                        <div class="hud-stop-name-row">
                            <span class="hud-stop-name">${st.lokasyon_adi}</span>
                            ${isCurrent ? '<span class="hud-active-tag">HEDEF</span>' : ''}
                        </div>
                        <div class="hud-stop-fault">${st.ariza_metni}</div>
                    </div>
                    <div class="hud-stop-meta">
                        <div class="hud-stop-dist">${leg.mesafe_km || st.bacak_mesafe_km} km</div>
                        <div class="hud-stop-time">~${leg.sure_dk || st.bacak_sure_dk} dk</div>
                    </div>
                </div>
            `;
        }

        if (legsListContainer) legsListContainer.innerHTML = legsHtml;
        stepsPreviews.forEach(el => { if (el) el.innerHTML = dropdownHtml; });

        renderDrivingRoute(data);
    } catch (err) {
        console.error('Navigasyon yükleme hatası:', err);
    }
}

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function offsetCoordinates(coords, offsetMeters = 0) {
    if (!offsetMeters || !coords || coords.length < 2) return coords;

    const latFactor = 0.000009;
    const lonFactor = 0.000009 / Math.cos((coords[0][0] || 38.7) * Math.PI / 180);

    return coords.map((pt, idx) => {
        let dx = 0, dy = 0;
        if (idx < coords.length - 1) {
            const next = coords[idx + 1];
            dx += (next[1] - pt[1]) * lonFactor;
            dy += (next[0] - pt[0]) * latFactor;
        }
        if (idx > 0) {
            const prev = coords[idx - 1];
            dx += (pt[1] - prev[1]) * lonFactor;
            dy += (pt[0] - prev[0]) * latFactor;
        }
        const len = Math.hypot(dx, dy) || 1;
        const px = (-dy / len) * offsetMeters * lonFactor;
        const py = (dx / len) * offsetMeters * latFactor;

        return [
            parseFloat((pt[0] + py).toFixed(6)),
            parseFloat((pt[1] + px).toFixed(6))
        ];
    });
}

function renderRouteDirectionArrows(geom, color = '#38bdf8', stepMeters = 350, isCurrent = true) {
    if (!geom || geom.length < 2) return;

    let distanceSinceLastArrow = stepMeters * 0.5;
    let arrowCount = 0;
    const MAX_ARROWS = 15;

    for (let i = 0; i < geom.length - 1; i++) {
        if (arrowCount >= MAX_ARROWS) break;
        const p1 = geom[i];
        const p2 = geom[i + 1];
        const segDist = calculateDistanceMeters(p1[0], p1[1], p2[0], p2[1]);
        if (segDist < 5) continue;
        const bearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);

        let traveledOnSeg = 0;
        while (traveledOnSeg + (stepMeters - distanceSinceLastArrow) <= segDist) {
            if (arrowCount >= MAX_ARROWS) break;
            const nextArrowDist = stepMeters - distanceSinceLastArrow;
            traveledOnSeg += nextArrowDist;
            const ratio = traveledOnSeg / segDist;

            const arrowLat = p1[0] + (p2[0] - p1[0]) * ratio;
            const arrowLon = p1[1] + (p2[1] - p1[1]) * ratio;

            const arrowIcon = L.divIcon({
                className: 'route-arrow-icon-wrap',
                html: `
                    <div class="route-arrow-marker ${isCurrent ? '' : 'vague'}" style="transform: rotate(${Math.round(bearing)}deg);">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2.5L20.5 20L12 16L3.5 20L12 2.5Z" fill="${isCurrent ? '#ffffff' : '#cbd5e1'}" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>
                        </svg>
                    </div>
                `,
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            });

            const arrowMarker = L.marker([arrowLat, arrowLon], {
                icon: arrowIcon,
                interactive: false,
                zIndexOffset: isCurrent ? 50 : 20
            });

            layerGroups.route.addLayer(arrowMarker);
            arrowCount++;
            distanceSinceLastArrow = 0;
        }

        distanceSinceLastArrow += (segDist - traveledOnSeg);
    }
}

async function fetchClientOsrmRoute(lat1, lon1, lat2, lon2) {
    try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
        let response = await fetch(osrmUrl).catch(() => null);
        if (!response || !response.ok) {
            const fallbackUrl = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
            response = await fetch(fallbackUrl).catch(() => null);
        }
        if (response && response.ok) {
            const data = await response.json();
            if (data.routes && data.routes.length > 0 && data.routes[0].geometry) {
                return data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
            }
        }
    } catch (_e) {}
    return null;
}

function renderLegList(legs, defaultColor = '#38bdf8', isFocusedVehicle = true) {
    if (!legs || legs.length === 0) return;

    legs.forEach((leg, idx) => {
        const rawGeom = leg.geometri || [];
        if (rawGeom.length < 2) return;

        const isCurrentLeg = isFocusedVehicle && idx === 0;
        const offsetMeters = isCurrentLeg ? 0 : ((idx % 2 === 1 ? 1 : -1) * Math.min((idx + 1) * 3.5, 9));
        const geom = offsetCoordinates(rawGeom, offsetMeters);
        const legColor = isFocusedVehicle ? (isCurrentLeg ? defaultColor : leg.renk || defaultColor) : defaultColor;

        // 1. Dark Casing Polyline
        const casingLine = L.polyline(geom, {
            color: '#0f172a',
            weight: isFocusedVehicle ? (isCurrentLeg ? 8.5 : 6.0) : 5.0,
            opacity: isFocusedVehicle ? (isCurrentLeg ? 0.75 : 0.6) : 0.45,
            lineJoin: 'round',
            lineCap: 'round'
        });
        layerGroups.route.addLayer(casingLine);

        // 2. Active Leg Glow Pulse Aura
        let glowLine = null;
        if (isCurrentLeg) {
            glowLine = L.polyline(geom, {
                color: legColor,
                weight: 14,
                opacity: 0.35,
                lineJoin: 'round',
                className: 'route-polyline-glow'
            });
            layerGroups.route.addLayer(glowLine);
        }

        // 3. Main Colored Polyline
        const legPolyline = L.polyline(geom, {
            color: legColor,
            weight: isFocusedVehicle ? (isCurrentLeg ? 5.5 : 4.0) : 3.5,
            opacity: isFocusedVehicle ? (isCurrentLeg ? 1.0 : 0.75) : 0.6,
            dashArray: isFocusedVehicle ? (isCurrentLeg ? null : '8, 8') : '6, 6',
            lineJoin: 'round',
            lineCap: 'round',
            className: isCurrentLeg ? 'route-polyline-primary' : 'route-polyline-secondary'
        }).bindTooltip(`
            <b>${leg.bacak_no || idx + 1}. Bacak (${isFocusedVehicle ? 'Odaklı Araç' : 'İkincil Araç'}):</b> ${leg.baslangic_ad || leg.baslangic_adi || 'Başlangıç'} → ${leg.hedef_ad || leg.hedef_adi || 'Hedef'}<br>
            <strong>Mesafe:</strong> ${leg.mesafe_km} km | <strong>Süre:</strong> ~${leg.sure_dk} dk
        `, { sticky: true });

        layerGroups.route.addLayer(legPolyline);

        // 4. Direction arrows
        renderRouteDirectionArrows(geom, legColor, isCurrentLeg ? 280 : 450, isCurrentLeg);

        // Client-side dynamic upgrade if backend returned straight line
        if (rawGeom.length <= 2) {
            const p1 = rawGeom[0];
            const p2 = rawGeom[1];
            fetchClientOsrmRoute(p1[0], p1[1], p2[0], p2[1]).then(roadCoords => {
                if (roadCoords && roadCoords.length > 2) {
                    leg.geometri = roadCoords;
                    const upgradedGeom = offsetCoordinates(roadCoords, offsetMeters);
                    casingLine.setLatLngs(upgradedGeom);
                    if (glowLine) glowLine.setLatLngs(upgradedGeom);
                    legPolyline.setLatLngs(upgradedGeom);
                    renderRouteDirectionArrows(upgradedGeom, legColor, isCurrentLeg ? 280 : 450, isCurrentLeg);
                }
            });
        }
    });
}

export function renderDrivingRoute(routeData) {
    if (!layerGroups.route) return;
    layerGroups.route.clearLayers();

    const activeRole = state.activeRoleView || 'saha';
    const roleState = (state.roleLayerStates && state.roleLayerStates[activeRole]) ? state.roleLayerStates[activeRole] : { route: true };
    const isRouteEnabled = roleState.route !== false;

    const map = getMap();
    if (!isRouteEnabled) {
        if (map && map.hasLayer(layerGroups.route)) {
            map.removeLayer(layerGroups.route);
        }
        renderFaultLayers();
        return;
    }

    if (map && !map.hasLayer(layerGroups.route)) {
        map.addLayer(layerGroups.route);
    }

    try {
        ApiService.getVehiclePosition().then(vRes => {
            if (vRes && vRes.tum_araclar) {
                renderVehicleMarker(vRes.tum_araclar);
            } else if (routeData.arac_konumu) {
                renderVehicleMarker(routeData.arac_konumu);
            }
        }).catch(() => {
            renderVehicleMarker(routeData.arac_konumu);
        });
    } catch (_e) {
        renderVehicleMarker(routeData.arac_konumu);
    }

    const dualSummary = routeData.cift_arac_ozeti;
    const activeImei = routeData.secili_imei || state.activeVehicleImei || '861000000000001';

    if (dualSummary && routeData.dagitim_modu !== 'SINGLE_VEHICLE') {
        const sum093 = dualSummary['861000000000001'];
        const sum089 = dualSummary['861000000000002'];
        const isSaha = activeRole === 'saha';

        if (isSaha) {
            const sahaImei = state.sahaActiveVehicleImei || activeImei;
            if (sahaImei === '861000000000002' && sum089 && sum089.bacaklar) {
                renderLegList(sum089.bacaklar, '#f59e0b', true);
            } else if (sum093 && sum093.bacaklar) {
                renderLegList(sum093.bacaklar, '#10b981', true);
            }
        } else {
            const is093Active = activeImei === '861000000000001';
            if (is093Active) {
                if (sum089 && sum089.bacaklar) renderLegList(sum089.bacaklar, '#f59e0b', false);
                if (sum093 && sum093.bacaklar) renderLegList(sum093.bacaklar, '#10b981', true);
            } else {
                if (sum093 && sum093.bacaklar) renderLegList(sum093.bacaklar, '#10b981', false);
                if (sum089 && sum089.bacaklar) renderLegList(sum089.bacaklar, '#f59e0b', true);
            }
        }
    } else {
        const legs = routeData.bacaklar || [];
        const is089Active = activeImei === '861000000000002';
        renderLegList(legs, is089Active ? '#f59e0b' : '#10b981', true);
    }

    // Arıza pinlerini layerGroups.faults katmanına render et
    renderFaultLayers();
}

let vehicleMarkersMap = new Map();

function formatTurkicDateTime(dateInput) {
    if (!dateInput) return 'Sinyal Bekleniyor';
    let dateObj;
    if (typeof dateInput === 'string' && dateInput.includes('/Date(')) {
        const ms = parseInt(dateInput.replace(/\/Date\((\d+)\)\//, '$1'), 10);
        dateObj = new Date(ms);
    } else if (typeof dateInput === 'number') {
        dateObj = new Date(dateInput);
    } else {
        dateObj = new Date(dateInput);
    }
    if (isNaN(dateObj.getTime())) return String(dateInput);

    return dateObj.toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

export function renderVehicleMarker(vehiclesInput) {
    if (!vehiclesInput || !layerGroups.vehicle) return;

    const map = getMap();
    if (map && !map.hasLayer(layerGroups.vehicle)) {
        map.addLayer(layerGroups.vehicle);
    }

    const vehiclesList = Array.isArray(vehiclesInput) ? vehiclesInput : [vehiclesInput];

    vehiclesList.forEach(vehiclePos => {
        if (!vehiclePos || (!vehiclePos.imei && !vehiclePos.enlem)) return;

        const imei = vehiclePos.imei || '861000000000001';
        const plate = vehiclePos.plaka || (imei === '861000000000002' ? '38 BKM 002' : '38 BKM 001');
        const speed = vehiclePos.hiz != null ? Math.round(vehiclePos.hiz) : 0;
        const serverTimeFormatted = formatTurkicDateTime(vehiclePos.sunucu_zaman || vehiclePos.son_guncelleme);
        const lat = vehiclePos.enlem;
        const lon = vehiclePos.boylam;
        const isPrimary = imei === '861000000000001';
        const color = isPrimary ? '#10b981' : '#f59e0b';

        const popupHtml = `
            <div class="popup-card vehicle-telemetry-popup">
                <div class="popup-header">
                    <span class="category-badge" style="background-color: ${color}; color: #ffffff; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.3px;">SAHA BAKIM ARACI</span>
                    <strong style="color: var(--text-pure, #f8fafc); font-size: 14px; font-family: var(--font-heading); font-weight: 800;">${plate}</strong>
                </div>

                <div class="popup-speed-row">
                    <span style="color: var(--text-dim, #94a3b8); font-size: 11px; font-weight: 600;">Anlık Hız</span>
                    <strong style="color: #10b981; font-size: 14px; font-weight: 800;">${speed} km/s</strong>
                </div>

                <div class="popup-time-row">
                    <span style="font-weight: 600; color: var(--text-head, #cbd5e1);">Son GPS Sinyali:</span>
                    <span style="color: #38bdf8; font-weight: 700; font-size: 11.5px;">${serverTimeFormatted}</span>
                </div>
            </div>
        `;

        let marker = vehicleMarkersMap.get(imei);
        if (marker && layerGroups.vehicle.hasLayer(marker)) {
            marker.setLatLng([lat, lon]);
            marker.setPopupContent(popupHtml);
        } else {
            const carIcon = L.divIcon({
                className: 'custom-pin-wrap',
                html: `
                    <div class="custom-pin pin-vehicle" style="width:38px; height:38px; background-color:${color}; border:2px solid #ffffff; box-shadow: 0 0 15px ${color}cc;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2.5"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                    </div>
                `,
                iconSize: [38, 38],
                iconAnchor: [19, 19],
                popupAnchor: [0, -19]
            });

            marker = L.marker([lat, lon], { icon: carIcon, zIndexOffset: 1000 }).bindPopup(popupHtml);
            vehicleMarkersMap.set(imei, marker);
            layerGroups.vehicle.addLayer(marker);
        }
    });
}

export async function focusOnVehicle(targetImei = null, zoom = 16) {
    const map = getMap();
    if (!map) return;

    if (typeof targetImei === 'number' && targetImei > 20) {
        zoom = targetImei;
        targetImei = null;
    }

    if (targetImei) {
        try {
            const res = await ApiService.getVehiclePosition(targetImei);
            let targetPos = null;
            if (res && res.arac_konumu && res.arac_konumu.imei === targetImei) {
                targetPos = res.arac_konumu;
            } else if (res && res.tum_araclar) {
                targetPos = res.tum_araclar.find(v => v.imei === targetImei);
            }
            if (!targetPos && res && res.arac_konumu) {
                targetPos = res.arac_konumu;
            }

            if (targetPos && targetPos.enlem && targetPos.boylam) {
                map.flyTo([targetPos.enlem, targetPos.boylam], zoom, { duration: 0.9 });
                const marker = vehicleMarkersMap.get(targetImei);
                if (marker) marker.openPopup();
                return;
            }
        } catch (_e) {}
    }

    const v = state.activeNavigationRoute?.arac_konumu || state.appData?.ana_us;
    if (v && v.enlem && v.boylam) {
        map.flyTo([v.enlem, v.boylam], zoom, { duration: 0.9 });
    }
}

export async function focusOnAllVehicles() {
    const map = getMap();
    if (!map) return;
    try {
        const res = await ApiService.getVehiclePosition();
        if (res && res.tum_araclar && res.tum_araclar.length > 0) {
            const validCoords = res.tum_araclar.filter(v => v.enlem && v.boylam).map(v => [v.enlem, v.boylam]);
            if (validCoords.length > 0) {
                const bounds = L.latLngBounds(validCoords);
                map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16 });
                return;
            }
        }
    } catch (_e) {}

    focusOnVehicle();
}

export function toggleVehicleFocusDropdown(show) {
    const drop = document.getElementById('admin-vehicle-focus-dropdown');
    if (!drop) return;
    if (show === undefined) {
        drop.style.display = drop.style.display === 'none' ? 'block' : 'none';
    } else {
        drop.style.display = show ? 'block' : 'none';
    }
}

export function focusOnLeg(legIndex) {
    const map = getMap();
    if (!state.activeNavigationRoute || !state.activeNavigationRoute.duraklar || !map) return;
    const target = state.activeNavigationRoute.duraklar[legIndex];
    if (target) {
        state.currentTargetStop = target;
        const totalStops = state.activeNavigationRoute.toplam_durak || state.activeNavigationRoute.duraklar.length;
        const targetNames = [document.getElementById('saha-hud-target-name'), document.getElementById('admin-hud-target-name')];
        const targetFaults = [document.getElementById('saha-hud-target-fault'), document.getElementById('admin-hud-target-fault')];
        const targetEtas = [document.getElementById('saha-hud-target-eta'), document.getElementById('admin-hud-target-eta')];
        const targetDists = [document.getElementById('saha-hud-target-dist'), document.getElementById('admin-hud-target-dist')];
        const hudStepPills = [document.getElementById('saha-hud-step-pill'), document.getElementById('admin-hud-step-pill')];

        const seqNo = target.sira_no || (legIndex + 1);
        const seqText = totalStops > 0 ? `${seqNo}/${totalStops}` : `${seqNo}`;

        hudStepPills.forEach(el => { if (el) el.innerText = seqText; });
        targetNames.forEach(el => { if (el) el.innerText = target.lokasyon_adi || 'Bilinmeyen Konum'; });
        targetFaults.forEach(el => { if (el) el.innerText = target.ariza_metni || 'Arıza detayı yok'; });
        if (target.bacak_sure_dk != null) targetEtas.forEach(el => { if (el) el.innerText = `~${target.bacak_sure_dk} dk`; });
        if (target.bacak_mesafe_km != null) targetDists.forEach(el => { if (el) el.innerText = `${target.bacak_mesafe_km} km`; });

        map.flyTo([target.enlem, target.boylam], 16, { duration: 0.8 });
        const dropSaha = document.getElementById('saha-banner-steps-dropdown');
        const dropAdmin = document.getElementById('admin-banner-steps-dropdown');
        if (dropSaha) dropSaha.style.display = 'none';
        if (dropAdmin) dropAdmin.style.display = 'none';
    }
}

export async function resolveCurrentTargetFault() {
    if (!state.currentTargetStop) {
        showToast('Aktif hedef arıza bulunamadı.', 'info');
        return;
    }

    const fault = state.currentTargetStop;
    try {
        const res = await ApiService.updateFaultStatus(fault.id, 'COZULDU');

        if (res.basarili) {
            showToast(`${fault.lokasyon_adi} arızası başarıyla onarıldı!`, 'success');
            if (currentFaultResolvedCallback) {
                await currentFaultResolvedCallback();
            }
        } else {
            showToast(res.mesaj, 'error');
        }
    } catch (err) {
        showToast('Arıza durumu güncellenirken hata oluştu.', 'error');
    }
}

export function toggleStepsDropdown() {
    const drop = document.getElementById('saha-banner-steps-dropdown');
    if (!drop) return;
    drop.style.display = (drop.style.display === 'none' || drop.style.display === '') ? 'block' : 'none';
}
