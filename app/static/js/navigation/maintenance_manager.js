/**
   Kayseri Ulaşım - Periyodik Bakım Rota Planlama Yöneticisi (MaintenanceManager)
   Kiosk (TSP 2-Opt) ve Turnike (Hat Bazlı) Bakım Rotaları üretir, haritada çizer ve Excel indirir.
 */

export function openMaintenanceModal(defaultTab = 'kiosk') {
  if (typeof window.openReportManagerModal === 'function') {
    window.openReportManagerModal(defaultTab);
  } else if (typeof window.openModal === 'function') {
    window.openModal('modal-report-manager');
  }
}

export function triggerExcelDownload(url) {
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', '');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function executeKioskMaintenancePlan() {
  const btn = document.getElementById('btn-plan-kiosk-maintenance');
  const startSelect = document.getElementById('select-kiosk-start-type');
  const rawVal = startSelect ? startSelect.value : 'CAR';
  const startLocationType = rawVal === 'DEPOT' ? 'DEPOT' : 'CAR';
  const imei = (rawVal !== 'DEPOT' && rawVal !== 'CAR') ? rawVal : undefined;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>HESAPLANIYOR...</span>`;
  }

  try {
    const payload = { startLocationType, imei };
    if (window.currentVehicleLocation && window.currentVehicleLocation.enlem) {
      payload.startLat = window.currentVehicleLocation.enlem;
      payload.startLon = window.currentVehicleLocation.boylam;
    }

    const res = await fetch('/api/bakim/planla-kiosk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.basarili || !data.plan) {
      alert(data.mesaj || 'Kiosk bakım planı oluşturulamadı.');
      return;
    }

    renderMaintenancePlanResult(data.plan, data.excel_download_url);
    renderMaintenanceRouteOnMap(data.plan);
    if (typeof window.loadReportHistory === 'function') {
      window.loadReportHistory();
    }

    if (data.excel_download_url) {
      triggerExcelDownload(data.excel_download_url);
    }
  } catch (err) {
    console.error('Kiosk bakım planı hatası:', err);
    alert('Kiosk Bakım Hatası: ' + (err.message || 'İşlem sırasında hata oluştu.'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg><span>KİOSK ROTA & EXCEL ÜRET</span>`;
    }
  }
}

export async function executeTurnikeMaintenancePlan() {
  const btn = document.getElementById('btn-plan-turnike-maintenance');
  const lineSelect = document.getElementById('select-turnike-line-filter');
  const startSelect = document.getElementById('select-turnike-start-type');
  const lineFilter = lineSelect ? lineSelect.value : 'ALL';
  const rawVal = startSelect ? startSelect.value : 'CAR';
  const startLocationType = rawVal === 'DEPOT' ? 'DEPOT' : 'CAR';
  const imei = (rawVal !== 'DEPOT' && rawVal !== 'CAR') ? rawVal : undefined;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>HESAPLANIYOR...</span>`;
  }

  try {
    const payload = { lineFilter, startLocationType, imei };
    if (window.currentVehicleLocation && window.currentVehicleLocation.enlem) {
      payload.startLat = window.currentVehicleLocation.enlem;
      payload.startLon = window.currentVehicleLocation.boylam;
    }

    const res = await fetch('/api/bakim/planla-turnike', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.basarili || !data.plan) {
      alert(data.mesaj || 'Turnike bakım planı oluşturulamadı.');
      return;
    }

    renderMaintenancePlanResult(data.plan, data.excel_download_url);
    renderMaintenanceRouteOnMap(data.plan);
    if (typeof window.loadReportHistory === 'function') {
      window.loadReportHistory();
    }

    if (data.excel_download_url) {
      triggerExcelDownload(data.excel_download_url);
    }
  } catch (err) {
    console.error('Turnike bakım planı hatası:', err);
    alert('Turnike Bakım Hatası: ' + (err.message || 'İşlem sırasında hata oluştu.'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>TURNİKE ROTA & EXCEL ÜRET</span>`;
    }
  }
}

export function renderMaintenancePlanResult(plan, excelUrl) {
  const container = document.getElementById('maintenance-plan-result-container');
  const titleEl = document.getElementById('txt-maint-plan-title');
  const statsEl = document.getElementById('txt-maint-plan-stats');
  const downloadBtn = document.getElementById('btn-maint-download-excel');

  if (!container) return;

  if (titleEl) {
    titleEl.textContent = `${plan.baslik} (1..${plan.toplam_durak} Sıralı Rota)`;
  }

  if (statsEl) {
    statsEl.innerHTML = `
      <span><strong>Toplam Nokta:</strong> ${plan.toplam_durak} Adet</span>
      <span style="margin: 0 4px;">•</span>
      <span><strong>Toplam Sürüş:</strong> ${plan.toplam_mesafe_km} km</span>
      <span style="margin: 0 4px;">•</span>
      <span><strong>Tahmini Süre:</strong> ~${plan.toplam_sure_dk} dk</span>
    `;
  }

  if (downloadBtn && excelUrl) {
    downloadBtn.href = excelUrl;
  }

  container.style.display = 'block';
}

function getLeafletMapInstance() {
  if (typeof window.getMap === 'function') {
    const m = window.getMap();
    if (m && typeof m.addLayer === 'function') return m;
  }
  if (window.map && typeof window.map.addLayer === 'function') return window.map;
  if (window.leafletMap && typeof window.leafletMap.addLayer === 'function') return window.leafletMap;
  return null;
}

export function renderMaintenanceRouteOnMap(plan) {
  const mapObj = getLeafletMapInstance();
  if (!mapObj) return;

  // Remove any existing maintenance layer from the map and do not draw any route lines/markers
  if (window.maintenanceRouteLayerGroup) {
    try {
      mapObj.removeLayer(window.maintenanceRouteLayerGroup);
      window.maintenanceRouteLayerGroup = null;
    } catch (e) {
      console.warn('Katman temizlenirken uyarı:', e);
    }
  }
}

export function selectMaintenanceStartVehicle(tabName, val, btnEl) {
  const hiddenInputId = tabName === 'kiosk' ? 'select-kiosk-start-type' : 'select-turnike-start-type';
  const hiddenInput = document.getElementById(hiddenInputId);
  if (hiddenInput) {
    hiddenInput.value = val;
  }

  const container = btnEl.closest('.maint-picker-cards');
  if (container) {
    container.querySelectorAll('.maint-picker-card').forEach(card => {
      card.classList.remove('active-emerald', 'active-amber', 'active-blue');
    });

    if (val === '861000000000001') {
      btnEl.classList.add('active-emerald');
    } else if (val === '861000000000002') {
      btnEl.classList.add('active-amber');
    } else {
      btnEl.classList.add('active-blue');
    }
  }
}

// Global Exports
if (typeof window !== 'undefined') {
  window.openMaintenanceModal = openMaintenanceModal;
  window.executeKioskMaintenancePlan = executeKioskMaintenancePlan;
  window.executeTurnikeMaintenancePlan = executeTurnikeMaintenancePlan;
  window.selectMaintenanceStartVehicle = selectMaintenanceStartVehicle;
}

