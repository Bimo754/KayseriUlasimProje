/**
 * Kayseri Ulaşım - Rol Bazlı Saha & Yönetim Rota Portalı (Master App Controller)
 */

import { state } from './state.js';
import { ApiService } from './api.js';
import { initMap, getMap, renderMapLayers, applyRoleLayerVisibility, startPickingCoordinates, cancelPickingCoordinates } from './map_manager.js';
import { showToast, initThemeUI, toggleTheme, openModal, closeModal } from './ui_utils.js';
import { renderList, selectStation, selectKiosk, selectBayi, toggleAdminSidebar, openKioskManagerModal, openAddKioskModal, handleAddKioskSubmit, openEditKioskModal, handleEditKioskSubmit, confirmDeleteKiosk, openSwapKioskModal, handleSwapKioskSubmit, openAddDeviceModal, handleAddDeviceSubmit, openEditDeviceModal, handleEditDeviceSubmit, confirmDeleteDevice, openRelocateDeviceModal, handleRelocateDeviceSubmit, setInventoryChangedListener } from './inventory_manager.js';
import { fetchFaultsData, renderFaultsDrawerList, renderAdminFaultsDrawerList, renderAdminRouteFaultsList, toggleAdminFaultsDrawer, switchAdminFaultsTab, selectFault, selectFaultTypeChoice, resolveSpecificFault, toggleFaultResponsibility, deleteFaultAction, reopenFaultAction, handleQuickFaultInputSubmit, handleAddFaultSubmit, setFaultsChangedListener } from './faults_manager.js';
import { loadAndRenderNavigation, toggleAdminNavigationHUD, toggleAdminStepsDropdown, resolveCurrentTargetFault, toggleStepsDropdown, focusOnLeg, focusOnVehicle, focusOnAllVehicles, toggleVehicleFocusDropdown, selectMissionVehicle, toggleDispatchModeAction, setFaultResolvedCallback, openSahaVehicleSelectModal, setSahaVehicleAction } from './navigation_manager.js';
import { openReportManagerModal, handleGenerateReportSubmit, deleteReportRecord, loadReportHistory, switchReportTab } from './report_manager.js';
import { openDisabledManagerModal, loadDisabledItems, toggleStationActiveStatus, toggleKioskActiveStatus, updateDisabledCountBadge } from './disabled_manager.js';
import { openMaintenanceModal, executeKioskMaintenancePlan, executeTurnikeMaintenancePlan, selectMaintenanceStartVehicle } from './navigation/maintenance_manager.js';
import { openTelemetryModal, startLiveTelemetryAction, stopLiveTelemetryAction, fetchTelemetryStatus, selectVehicleAction } from './telemetry_manager.js';

let isMapInitialized = false;

// =========================================================================
// HTML ONCLICK VE GLOBAL KÖPRÜ (Window Bindings)
// =========================================================================

Object.assign(window, {
    toggleTheme,
    fetchSystemData,
    setUIRoleMode,
    switchViewMode,
    toggleAdminSidebar,
    toggleAdminFaultsDrawer,
    switchAdminFaultsTab,
    renderAdminRouteFaultsList,
    toggleAdminNavigationHUD,
    toggleAdminStepsDropdown,
    resolveCurrentTargetFault,
    toggleStepsDropdown,
    focusOnLeg,
    focusOnVehicle,
    focusOnAllVehicles,
    toggleVehicleFocusDropdown,
    selectMissionVehicle,
    openSahaVehicleSelectModal,
    setSahaVehicleAction,
    toggleDispatchModeAction,
    focusOnBase,
    closeDetailPanel,
    selectStation,
    selectKiosk,
    selectBayi,
    selectFault,
    selectFaultItem: (id) => selectFault(id),
    selectFaultTypeChoice,
    resolveSpecificFault,
    toggleFaultResponsibility,
    deleteFaultAction,
    reopenFaultAction,
    handleQuickFaultInputSubmit,
    handleAddFaultSubmit,
    openKioskManagerModal,
    openAddKioskModal,
    handleAddKioskSubmit,
    openEditKioskModal,
    handleEditKioskSubmit,
    confirmDeleteKiosk,
    openSwapKioskModal,
    handleSwapKioskSubmit,
    openAddDeviceModal,
    handleAddDeviceSubmit,
    openEditDeviceModal,
    handleEditDeviceSubmit,
    confirmDeleteDevice,
    openRelocateDeviceModal,
    handleRelocateDeviceSubmit,
    openReportManagerModal,
    handleGenerateReportSubmit,
    deleteReportRecord,
    loadReportHistory,
    switchReportTab,
    openDisabledManagerModal,
    loadDisabledItems,
    toggleStationActiveStatus,
    toggleKioskActiveStatus,
    updateDisabledCountBadge,
    openMaintenanceModal,
    executeKioskMaintenancePlan,
    executeTurnikeMaintenancePlan,
    openTelemetryModal,
    startLiveTelemetryAction,
    stopLiveTelemetryAction,
    fetchTelemetryStatus,
    selectVehicleAction,
    startPickingCoordinates,
    cancelPickingCoordinates,
    openModal,
    closeModal,
    handleLoginSubmit,
    quickLogin,
    handleLogout
});

