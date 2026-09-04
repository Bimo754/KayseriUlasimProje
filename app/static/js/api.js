/**
 * Kayseri Ulaşım - Merkezi REST API İstemcisi (ApiService)
 */

export const ApiService = {
    // 1. Envanter & Sistem Verisi
    async getSystemData() {
        const res = await fetch('/api/tum-veri');
        return await res.json();
    },

    async getAnaUs() {
        const res = await fetch('/api/ana-us');
        return await res.json();
    },

    async getSystemVersion() {
        const res = await fetch('/api/sistem-surumu');
        return await res.json();
    },

    async getNearestPoints(lat, lon, limit = 3, excludeId = null) {
        let url = `/api/en-yakin-noktalar?lat=${lat}&lon=${lon}&limit=${limit}`;
        if (excludeId) url += `&exclude_id=${excludeId}`;
        const res = await fetch(url);
        return await res.json();
    },

    async calculateDistance(lat1, lon1, lat2, lon2) {
        const res = await fetch('/api/mesafe-hesapla', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat1, lon1, lat2, lon2 })
        });
        return await res.json();
    },

    // 2. Kimlik Doğrulama
    async login(username, password) {
        const res = await fetch('/api/auth/giris', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kullanici_adi: username, sifre: password })
        });
        return await res.json();
    },

    async logout() {
        const res = await fetch('/api/auth/cikis', { method: 'POST' });
        return await res.json();
    },

    async checkAuthStatus() {
        const res = await fetch('/api/auth/durum');
        return await res.json();
    },

    // 3. İstasyon Cihazları CRUD & Yer Değiştirme
    async addStationDevice(data) {
        const res = await fetch('/api/cihaz/ekle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    },

    async updateStationDevice(deviceCode, data) {
        const res = await fetch(`/api/cihaz/guncelle/${deviceCode}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    },

    async deleteStationDevice(deviceCode) {
        const res = await fetch(`/api/cihaz/sil/${deviceCode}`, { method: 'DELETE' });
        return await res.json();
    },

    async relocateStationDevice(deviceCode, targetStationCode) {
        const res = await fetch('/api/cihaz/yer-degistir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cihaz_kodu: deviceCode, hedef_istasyon_kodu: targetStationCode })
        });
        return await res.json();
    },

    // 4. Otomatik Kiosk CRUD & Takas
    async addKiosk(data) {
        const res = await fetch('/api/kiosk/ekle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    },

    async updateKiosk(kioskCode, data) {
        const res = await fetch(`/api/kiosk/guncelle/${kioskCode}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    },

    async deleteKiosk(kioskCode) {
        const res = await fetch(`/api/kiosk/sil/${kioskCode}`, { method: 'DELETE' });
        return await res.json();
    },

    async swapKiosks(kiosk1, kiosk2) {
        const res = await fetch('/api/kiosk/takas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kiosk_1: kiosk1, kiosk_2: kiosk2 })
        });
        return await res.json();
    },

    // 5. Arıza & Navigasyon İşlemleri
    async getFaults(status = 'BEKLIYOR') {
        const res = await fetch(`/api/arizalar?durum=${status}`);
        return await res.json();
    },

    async addFault(data) {
        const res = await fetch('/api/ariza/ekle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    },

    async parseBulkFaultText(text) {
        const res = await fetch('/api/ariza/metin-ayristir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metin: text })
        });
        return await res.json();
    },

    async updateFaultStatus(faultId, status, extraData = {}) {
        const res = await fetch(`/api/ariza/durum-guncelle/${faultId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ durum: status, ...extraData })
        });
        return await res.json();
    },

    async deleteFault(faultId) {
        const res = await fetch(`/api/ariza/sil/${faultId}`, { method: 'DELETE' });
        return await res.json();
    },

    async toggleFaultResponsibility(faultId) {
        const res = await fetch(`/api/ariza/sorumluluk-degistir/${faultId}`, { method: 'POST' });
        return await res.json();
    },

    async getNavigationRoute(imei = null, mode = null) {
        let url = '/api/navigasyon/rota';
        const params = [];
        if (imei) params.push(`imei=${encodeURIComponent(imei)}`);
        if (mode) params.push(`mode=${encodeURIComponent(mode)}`);
        if (params.length > 0) url += `?${params.join('&')}`;
        const res = await fetch(url);
        return await res.json();
    },

    async setDispatchMode(mode) {
        const res = await fetch('/api/navigasyon/dagitim-modu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode })
        });
        return await res.json();
    },

    async getVehiclePosition(imei = null) {
        const url = imei ? `/api/arac/konum?imei=${encodeURIComponent(imei)}` : '/api/arac/konum';
        const res = await fetch(url);
        return await res.json();
    },

    async updateVehiclePosition(lat, lon, label) {
        const res = await fetch('/api/arac/konum', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enlem: lat, boylam: lon, ad: label })
        });
        return await res.json();
    },

    // 6. Raporlama API'si (Admin Yetkili)
    async getReports() {
        const res = await fetch('/api/raporlar');
        return await res.json();
    },

    async createReport(data) {
        const res = await fetch('/api/raporlar/olustur', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    },

    async deleteReport(reportId) {
        const res = await fetch(`/api/raporlar/${reportId}`, { method: 'DELETE' });
        return await res.json();
    },

    // 7. Telemetri & Canlı GPS API'si
    async getTelemetryStatus() {
        const res = await fetch('/api/telemetri/durum');
        return await res.json();
    },

    async startTelemetry(intervalMs = 5000, sessionKey = null) {
        const payload = { aralik_ms: intervalMs };
        if (sessionKey) payload.oturum_anahtari = sessionKey;
        const res = await fetch('/api/telemetri/baslat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await res.json();
    },

    async stopTelemetry() {
        const res = await fetch('/api/telemetri/durdur', { method: 'POST' });
        return await res.json();
    },

    async saveSessionKey(sessionKey) {
        const res = await fetch('/api/telemetri/oturum-anahtari', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oturum_anahtari: sessionKey })
        });
        return await res.json();
    },

    async selectVehicle(imei) {
        const res = await fetch('/api/telemetri/arac-sec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imei })
        });
        return await res.json();
    }
};


