/**
 * Kayseri Ulaşım - Canlı Araç GPS & Telemetri Yönetim Modülü (telemetry_manager.js)
 */

import { ApiService } from './api.js';
import { showToast, openModal, closeModal } from './ui_utils.js';

let telemetryStatusCache = null;

export async function fetchTelemetryStatus() {
    try {
        const res = await ApiService.getTelemetryStatus();
        if (res && res.basarili && res.telemetri_durumu) {
            telemetryStatusCache = res.telemetri_durumu;
            updateTelemetryHUD(res.telemetri_durumu);
            updateTelemetryModalUI(res.telemetri_durumu);
            return res.telemetri_durumu;
        }
    } catch (err) {
        console.error('Telemetri durumu okuma hatası:', err);
    }
    return null;
}

// Automatic background status sync every 3.5 seconds
if (typeof window !== 'undefined') {
    setInterval(() => {
        fetchTelemetryStatus().catch(() => {});
    }, 3500);
}

export function updateTelemetryHUD(status) {
    const btns = Array.from(document.querySelectorAll('.btn-hud-telemetry-action'));
    const dots = [document.getElementById('hud-telemetry-dot'), document.getElementById('saha-hud-telemetry-dot')].filter(Boolean);
    const pillBadges = [document.getElementById('hud-telemetry-pill-badge'), document.getElementById('saha-hud-telemetry-pill-badge')].filter(Boolean);
    const badge = document.getElementById('admin-sidebar-telemetry-badge');

    const isActive = status && status.aktif;
    const plate = status && status.arac_plaka ? status.arac_plaka : '38 BKM 001';
    const errorMsg = status && status.hata_mesaji ? status.hata_mesaji : null;
    const hasSessionKey = status && (status.oturum_anahtari_var_mi || Boolean(status.oturum_anahtari));

    btns.forEach(btn => {
        if (errorMsg) {
            btn.classList.add('error-blinking');
            btn.title = `Telemetri Uyarısı: ${errorMsg} (Ayarları açmak için tıklayın)`;
        } else {
            btn.classList.remove('error-blinking');
            btn.title = hasSessionKey ? 'Canlı Araç GPS & Telemetri Yönetimi' : 'Oturum Anahtarı Gerekli - Tıklayın';
        }
    });

    dots.forEach(d => {
        if (errorMsg) {
            d.className = 'telemetry-status-dot error';
        } else {
            d.className = isActive ? 'telemetry-status-dot active' : 'telemetry-status-dot passive';
        }
    });

    pillBadges.forEach(pb => {
        if (errorMsg) {
            pb.innerText = 'HATA';
            pb.className = 'hud-live-pill-badge error';
        } else if (isActive) {
            pb.innerText = 'CANLI';
            pb.className = 'hud-live-pill-badge active';
        } else {
            pb.innerText = hasSessionKey ? 'PASİF' : 'OTURUM GEREKLİ';
            pb.className = 'hud-live-pill-badge passive';
        }
    });

    if (badge) {
        if (errorMsg) {
            badge.innerText = `HATA (SignalR)`;
            badge.className = 'badge-telemetry error';
        } else {
            badge.innerText = isActive ? `CANLI (SignalR)` : `2 ARAÇ (PASİF)`;
            badge.className = isActive ? 'badge-telemetry active' : 'badge-telemetry passive';
        }
    }

    // Update left panel sidebar vehicle quick cards
    const status093 = document.getElementById('sidebar-vehicle-status-093');
    const status089 = document.getElementById('sidebar-vehicle-status-089');
    const vehiclesList = status && status.tum_araclar ? status.tum_araclar : [];
    const v093 = vehiclesList.find(v => v.imei === '861000000000001');
    const v089 = vehiclesList.find(v => v.imei === '861000000000002');

    if (status093) {
        status093.innerText = v093 && v093.hiz != null ? `${Math.round(v093.hiz)} km/s • Canlı` : '1. Saha Aracı';
    }
    if (status089) {
        status089.innerText = v089 && v089.hiz != null ? `${Math.round(v089.hiz)} km/s • Canlı` : '2. Saha Aracı';
    }

    if (window.loadAndRenderNavigation) {
        window.loadAndRenderNavigation().catch(() => {});
    }
}