// =========================================================================
// ROL BAZLI ARAYÜZ MODU (SAHA VS ADMIN)
// =========================================================================

export function setUIRoleMode(mode) {
    if (!state.currentUser) {
        document.body.className = 'auth-required';
        return;
    }

    state.activeRoleView = mode === 'admin' ? 'admin' : 'saha';
    sessionStorage.setItem('clientRoleView', state.activeRoleView);
    document.body.className = state.activeRoleView === 'admin' ? 'view-role-admin' : 'view-role-saha';

    if (state.activeRoleView === 'saha') {
        const detailPanel = document.getElementById('detail-panel');
        if (detailPanel) detailPanel.style.display = 'none';
    }

    applyRoleLayerVisibility(state.activeRoleView, true);

    setTimeout(() => {
        const map = getMap();
        if (map) map.invalidateSize();
    }, 150);

    renderAuthHeaders();
    renderList();
    renderAdminFaultsDrawerList();
    loadAndRenderNavigation();
}

export function closeDetailPanel() {
    const detailPanel = document.getElementById('detail-panel');
    if (detailPanel) detailPanel.style.display = 'none';
    state.activeItemId = null;
    renderList();
}

export function focusOnBase() {
    const map = getMap();
    if (state.appData && state.appData.ana_us && map) {
        map.flyTo([state.appData.ana_us.enlem, state.appData.ana_us.boylam], 16, { duration: 0.8 });
        if (markersMap[state.appData.ana_us.id]) {
            markersMap[state.appData.ana_us.id].openPopup();
        }
    }
}

// =========================================================================
// SAHA GÖRÜNÜMÜ: 4 ANA MOD GEÇİŞ SİSTEMİ
// =========================================================================

export function switchViewMode(modeName) {
    const validModes = ['mission', 'faults', 'stations', 'admin'];
    if (!validModes.includes(modeName)) modeName = 'mission';

    validModes.forEach(m => {
        const tab = document.getElementById(`tab-mode-${m}`);
        const view = document.getElementById(`view-mode-${m}`);
        if (tab) tab.classList.toggle('active', m === modeName);
        if (view) view.classList.toggle('active', m === modeName);
    });

    if (modeName === 'mission') {
        loadAndRenderNavigation();
    } else if (modeName === 'faults') {
        renderFaultsDrawerList();
    } else if (modeName === 'stations') {
        renderList();
    } else if (modeName === 'admin') {
        updateSahaAdminTab();
    }
}

function updateSahaAdminTab() {
    const authPrompt = document.getElementById('saha-admin-auth-prompt');
    const actionsContent = document.getElementById('saha-admin-actions-content');
    const isAdmin = state.currentUser && state.currentUser.rol === 'ADMIN';

    if (authPrompt && actionsContent) {
        authPrompt.style.display = isAdmin ? 'none' : 'block';
        actionsContent.style.display = isAdmin ? 'block' : 'none';
    }
}

// =========================================================================
// SİSTEM VERİSİ VE KİMLİK DOĞRULAMA
// =========================================================================

