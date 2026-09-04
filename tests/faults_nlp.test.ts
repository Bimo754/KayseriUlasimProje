import { createApp } from '../src/server';
import { FaultService } from '../src/services/fault.service';
import { Responsibility, FaultStatus } from '../src/constants';

describe('Arıza Yönetimi & Doğal Dil Ayrıştırma Birim Testleri (NLP Tests)', () => {
  beforeAll(() => {
    createApp();
  });

  test('WhatsApp mesajı formatındaki çok satırlı arızaların ayrıştırılması', () => {
    const rawMsg = `
    [10:14, 19.08.2026] +90 555 123 45 67: Düvenönü 1. Turnike kaçak düştü enerji yok
    [10:15, 19.08.2026] +90 555 987 65 43: Organize Sanayi 2. turnike okumuyor
    [10:18, 19.08.2026] Ahmet Usta: Cumhuriyet Meydanı 21. iade cihazı dondu
    [10:22, 19.08.2026] Saha Ekip: Halef Hoca kaset dolu para sıkışması
    `;

    const res = FaultService.parseBulkText(rawMsg);
    expect(res.basarili).toBe(true);
    expect(res.toplam_eklenen).toBe(4);

    const faults = res.eklenenler;

    // 1. Düvenönü - En Acil (100 Puan)
    const fDuvenonu = faults.find((f: any) => f.lokasyon_adi.includes('Düvenönü'));
    expect(fDuvenonu).toBeDefined();
    expect(fDuvenonu.ariza_tipi).toBe('TURNIKE_KACAK');
    expect(fDuvenonu.oncelik_puani).toBe(100);
    expect(fDuvenonu.sorumluluk).toBe(Responsibility.DAHILI);

    // 2. İade Validatörü - (20 Puan)
    const fIade = faults.find((f: any) => f.lokasyon_adi.includes('Cumhuriyet Meydanı'));
    expect(fIade).toBeDefined();
    expect(fIade.ariza_tipi).toBe('IADE_VALIDATORU');
    expect(fIade.oncelik_puani).toBe(20);

    // 3. Kaset Dolu - Taşeron
    const fHalef = faults.find((f: any) => f.lokasyon_adi.includes('Halef Hoca'));
    expect(fHalef).toBeDefined();
    expect(fHalef.sorumluluk).toBe(Responsibility.TASERON);
  });

  test('Türkçe çekim ekleri bulunan istasyon isimlerinin doğrulanması', () => {
    const text = "Alparslan'daki serbest kapı manyetik kilidi açılmıyor";
    const res = FaultService.parseBulkText(text);
    expect(res.basarili).toBe(true);
    expect(res.toplam_eklenen).toBe(1);

    const f = res.eklenenler[0];
    expect(f.lokasyon_adi).toContain('Alpaslan');
    expect(f.ariza_tipi).toBe('SERBEST_KAPI');
    expect(f.oncelik_puani).toBe(35);
  });

  test('Tek satırda birden fazla arıza ve birleşik istasyon adlarının ayrıştırılması', () => {
    const rawText =
      'KUMARLIIADE istasyonunda 21. İADE arızalı ' +
      'KUMARLIIADE istasyonunda 22. İADE arızalı ' +
      'MIMARSINANKAVSAGIIAD istasyonunda 21. İADE arızalı ' +
      'MIMARSINANKAVSAGIIAD istasyonunda 22. İADE arızalı ' +
      'PSIKIYATRIIADE istasyonunda 21. İADE arızalı';

    const res = FaultService.parseBulkText(rawText);
    expect(res.basarili).toBe(true);
    expect(res.toplam_eklenen).toBe(5);

    const stationsFound = res.eklenenler.map((f: any) => f.lokasyon_adi);
    expect(stationsFound.filter((s: string) => s.includes('Kumarlı')).length).toBe(2);
    expect(stationsFound.filter((s: string) => s.includes('Mimarsinan')).length).toBe(2);
    expect(stationsFound.filter((s: string) => s.includes('Psikiyatri')).length).toBe(1);
  });

  test('Manuel arıza ekleme ve öncelik sıralaması testi', () => {
    const faultId = FaultService.addFault(
      'Düvenönü İstasyonu',
      'Düvenönü 1. Turnike Kaçak Düştü',
      'TURNIKE_KACAK'
    );
    expect(faultId).toBeGreaterThan(0);

    const activeFaults = FaultService.getAllFaults(FaultStatus.BEKLIYOR);
    expect(activeFaults.length).toBeGreaterThanOrEqual(1);
    expect(activeFaults[0].oncelik_puani).toBe(100);
  });
});
