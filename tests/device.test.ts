import { createApp } from '../src/server';
import { DeviceService } from '../src/services/device.service';
import { DeviceType, DeviceStatus, Responsibility } from '../src/constants';

describe('Cihaz & Kiosk CRUD İşlemleri Birim Testleri (Device CRUD Tests)', () => {
  beforeAll(() => {
    createApp();
  });

  test('İstasyon cihazı ekleme, güncelleme, taşıma ve silme yaşam döngüsü', () => {
    const testStation = 'ist_cumhuriyet_meydani';
    const testDevNo = 99;
    const testLabel = 'Test Ekstra Turnike 99';

    // 1. Ekleme
    const addRes = DeviceService.addStationDevice(
      testStation,
      DeviceType.TURNIKE,
      testDevNo,
      testLabel,
      'Birim Test Cihazı',
      Responsibility.DAHILI,
      DeviceStatus.NORMAL
    );
    expect(addRes.basarili).toBe(true);
    const devCode = addRes.cihaz_kodu;
    expect(devCode).toBe(`${testStation}_TRN_${testDevNo}`);

    // 2. Güncelleme
    const updRes = DeviceService.updateStationDevice(
      devCode,
      'Güncellenmiş Turnike 99',
      'Açıklama Güncellendi',
      Responsibility.DAHILI,
      DeviceStatus.BAKIMDA
    );
    expect(updRes.basarili).toBe(true);

    // 3. Başka İstasyona Taşıma
    const targetStation = 'ist_duvenonu';
    const relocRes = DeviceService.relocateStationDevice(devCode, targetStation);
    expect(relocRes.basarili).toBe(true);
    const newDevCode = relocRes.yeni_kod;
    expect(newDevCode).toBe(`${targetStation}_TRN_${testDevNo}`);

    // 4. Silme
    const delRes = DeviceService.deleteStationDevice(newDevCode);
    expect(delRes.basarili).toBe(true);
  });

  test('Otomatik kiosk ekleme, düzenleme, takas ve silme yaşam döngüsü', () => {
    // 1. İki Test Kiosku Ekle
    const k1Res = DeviceService.addKiosk('Birim Test Kiosk A', 38.720, 35.500, 'Test Adres A');
    expect(k1Res.basarili).toBe(true);
    const k1Code = k1Res.kiosk_kodu;

    const k2Res = DeviceService.addKiosk('Birim Test Kiosk B', 38.730, 35.510, 'Test Adres B');
    expect(k2Res.basarili).toBe(true);
    const k2Code = k2Res.kiosk_kodu;

    // 2. Düzenleme
    const updK1 = DeviceService.updateKiosk(
      k1Code,
      'Birim Test Kiosk A2',
      38.721,
      35.501,
      'Test Adres A2',
      Responsibility.DAHILI,
      DeviceStatus.NORMAL
    );
    expect(updK1.basarili).toBe(true);

    // 3. İki Kiosku Takas Et
    const swapRes = DeviceService.swapKiosks(k1Code, k2Code);
    expect(swapRes.basarili).toBe(true);

    // 4. Silme
    const delK1 = DeviceService.deleteKiosk(k1Code);
    const delK2 = DeviceService.deleteKiosk(k2Code);
    expect(delK1.basarili).toBe(true);
    expect(delK2.basarili).toBe(true);
  });
});