async function fetchSystemData() {
    try {
        const data = await ApiService.getSystemData();
        state.appData = data;

        if (!isMapInitialized) {
            initMap();
            isMapInitialized = true;
        }

        renderMapLayers(data, state.currentUser, {
            onSelectStation: selectStation,
            onSelectKiosk: selectKiosk,
            onSelectBayi: selectBayi,
            onEditKiosk: openEditKioskModal,
            onDeleteKiosk: confirmDeleteKiosk
        });

        renderList();
        populateFaultLocationsDatalist();
        if (typeof window.updateDisabledCountBadge === 'function') {
            window.updateDisabledCountBadge();
        }

        const posTextSaha = document.getElementById('saha-sidebar-vehicle-pos');
        const posTextBaseAdmin = document.getElementById('admin-sidebar-base-pos');
        const posTextVehicleAdmin = document.getElementById('admin-sidebar-vehicle-pos');
        if (data.ana_us) {
            const coords = `${data.ana_us.enlem}, ${data.ana_us.boylam}`;
            if (posTextSaha) posTextSaha.innerText = coords;
            if (posTextBaseAdmin) posTextBaseAdmin.innerText = coords;
            if (posTextVehicleAdmin) posTextVehicleAdmin.innerText = 'Canlı Konum & Rota';
        }
    } catch (err) {
        console.error('Sistem verisi yükleme hatası:', err);
    }
}

function populateFaultLocationsDatalist() {
    const datalist = document.getElementById('datalist-fault-locations');
    if (!datalist || !state.appData) return;

    datalist.innerHTML = '';
    const istasyonlar = state.appData.istasyonlar || {};
    for (const [_, st] of Object.entries(istasyonlar)) {
        datalist.innerHTML += `<option value="${st.ad} İstasyonu"></option>`;
    }
    const kiosklar = state.appData.kiosklar || [];
    for (const k of kiosklar) {
        datalist.innerHTML += `<option value="${k.ad}"></option>`;
    }
}

let currentSystemVersion = null;
let realtimeSyncInterval = null;
let sseEventSource = null;

export async function performLiveSync() {
    try {
        await fetchFaultsData();
        await fetchSystemData();
        await loadAndRenderNavigation();
        await fetchTelemetryStatus();
        renderAdminFaultsDrawerList();
        renderList();

        const role = sessionStorage.getItem('clientRoleView') || state.activeRoleView || 'saha';
        applyRoleLayerVisibility(role, false);
    } catch (err) {
        console.error('Canlı senkronizasyon hatası:', err);
    }
}

export function startRealtimeSync() {
    if (window.EventSource && !sseEventSource) {
        try {
            sseEventSource = new EventSource('/api/canli-yayin');
            sseEventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data && data.surum && (currentSystemVersion === null || currentSystemVersion !== data.surum)) {
                        currentSystemVersion = data.surum;
                        performLiveSync();
                    }
                } catch (e) {}
            };
        } catch (e) {}
    }

    if (!realtimeSyncInterval) {
        realtimeSyncInterval = setInterval(async () => {
            try {
                const res = await ApiService.getSystemVersion();
                if (res && res.basarili && res.surum && (currentSystemVersion === null || currentSystemVersion !== res.surum)) {
                    currentSystemVersion = res.surum;
                    await performLiveSync();
                }
            } catch (e) {}
        }, 2000);
    }
}

async function checkAuthStatus() {
    try {
        const data = await ApiService.checkAuthStatus();
        if (data.giris_yapildi && data.kullanici) {
            state.currentUser = data.kullanici;
            sessionStorage.setItem('appUser', JSON.stringify(data.kullanici));
            
            const savedRole = sessionStorage.getItem('clientRoleView');
            const targetRole = (data.kullanici.rol === 'ADMIN' && savedRole) ? savedRole : (data.kullanici.rol === 'ADMIN' ? 'admin' : 'saha');
            sessionStorage.setItem('clientRoleView', targetRole);
            setUIRoleMode(targetRole);

            await fetchSystemData();
            await fetchFaultsData();
            await loadAndRenderNavigation();

            startRealtimeSync();

            if (targetRole !== 'admin') {
                setTimeout(() => focusOnVehicle(16), 300);
            }
        } else {
            state.currentUser = null;
            sessionStorage.removeItem('appUser');
            sessionStorage.removeItem('clientRoleView');
            document.body.className = 'auth-required';
        }
        renderAuthHeaders();
        updateSahaAdminTab();
    } catch (err) {
        console.error('Yetki kontrolü hatası:', err);
        state.currentUser = null;
        document.body.className = 'auth-required';
    }
}

