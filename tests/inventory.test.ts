import request from 'supertest';
import { createApp } from '../src/server';
import { InventoryService } from '../src/services/inventory.service';
import { LocationService } from '../src/services/location.service';

describe('Envanter & Ağ Sorguları Birim Testleri (Inventory Tests)', () => {
  const app = createApp();

  test('Toplu sistem verisi sorgusunun hızlı ve eksiksiz gelmesi (N+1 Çözüm Doğrulaması)', () => {
    const start = Date.now();
    const data = InventoryService.getAllSystemData();
    const duration = (Date.now() - start) / 1000;

    expect(duration).toBeLessThan(0.5);

    expect(data).toHaveProperty('sistem');
    expect(data).toHaveProperty('ana_us');
    expect(data).toHaveProperty('hatlar');
    expect(data).toHaveProperty('istasyonlar');
    expect(data).toHaveProperty('kiosklar');
    expect(data).toHaveProperty('bayiler');

    expect(Object.keys(data.hatlar).length).toBe(4);
    expect(Object.keys(data.istasyonlar).length).toBe(75);
    expect(data.kiosklar.length).toBe(105);
    expect(data.bayiler.length).toBe(374);

    const stMeydan = data.istasyonlar.ist_cumhuriyet_meydani;
    expect(stMeydan).toBeDefined();
    expect(stMeydan.cihazlar.length).toBeGreaterThanOrEqual(8);
  });

  test('Ana üs koordinat ve bilgilerinin doğrulanması', () => {
    const anaUs = InventoryService.getAnaUs();
    expect(anaUs.kod).toBe('ana_us_merkez');
    expect(Number(anaUs.enlem)).toBeCloseTo(38.71425, 4);
    expect(Number(anaUs.boylam)).toBeCloseTo(35.491111, 4);
  });

  test('Kuş uçuşu mesafe hesaplama doğrulaması', () => {
    const dist = LocationService.calculateHaversine(38.720813, 35.481019, 38.721941, 35.487293);
    expect(dist).toBeGreaterThan(0.3);
    expect(dist).toBeLessThan(1.0);
  });

  test('En yakın noktalar sorgusu', () => {
    const points = LocationService.getNearestPoints(38.721941, 35.487293, 3);
    expect(points.length).toBe(3);
    expect(points[0].mesafe_km).toBeLessThanOrEqual(points[1].mesafe_km);
    expect(points[1].mesafe_km).toBeLessThanOrEqual(points[2].mesafe_km);
  });

  test('REST API /api/tum-veri endpoint testi', async () => {
    const res = await request(app).get('/api/tum-veri');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.istasyonlar).length).toBe(75);
  });
});