export function onSessionKeyInputChange() {
    const inputCookie = document.getElementById('telemetry-modal-input-cookie');
    const btnStart = document.getElementById('btn-telemetry-start');
    if (!btnStart) return;

    const val = inputCookie ? inputCookie.value.trim() : '';
    if (val.length > 0) {
        btnStart.disabled = false;
        btnStart.title = "Oturum anahtarını kaydedip canlı akışı başlat";
    } else {
        const hasSaved = telemetryStatusCache && telemetryStatusCache.oturum_anahtari_var_mi;
        if (!hasSaved) {
            btnStart.disabled = true;
            btnStart.title = "Canlı akışı başlatmak için oturum anahtarı girmelisiniz.";
        }
    }
}

export function updateTelemetryModalUI(status) {
    if (!status) return;

    const badgeMode = document.getElementById('telemetry-modal-mode-badge');
    const elError = document.getElementById('telemetry-modal-error');
    const inputCookie = document.getElementById('telemetry-modal-input-cookie');

    const btnStart = document.getElementById('btn-telemetry-start');
    const btnStop = document.getElementById('btn-telemetry-stop');

    if (badgeMode) {
        badgeMode.innerText = status.aktif ? 'CANLI SIGNALR AKIŞI' : (status.oturum_anahtari_var_mi ? 'PASİF (DURDURULDU)' : 'PASİF (Oturum Gerekli)');
        badgeMode.className = status.aktif ? 'status-pill status-pill-active' : 'status-pill status-pill-passive';
    }

    if (inputCookie && status.oturum_anahtari && !inputCookie.value) {
        inputCookie.value = status.oturum_anahtari;
    }

    // Lock / unlock start button based on input value or saved session cookie
    if (btnStart) {
        const val = inputCookie ? inputCookie.value.trim() : '';
        if (val.length > 0 || status.oturum_anahtari_var_mi) {
            btnStart.disabled = false;
        } else {
            btnStart.disabled = true;
        }
    }

    // Populate split vehicle telemetry info cards
    const vehiclesList = status.tum_araclar || [];
    const vehicle093 = vehiclesList.find(v => v.imei === '861000000000001') || {};
    const vehicle089 = vehiclesList.find(v => v.imei === '861000000000002') || {};

    // 1. Vehicle 38 BKM 001
    const speed093 = document.getElementById('telemetry-modal-speed-093');
    const sync093 = document.getElementById('telemetry-modal-last-sync-093');
    const coords093 = document.getElementById('telemetry-modal-coords-093');

    if (speed093) speed093.innerText = vehicle093.hiz != null ? `${Math.round(vehicle093.hiz)} km/s` : '0 km/s';
    if (sync093) sync093.innerText = formatTimeOrFallback(vehicle093.sunucu_zaman || status.son_senkronizasyon);
    if (coords093) {
        coords093.innerText = vehicle093.enlem && vehicle093.boylam ? `${vehicle093.enlem.toFixed(5)}, ${vehicle093.boylam.toFixed(5)}` : '38.72194, 35.48729';
    }

    // 2. Vehicle 38 BKM 002
    const speed089 = document.getElementById('telemetry-modal-speed-089');
    const sync089 = document.getElementById('telemetry-modal-last-sync-089');
    const coords089 = document.getElementById('telemetry-modal-coords-089');

    if (speed089) speed089.innerText = vehicle089.hiz != null ? `${Math.round(vehicle089.hiz)} km/s` : '0 km/s';
    if (sync089) sync089.innerText = formatTimeOrFallback(vehicle089.sunucu_zaman || status.son_senkronizasyon);
    if (coords089) {
        coords089.innerText = vehicle089.enlem && vehicle089.boylam ? `${vehicle089.enlem.toFixed(5)}, ${vehicle089.boylam.toFixed(5)}` : '38.73150, 35.49820';
    }

    if (elError) {
        if (status.hata_mesaji) {
            elError.innerText = `Sistem Bildirimi: ${status.hata_mesaji}`;
            elError.style.display = 'block';
        } else {
            elError.style.display = 'none';
        }
    }

    if (btnStart && btnStop) {
        if (status.aktif) {
            btnStart.style.display = 'none';
            btnStop.style.display = 'inline-flex';
        } else {
            btnStart.style.display = 'inline-flex';
            btnStop.style.display = 'none';
        }
    }
}

