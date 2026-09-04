import request from 'supertest';
import { createApp } from '../src/server';
import { GpsTelemetryService } from '../src/services/gps-telemetry.service';
import { RoutingService } from '../src/services/routing.service';

describe('GpsTelemetryService & Routing Telemetry API Tests', () => {
  let app: any;

  beforeAll(() => {
    app = createApp();
  });

  afterEach(() => {
    GpsTelemetryService.stopPolling();
    RoutingService.resetVehiclePosition();
  });

  it('1. GpsTelemetryService ilk durum raporu doğru dönmelidir', () => {
    const status = GpsTelemetryService.getStatus();
    expect(status).toHaveProperty('aktif');
    expect(status).toHaveProperty('canli_mod_mu');
    expect(status.hedef_imei).toBe('861000000000001');
    expect(status.arac_plaka).toBe('38 BKM 001');
  });

  it('2. GpsTelemetryService.setSessionCookie() manuel oturum anahtarını kaydedip SQLite veritabanında saklamalıdır', () => {
    GpsTelemetryService.setSessionCookie('custom_cookie_abc123');
    expect(GpsTelemetryService.getSessionCookie()).toBe('ASP.NET_SessionId=custom_cookie_abc123');
  });

  it('3. GpsTelemetryService.fetchLatestGps() canlı konum çekmeli ve araç konumunu güncellemelidir', async () => {
    await GpsTelemetryService.fetchLatestGps();

    const vehiclePos = RoutingService.getVehiclePosition('861000000000001');
    expect(vehiclePos.enlem).toBeGreaterThan(30);
    expect(vehiclePos.boylam).toBeGreaterThan(30);
  });

  it('4. GET /api/telemetri/durum endpoint telemetri durumunu dönmelidir', async () => {
    const res = await request(app).get('/api/telemetri/durum');
    expect(res.status).toBe(200);
    expect(res.body.basarili).toBe(true);
    expect(res.body.telemetri_durumu).toBeDefined();
    expect(res.body.telemetri_durumu.arac_plaka).toBe('38 BKM 001');
  });

  it('5. POST /api/telemetri/oturum-anahtari oturum anahtarını kaydetmeli ve canlı takibi başlatmalıdır', async () => {
    const res = await request(app)
      .post('/api/telemetri/oturum-anahtari')
      .send({ oturum_anahtari: 'ASP.NET_SessionId=user_entered_key_999' });

    expect(res.status).toBe(200);
    expect(res.body.basarili).toBe(true);
    expect(res.body.telemetri_durumu.oturum_anahtari_var_mi).toBe(true);
    expect(res.body.telemetri_durumu.oturum_anahtari).toBe('ASP.NET_SessionId=user_entered_key_999');
  });

  it('6. POST /api/telemetri/arac-sec 38 BKM 001 ve 38 BKM 002 arasında geçiş yapmalıdır', async () => {
    const switchRes = await request(app)
      .post('/api/telemetri/arac-sec')
      .send({ imei: '861000000000002' });

    expect(switchRes.status).toBe(200);
    expect(switchRes.body.basarili).toBe(true);
    expect(switchRes.body.telemetri_durumu.arac_plaka).toBe('38 BKM 002');
    expect(switchRes.body.telemetri_durumu.hedef_imei).toBe('861000000000002');

    // Switch back
    const switchBackRes = await request(app)
      .post('/api/telemetri/arac-sec')
      .send({ imei: '861000000000001' });

    expect(switchBackRes.status).toBe(200);
    expect(switchBackRes.body.telemetri_durumu.arac_plaka).toBe('38 BKM 001');
  });

  it('7. GET /api/arac/konum her iki aracı da (38 BKM 001 & 38 BKM 002) birlikte dönmelidir', async () => {
    const res = await request(app).get('/api/arac/konum');
    expect(res.status).toBe(200);
    expect(res.body.basarili).toBe(true);
    expect(res.body.tum_araclar).toBeDefined();
    expect(res.body.tum_araclar.length).toBeGreaterThanOrEqual(2);
  });

  it('8. POST /api/telemetri/baslat oturum anahtarı yoksa 400 dönmelidir', async () => {
    GpsTelemetryService.setSessionCookie(null);
    const startRes = await request(app)
      .post('/api/telemetri/baslat')
      .send({ aralik_ms: 1000 });

    expect(startRes.status).toBe(400);
    expect(startRes.body.basarili).toBe(false);
  });

  it('9. Proxy yapılandırması localhost:9999 olarak raporlanmalıdır', () => {
    GpsTelemetryService.setProxyUrl('http://127.0.0.1:9999');
    const status = GpsTelemetryService.getStatus();
    expect(status.proxy_sunucu).toBe('http://127.0.0.1:9999');
  });
});
