import request from 'supertest';
import { createApp } from '../src/server';
import { MaintenanceService } from '../src/services/maintenance.service';
import { RoutingService } from '../src/services/routing.service';

describe('Bakım Planlama Merkezi Testleri (Maintenance Service Tests)', () => {
  jest.setTimeout(30000);
  const app = createApp();

  test('Tüm Otomatik Kiosk periyodik bakım rotası hesaplama (TSP 2-Opt)', async () => {
    const plan = await MaintenanceService.planKioskMaintenance();
    expect(plan.basarili).toBe(true);
    expect(plan.mod).toBe('KIOSK');
    expect(plan.toplam_durak).toBeGreaterThan(0);
    expect(plan.duraklar.length).toBe(plan.toplam_durak);
    expect(plan.duraklar[0].sira_no).toBe(1);
    expect(plan.duraklar[0]).toHaveProperty('bacak_mesafe_km');
    expect(plan.duraklar[0]).toHaveProperty('bacak_sure_dk');
  });

  test('Turnike periyodik bakım rotası hesaplama', async () => {
    const plan = await MaintenanceService.planTurnikeMaintenance('ALL');
    expect(plan.basarili).toBe(true);
    expect(plan.mod).toBe('TURNIKE');
    expect(plan.toplam_durak).toBeGreaterThan(0);
    expect(plan.duraklar[0].tur).toBe('TURNIKE');
  });

  test('Bakım Excel belgesi tamponu (.xlsx) üretme testi', async () => {
    const plan = await MaintenanceService.planKioskMaintenance();
    const buffer = await MaintenanceService.generateMaintenanceExcelBuffer(plan);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  test('POST /api/bakim/planla-kiosk API uç noktası testi', async () => {
    const res = await request(app)
      .post('/api/bakim/planla-kiosk')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.basarili).toBe(true);
    expect(res.body.plan).toBeDefined();
    expect(res.body.excel_download_url).toContain('/api/raporlar/');
  });

  test('POST /api/bakim/planla-turnike API uç noktası testi', async () => {
    const res = await request(app)
      .post('/api/bakim/planla-turnike')
      .send({ lineFilter: 'T1' });

    expect(res.status).toBe(200);
    expect(res.body.basarili).toBe(true);
    expect(res.body.plan).toBeDefined();
  });

  test('T2 Hattı Turnike Bakım Rota Dizilim Testi (Kesintisiz Sıra ve İstasyon Atlamama)', async () => {
    const plan = await MaintenanceService.planTurnikeMaintenance('T2');
    expect(plan.basarili).toBe(true);
    expect(plan.duraklar.length).toBe(18);

    const stationNames = plan.duraklar.map(d => d.ad);

    // Find indices for Talas branch sequence
    const idxYurtlar = stationNames.indexOf('Yurtlar Bölgesi');
    const idxBahcelievler = stationNames.indexOf('Bahçelievler');
    const idxTalasBld = stationNames.indexOf('Talas Belediyesi');
    const idxTalasCemil = stationNames.indexOf('Talas Cemil Baba');

    expect(idxYurtlar).toBeGreaterThanOrEqual(0);
    expect(idxBahcelievler).toBeGreaterThanOrEqual(0);
    expect(idxTalasBld).toBeGreaterThanOrEqual(0);
    expect(idxTalasCemil).toBeGreaterThanOrEqual(0);

    // Assert strict consecutive order without skipping (forward or reverse)
    const isForward = idxYurtlar < idxBahcelievler;
    if (isForward) {
      expect(idxBahcelievler).toBe(idxYurtlar + 1);
      expect(idxTalasBld).toBe(idxBahcelievler + 1);
      expect(idxTalasCemil).toBe(idxTalasBld + 1);
    } else {
      expect(idxTalasBld).toBe(idxTalasCemil + 1);
      expect(idxBahcelievler).toBe(idxTalasBld + 1);
      expect(idxYurtlar).toBe(idxBahcelievler + 1);
    }
  });

  test('Turnike Bakım Planı Dinamik Araç Konumu (startLat, startLon) Testi', async () => {
    // Talas Cemil Baba coordinates: 38.6884892, 35.5545846
    const res = await request(app)
      .post('/api/bakim/planla-turnike')
      .send({ lineFilter: 'T2', startLat: 38.6885, startLon: 35.5546, startLocationType: 'CAR' });

    expect(res.status).toBe(200);
    expect(res.body.basarili).toBe(true);
    // Since starting at Talas Cemil Baba end, first station must be Talas Cemil Baba
    expect(res.body.plan.duraklar[0].ad).toBe('Talas Cemil Baba');
    expect(res.body.plan.baslangic_noktasi.ad).toMatch(/(38 BKM|Saha Bakım Aracı)/);
  });

  test('Turnike ve Kiosk Bakım Planı Depo Başlangıç Noktası (DEPOT) Testi', async () => {
    const resDepot = await request(app)
      .post('/api/bakim/planla-turnike')
      .send({ lineFilter: 'T1', startLocationType: 'DEPOT' });

    expect(resDepot.status).toBe(200);
    expect(resDepot.body.basarili).toBe(true);
    expect(resDepot.body.plan.baslangic_noktasi.ad).toBe('Kayseri Ulaşım Ana Üs & Depo');
  });

  afterEach(() => {
    RoutingService.resetVehiclePosition();
  });

  afterAll(() => {
    RoutingService.resetVehiclePosition();
  });
});