function renderAuthHeaders() {
    const containerSaha = document.getElementById('saha-header-auth-container');
    const containerAdmin = document.getElementById('admin-header-auth-container');

    const themeToggleHtml = `
        <button type="button" class="theme-toggle-btn" onclick="window.toggleTheme()" title="Tema Değiştir (Aydınlık / Karanlık)">
            <svg class="theme-icon-moon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            <svg class="theme-icon-sun" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <span class="theme-btn-text">Karanlık</span>
        </button>
    `;

    if (state.currentUser) {
        if (containerSaha) {
            containerSaha.innerHTML = `
                <div class="user-profile-box">
                    <div class="user-meta-group">
                        <span class="user-name-text">${state.currentUser.ad_soyad}</span>
                        <span class="user-badge-role">SAHA OPERATÖRÜ</span>
                    </div>
                    ${themeToggleHtml}
                    <button class="btn-logout" onclick="window.handleLogout()" title="Oturumu Kapat">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            `;
        }

        if (containerAdmin) {
            containerAdmin.innerHTML = `
                <div class="user-profile-box">
                    <div class="user-meta-group">
                        <span class="user-name-text">${state.currentUser.ad_soyad}</span>
                        <span class="user-badge-role">YÖNETİCİ</span>
                    </div>
                    ${themeToggleHtml}
                    <button class="btn-logout" onclick="window.handleLogout()" title="Oturumu Kapat">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            `;
        }
    } else {
        if (containerSaha) containerSaha.innerHTML = themeToggleHtml;
        if (containerAdmin) containerAdmin.innerHTML = themeToggleHtml;
    }

    if (window.initThemeUI) window.initThemeUI();
}

async function quickLogin(username, password) {
    try {
        const data = await ApiService.login(username, password);
        if (data.basarili) {
            state.currentUser = data.kullanici;
            sessionStorage.setItem('appUser', JSON.stringify(data.kullanici));
            showToast(`Hoş geldiniz, ${data.kullanici.ad_soyad}.`, 'success');
            
            const targetRole = data.kullanici.rol === 'ADMIN' ? 'admin' : 'saha';
            sessionStorage.setItem('clientRoleView', targetRole);
            setUIRoleMode(targetRole);

            await fetchSystemData();
            await fetchFaultsData();
            await loadAndRenderNavigation();
            startRealtimeSync();

            if (targetRole !== 'admin') {
                setTimeout(() => focusOnVehicle(16), 300);
            }
        } else {
            showToast(data.mesaj || 'Giriş başarısız.', 'error');
        }
    } catch (err) {
        showToast('Sunucu bağlantı hatası.', 'error');
    }
}

