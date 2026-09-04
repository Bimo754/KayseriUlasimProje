/**
 * Kayseri Ulaşım - UI Yardımcıları, Modallar ve Bildirimler (UI Utils)
 */

export function showToast(message, type = 'success', duration = 4500, title = null) {
    let customTitle = title;
    let customDuration = duration;
    if (typeof duration === 'string') {
        customTitle = duration;
        customDuration = typeof title === 'number' ? title : 4500;
    }

    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const defaultTitles = {
        success: 'Başarılı İşlem',
        error: 'Sistem Hatası',
        warning: 'Sistem Uyarısı',
        info: 'Bilgilendirme'
    };

    const toastTitle = customTitle || defaultTitles[type] || 'Bildirim';

    let iconSvg = '';
    let accentColor = '#10b981';
    if (type === 'success') {
        accentColor = '#10b981';
        iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === 'error') {
        accentColor = '#ef4444';
        iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else if (type === 'warning') {
        accentColor = '#f59e0b';
        iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    } else {
        accentColor = '#3b82f6';
        iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    const toast = document.createElement('div');
    toast.className = `toast-card toast-${type}`;
    
    toast.innerHTML = `
        <div class="toast-icon-wrap">${iconSvg}</div>
        <div class="toast-content">
            <div class="toast-header">
                <span class="toast-title">${toastTitle}</span>
            </div>
            <span class="toast-text">${message}</span>
        </div>
        <button class="toast-close-btn" title="Kapat" aria-label="Kapat">&times;</button>
        <div class="toast-progress-bar" style="background-color: ${accentColor}; animation-duration: ${customDuration}ms;"></div>
    `;

    const closeBtn = toast.querySelector('.toast-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            toast.classList.add('toast-fadeout');
            setTimeout(() => { if (toast.parentElement) toast.remove(); }, 250);
        });
    }

    container.appendChild(toast);

    let dismissTimer = setTimeout(() => {
        toast.classList.add('toast-fadeout');
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 250);
    }, customDuration);

    toast.addEventListener('mouseenter', () => {
        clearTimeout(dismissTimer);
        const progressBar = toast.querySelector('.toast-progress-bar');
        if (progressBar) progressBar.style.animationPlayState = 'paused';
    });

    toast.addEventListener('mouseleave', () => {
        const progressBar = toast.querySelector('.toast-progress-bar');
        if (progressBar) progressBar.style.animationPlayState = 'running';
        dismissTimer = setTimeout(() => {
            toast.classList.add('toast-fadeout');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 250);
        }, 1500);
    });
}

export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

export function escapeQuotes(str) {
    if (!str) return '';
    return String(str)
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;');
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
}

export function formatDriveTime(roadKm) {
    const mins = Math.max(2, Math.round((roadKm / 35.0) * 60));
    return mins;
}

export function getFocusedVehiclePosition(state) {
    if (!state) return null;

    if (state.activeNavigationRoute && state.activeNavigationRoute.arac_konumu) {
        const v = state.activeNavigationRoute.arac_konumu;
        if (v.enlem && v.boylam) {
            return {
                enlem: v.enlem,
                boylam: v.boylam,
                label: v.plaka || (v.imei === '861000000000002' ? '38 BKM 002' : '38 BKM 001')
            };
        }
    }

    if (state.activeVehicleImei && window.vehicleMarkersMap && window.vehicleMarkersMap.has(state.activeVehicleImei)) {
        const marker = window.vehicleMarkersMap.get(state.activeVehicleImei);
        if (marker && typeof marker.getLatLng === 'function') {
            const ll = marker.getLatLng();
            const plaka = state.activeVehicleImei === '861000000000002' ? '38 BKM 002' : '38 BKM 001';
            return {
                enlem: ll.lat,
                boylam: ll.lng,
                label: plaka
            };
        }
    }

    if (state.appData && state.appData.ana_us && state.appData.ana_us.enlem) {
        return {
            enlem: state.appData.ana_us.enlem,
            boylam: state.appData.ana_us.boylam,
            label: 'Üs (Merkez Garaj)'
        };
    }

    return null;
}

export function getCoordinateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}

export function closeAllDrawers() {
    const detail = document.getElementById('detail-panel');
    const stepsDrop = document.getElementById('banner-steps-dropdown');
    const faultsPanel = document.getElementById('admin-faults-panel');
    const sidePanel = document.getElementById('admin-sidebar-panel');
    const toggleFaultBtn = document.getElementById('admin-btn-quick-faults');
    const toggleSideBtn = document.getElementById('admin-btn-toggle-sidebar');

    if (detail) detail.style.display = 'none';
    if (stepsDrop) stepsDrop.style.display = 'none';

    if (faultsPanel) faultsPanel.classList.remove('drawer-open');
    if (sidePanel) sidePanel.classList.remove('drawer-open');
    if (toggleFaultBtn) toggleFaultBtn.classList.remove('active');
    if (toggleSideBtn) toggleSideBtn.classList.remove('active');
}

// =========================================================================
// TEMA YÖNETİMİ (THEME UTILS)
// =========================================================================

export function updateThemeUI(theme) {
    const themeTexts = document.querySelectorAll('.theme-btn-text');
    themeTexts.forEach(el => {
        el.textContent = theme === 'light' ? 'Aydınlık' : 'Karanlık';
    });
}

export function initThemeUI() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    updateThemeUI(currentTheme);
}

export function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('ku_theme', nextTheme);
    
    updateThemeUI(nextTheme);
    
    if (window.setMapTileTheme) {
        window.setMapTileTheme(nextTheme);
    }
}

if (typeof window !== 'undefined') {
    window.toggleTheme = toggleTheme;
}

