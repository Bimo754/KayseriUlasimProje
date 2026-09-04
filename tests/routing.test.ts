import request from 'supertest';
import { createApp } from '../src/server';
import { RoutingService } from '../src/services/routing.service';
import { FaultService } from '../src/services/fault.service';
import { getDb } from '../src/database/db';

describe('Rota Optimizasyonu & Navigasyon Birim Testleri (Routing Tests)', () => {
  jest.setTimeout(30000);
  const app = createApp();

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM arizalar').run();
    FaultService.parseBulkText("Düvenönü 1. Turnike Kaçak Düştü; Mimsin Kiosk 2 bilet alma ünitesi arızalı; Cumhuriyet Meydanı 1. turnike kart okumuyor");
    RoutingService.resetVehiclePosition();
  });

  afterEach(() => {
    RoutingService.resetVehiclePosition();
  });

  afterAll(() => {
    RoutingService.resetVehiclePosition();
  });

  test('Rota optimizasyonu çalıştırma ve durak sıralama doğrulaması', async () => {
    const route = await RoutingService.optimizeRoute();
    expect(route.basarili).toBe(true);
    expect(route.toplam_durak).toBeGreaterThan(0);
    expect(route.toplam_mesafe_km).toBeGreaterThan(0);

    const duraklar = route.duraklar;
    const firstStop = duraklar[0];
    expect(firstStop.sira_no).toBe(1);
    expect(firstStop).toHaveProperty('oncelik_puani');

    for (const stop of duraklar) {
      expect(stop.sorumluluk).toBe('DAHILI');
    }
  });

  test('Araç canlı GPS konumu güncelleme testi', () => {
    const pos = RoutingService.setVehiclePosition(38.725, 35.485, 'Saha Test Noktası');
    expect(pos.enlem).toBe(38.725);
    expect(pos.boylam).toBe(35.485);
    expect(pos.ad).toBe('Saha Test Noktası');

    const currentPos = RoutingService.getVehiclePosition();
    expect(currentPos.enlem).toBe(38.725);
  });

  test('REST API /api/navigasyon/rota testi ve her iki araç için sürüş rotası geometrisi doğrulaması', async () => {
    const res = await request(app).get('/api/navigasyon/rota');
    expect(res.status).toBe(200);
    expect(res.body.basarili).toBe(true);
    expect(res.body).toHaveProperty('duraklar');
    expect(res.body).toHaveProperty('bacaklar');
    expect(res.body).toHaveProperty('cift_arac_ozeti');

    // Her iki araç için de rota özeti oluştuğunu doğrula
    expect(res.body.cift_arac_ozeti).toHaveProperty('861000000000001');
    expect(res.body.cift_arac_ozeti).toHaveProperty('861000000000002');

    // Bacaklar içerisindeki rota geometrisi kontrolü
    if (res.body.bacaklar.length > 0) {
      const firstLeg = res.body.bacaklar[0];
      expect(firstLeg).toHaveProperty('geometri');
      expect(Array.isArray(firstLeg.geometri)).toBe(true);
      expect(firstLeg.geometri.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('Çift Araç Paylaşımı (DUAL_SPLIT) ve Tek Araç Odaklı (SINGLE_VEHICLE) mod testleri', async () => {
    // 1. DUAL_SPLIT Testi (Varsayılan): Arızalar 2 araç arasında bölünür
    const dualRes = await request(app).get('/api/navigasyon/rota?mode=DUAL_SPLIT');
    expect(dualRes.status).toBe(200);
    expect(dualRes.body.dagitim_modu).toBe('DUAL_SPLIT');
    const totalSplitStops = dualRes.body.cift_arac_ozeti['861000000000001'].toplam_durak + dualRes.body.cift_arac_ozeti['861000000000002'].toplam_durak;
    expect(totalSplitStops).toBe(3);

    // 2. SINGLE_VEHICLE Testi: Tüm yük seçili tek araca verilir
    const singleRes = await request(app).get('/api/navigasyon/rota?mode=SINGLE_VEHICLE&imei=861000000000001');
    expect(singleRes.status).toBe(200);
    expect(singleRes.body.dagitim_modu).toBe('SINGLE_VEHICLE');
    expect(singleRes.body.cift_arac_ozeti['861000000000001'].toplam_durak).toBe(3);
    expect(singleRes.body.cift_arac_ozeti['861000000000002'].toplam_durak).toBe(0);

    // 3. Mod Değiştirme POST endpoint testi
    const postRes = await request(app)
      .post('/api/navigasyon/dagitim-modu')
      .send({ mode: 'DUAL_SPLIT' });
    expect(postRes.status).toBe(200);
    expect(postRes.body.basarili).toBe(true);
    expect(postRes.body.dagitim_modu).toBe('DUAL_SPLIT');
  });
});