function formatTimeOrFallback(timeStr) {
    if (!timeStr) return 'Henüz Çekilmedi';
    let dateObj;
    if (typeof timeStr === 'string' && timeStr.includes('/Date(')) {
        const ms = parseInt(timeStr.replace(/\/Date\((\d+)\)\//, '$1'), 10);
        dateObj = new Date(ms);
    } else if (typeof timeStr === 'number') {
        dateObj = new Date(timeStr);
    } else {
        dateObj = new Date(timeStr);
    }
    if (isNaN(dateObj.getTime())) return String(timeStr);

    return dateObj.toLocaleTimeString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

export async function openTelemetryModal() {
    openModal('modal-telemetri');
    await fetchTelemetryStatus();
}

export async function selectVehicleAction(imei) {
    if (!imei) return;
    try {
        const res = await ApiService.selectVehicle(imei);
        if (res && res.basarili) {
            showToast(res.mesaj || 'Seçili araç güncellendi.', 'success');
            if (res.telemetri_durumu) {
                updateTelemetryHUD(res.telemetri_durumu);
                updateTelemetryModalUI(res.telemetri_durumu);
            }
        } else {
            showToast(res.mesaj || 'Araç değiştirilemedi.', 'error');
        }
    } catch (err) {
        showToast('Sunucu bağlantı hatası.', 'error');
    }
}

export async function startLiveTelemetryAction() {
    const inputCookie = document.getElementById('telemetry-modal-input-cookie');
    const sessionKey = inputCookie ? inputCookie.value.trim() : '';

    try {
        const res = await ApiService.startTelemetry(5000, sessionKey);
        if (res && res.basarili) {
            showToast('Oturum kaydedildi ve Canlı SignalR GPS akışı başlatıldı.', 'success');
            if (res.telemetri_durumu) {
                updateTelemetryHUD(res.telemetri_durumu);
                updateTelemetryModalUI(res.telemetri_durumu);
            }
        } else {
            showToast(res.mesaj || 'Canlı akış başlatılamadı.', 'error');
        }
    } catch (err) {
        showToast('Sunucu bağlantı hatası.', 'error');
    }
}

export async function stopLiveTelemetryAction() {
    try {
        const res = await ApiService.stopTelemetry();
        if (res && res.basarili) {
            showToast('Canlı GPS akışı durduruldu.', 'info');
            if (res.telemetri_durumu) {
                updateTelemetryHUD(res.telemetri_durumu);
                updateTelemetryModalUI(res.telemetri_durumu);
            }
        } else {
            showToast(res.mesaj || 'Telemetri durdurulamadı.', 'error');
        }
    } catch (err) {
        showToast('Sunucu bağlantı hatası.', 'error');
    }
}

// Bind to window object
if (typeof window !== 'undefined') {
    window.openTelemetryModal = openTelemetryModal;
    window.selectVehicleAction = selectVehicleAction;
    window.startLiveTelemetryAction = startLiveTelemetryAction;
    window.stopLiveTelemetryAction = stopLiveTelemetryAction;
    window.onSessionKeyInputChange = onSessionKeyInputChange;
}