export async function handleLoginSubmit(e) {
    if (e) e.preventDefault();
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const errorDiv = document.getElementById('auth-login-error');
    const submitBtn = document.getElementById('btn-login-submit');

    if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.innerText = '';
    }

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
        const msg = 'Lütfen kullanıcı adı ve şifrenizi giriniz.';
        if (errorDiv) {
            errorDiv.innerText = msg;
            errorDiv.style.display = 'block';
        }
        showToast(msg, 'warning');
        return;
    }

    if (submitBtn) submitBtn.disabled = true;

    try {
        const data = await ApiService.login(username, password);
        if (data && data.basarili) {
            state.currentUser = data.kullanici;
            sessionStorage.setItem('appUser', JSON.stringify(data.kullanici));
            showToast(`Hoş geldiniz, ${data.kullanici.ad_soyad}.`, 'success');
            
            const targetRole = data.kullanici.rol === 'ADMIN' ? 'admin' : 'saha';
            sessionStorage.setItem('clientRoleView', targetRole);
            setUIRoleMode(targetRole);

            await fetchSystemData();
            await fetchFaultsData();
            await loadAndRenderNavigation();
            startRealtimeSync();

            if (data.kullanici.rol !== 'ADMIN') {
                setTimeout(() => focusOnVehicle(16), 300);
            }
        } else {
            const errorMsg = (data && data.mesaj) ? data.mesaj : 'Kullanıcı adı veya şifre hatalı!';
            if (errorDiv) {
                errorDiv.innerText = errorMsg;
                errorDiv.style.display = 'block';
            }
            showToast(errorMsg, 'error');
        }
    } catch (err) {
        console.error('Giriş yaparken hata:', err);
        const failMsg = 'Giriş yapılırken sunucu hatası oluştu.';
        if (errorDiv) {
            errorDiv.innerText = failMsg;
            errorDiv.style.display = 'block';
        }
        showToast(failMsg, 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

export async function handleLogout() {
    try {
        await ApiService.logout();
    } catch (err) {}
    state.currentUser = null;
    sessionStorage.removeItem('appUser');
    sessionStorage.removeItem('clientRoleView');
    document.body.className = 'auth-required';
    showToast('Oturum kapatıldı.', 'info');
}

// =========================================================================
// OLAY DİNLEYİCİLERİ (Event Listeners)
// =========================================================================

function setupEventListeners() {

    const bindSearch = (elemId) => {
        const input = document.getElementById(elemId);
        if (input) {
            input.addEventListener('input', (e) => {
                state.currentSearchTerm = e.target.value.trim();
                renderList();
            });
        }
    };
    bindSearch('admin-input-search');

    const bindFilters = (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                container.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                state.currentFilter = tab.dataset.filter;
                renderList();
            });
        });
    };
    bindFilters('admin-station-filter-tabs');

    const bindFaultFilters = (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.querySelectorAll('[data-fault-filter]').forEach(tab => {
            tab.addEventListener('click', () => {
                container.querySelectorAll('[data-fault-filter]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                state.currentFaultFilter = tab.dataset.faultFilter;
                renderAdminFaultsDrawerList();
            });
        });
    };
    bindFaultFilters('admin-fault-filter-tabs');

    const adminFaultSearch = document.getElementById('admin-input-fault-search');
    if (adminFaultSearch) {
        adminFaultSearch.addEventListener('input', (e) => {
            state.currentFaultSearchTerm = e.target.value.trim();
            renderAdminFaultsDrawerList();
        });
    }

    const adminResolvedSearch = document.getElementById('admin-input-resolved-search');
    if (adminResolvedSearch) {
        adminResolvedSearch.addEventListener('input', (e) => {
            state.currentResolvedFaultSearchTerm = e.target.value.trim();
            renderAdminFaultsDrawerList();
        });
    }

    const adminRouteSearch = document.getElementById('admin-input-route-search');
    if (adminRouteSearch) {
        adminRouteSearch.addEventListener('input', (e) => {
            state.currentRouteSearchTerm = e.target.value.trim();
            renderAdminFaultsDrawerList();
        });
    }

    const kioskTableSearch = document.getElementById('kiosk-table-search');
    if (kioskTableSearch) {
        kioskTableSearch.addEventListener('input', (e) => {
            renderKioskTable(e.target.value.trim());
        });
    }

    const bindToggle = (elemId, stateKey) => {
        const el = document.getElementById(elemId);
        if (el) {
            el.addEventListener('change', (e) => {
                const activeRole = state.activeRoleView || 'saha';
                if (state.roleLayerStates && state.roleLayerStates[activeRole]) {
                    state.roleLayerStates[activeRole][stateKey] = e.target.checked;
                }
                applyRoleLayerVisibility(activeRole);
            });
        }
    };

    bindToggle('toggle-route', 'route');
    bindToggle('toggle-faults', 'faults');
    bindToggle('toggle-lines', 'lines');
    bindToggle('toggle-stations', 'stations');
    bindToggle('toggle-station-names', 'stationNames');
    bindToggle('toggle-kiosks', 'kiosks');
    bindToggle('toggle-kiosk-names', 'kioskNames');
    bindToggle('toggle-bayiler', 'bayiler');

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });
}

// =========================================================================
// UYGULAMA BAŞLATMA (Bootstrap)
// =========================================================================

document.addEventListener('DOMContentLoaded', async () => {
    initThemeUI();
    setupEventListeners();

    setFaultResolvedCallback(async () => {
        await performLiveSync();
    });

    setFaultsChangedListener(async () => {
        await performLiveSync();
    });

    setInventoryChangedListener(async () => {
        await performLiveSync();
    });

    await checkAuthStatus();
});
