import { getDb } from '../database/db';
import { DeviceType, getDeviceShortCode, DeviceStatus, Responsibility } from '../constants';
import { FaultService } from './fault.service';

export class DeviceService {
  // =========================================================================
  // İSTASYON CİHAZLARI
  // =========================================================================

  public static addStationDevice(
    stationCode: string,
    deviceType: string,
    deviceNo: number,
    label: string,
    description = '',
    responsibility: string = Responsibility.DAHILI,
    status: string = DeviceStatus.NORMAL,
    username = 'admin'
  ): any {
    if (!stationCode || !deviceType || !label) {
      return { basarili: false, mesaj: 'İstasyon kodu, cihaz türü ve etiket zorunludur.' };
    }

    const devNo = parseInt(deviceNo as any, 10) || 1;
    const db = getDb();

    const stRow = db.prepare('SELECT id, ad FROM istasyonlar WHERE istasyon_kodu=?').get(stationCode) as any;
    if (!stRow) {
      return { basarili: false, mesaj: 'Belirtilen istasyon bulunamadı.' };
    }

    const stId = stRow.id;
    const stName = stRow.ad;
    const typeShort = getDeviceShortCode(deviceType);
    const deviceCode = `${stationCode}_${typeShort}_${devNo}`;

    try {
      const transaction = db.transaction(() => {
        const info = db.prepare(`
          INSERT INTO cihazlar (cihaz_kodu, istasyon_id, cihaz_turu, cihaz_no, tur_etiket, aciklama, sorumluluk, durum)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(deviceCode, stId, deviceType, devNo, label, description, responsibility, status);

        const devId = info.lastInsertRowid;

        db.prepare(`
          INSERT INTO cihaz_hareketleri (cihaz_turu, referans_id, cihaz_kodu, islem_turu, yeni_lokasyon, aciklama, yapan_kullanici)
          VALUES ('ISTASYON_CIHAZI', ?, ?, 'EKLEME', ?, ?, ?)
        `).run(devId, deviceCode, stName, `Yeni cihaz eklendi: ${label}`, username);
      });

      transaction();
      return { basarili: true, mesaj: `${label} başarıyla eklendi.`, cihaz_kodu: deviceCode };
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return { basarili: false, mesaj: `${deviceCode} kodlu cihaz zaten mevcut!` };
      }
      return { basarili: false, mesaj: err.message };
    }
  }

  public static updateStationDevice(
    deviceCode: string,
    label: string,
    description = '',
    responsibility: string = Responsibility.DAHILI,
    status: string = DeviceStatus.NORMAL,
    username = 'admin'
  ): any {
    if (!deviceCode || !label) {
      return { basarili: false, mesaj: 'Cihaz kodu ve etiket zorunludur.' };
    }

    const db = getDb();
    const devRow = db.prepare(`
      SELECT c.id, c.cihaz_kodu, c.durum, i.ad as istasyon_adi
      FROM cihazlar c
      JOIN istasyonlar i ON c.istasyon_id = i.id
      WHERE c.cihaz_kodu=?
    `).get(deviceCode) as any;

    if (!devRow) {
      return { basarili: false, mesaj: 'Cihaz bulunamadı.' };
    }

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE cihazlar
        SET tur_etiket=?, aciklama=?, sorumluluk=?, durum=?, guncellenme_tarihi=CURRENT_TIMESTAMP
        WHERE cihaz_kodu=?
      `).run(label, description, responsibility, status, deviceCode);

      db.prepare(`
        INSERT INTO cihaz_hareketleri (cihaz_turu, referans_id, cihaz_kodu, islem_turu, onceki_lokasyon, yeni_lokasyon, aciklama, yapan_kullanici)
        VALUES ('ISTASYON_CIHAZI', ?, ?, 'GUNCELLEME', ?, ?, ?, ?)
      `).run(devRow.id, deviceCode, devRow.istasyon_adi, devRow.istasyon_adi, `Durum: ${status}, Sorumluluk: ${responsibility}`, username);
    });

    transaction();
    FaultService.syncHardwareFaults();
    return { basarili: true, mesaj: `${deviceCode} başarıyla güncellendi.` };
  }

  public static deleteStationDevice(deviceCode: string, username = 'admin'): any {
    if (!deviceCode) {
      return { basarili: false, mesaj: 'Cihaz kodu belirtilmelidir.' };
    }

    const db = getDb();
    const devRow = db.prepare(`
      SELECT c.id, c.cihaz_kodu, c.tur_etiket, i.ad as istasyon_adi
      FROM cihazlar c
      JOIN istasyonlar i ON c.istasyon_id = i.id
      WHERE c.cihaz_kodu=?
    `).get(deviceCode) as any;

    if (!devRow) {
      return { basarili: false, mesaj: 'Cihaz bulunamadı.' };
    }

    const devId = devRow.id;
    const stName = devRow.istasyon_adi;
    const devLabel = devRow.tur_etiket;

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM cihazlar WHERE id=?').run(devId);

      db.prepare(`
        INSERT INTO cihaz_hareketleri (cihaz_turu, referans_id, cihaz_kodu, islem_turu, onceki_lokasyon, aciklama, yapan_kullanici)
        VALUES ('ISTASYON_CIHAZI', ?, ?, 'SILME', ?, ?, ?)
      `).run(devId, deviceCode, stName, `Cihaz sistemden silindi: ${devLabel}`, username);
    });

    transaction();
    return { basarili: true, mesaj: `${deviceCode} (${devLabel}) sistemden kaldırıldı.` };
  }

  public static relocateStationDevice(deviceCode: string, targetStationCode: string, username = 'admin'): any {
    if (!deviceCode || !targetStationCode) {
      return { basarili: false, mesaj: 'Taşınacak cihaz ve hedef istasyon kodu zorunludur.' };
    }

    const db = getDb();
    const devRow = db.prepare(`
      SELECT c.id, c.cihaz_kodu, c.cihaz_turu, c.cihaz_no, c.tur_etiket, i.ad as eski_istasyon
      FROM cihazlar c
      JOIN istasyonlar i ON c.istasyon_id = i.id
      WHERE c.cihaz_kodu=?
    `).get(deviceCode) as any;

    const targetSt = db.prepare('SELECT id, ad FROM istasyonlar WHERE istasyon_kodu=?').get(targetStationCode) as any;

    if (!devRow || !targetSt) {
      return { basarili: false, mesaj: 'Cihaz veya hedef istasyon bulunamadı.' };
    }

    const devId = devRow.id;
    const oldStationName = devRow.eski_istasyon;
    const newStationId = targetSt.id;
    const newStationName = targetSt.ad;

    const typeShort = getDeviceShortCode(devRow.cihaz_turu);
    const newDeviceCode = `${targetStationCode}_${typeShort}_${devRow.cihaz_no}`;

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE cihazlar
        SET istasyon_id=?, cihaz_kodu=?, guncellenme_tarihi=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(newStationId, newDeviceCode, devId);

      db.prepare(`
        INSERT INTO cihaz_hareketleri (cihaz_turu, referans_id, cihaz_kodu, islem_turu, onceki_lokasyon, yeni_lokasyon, aciklama, yapan_kullanici)
        VALUES ('ISTASYON_CIHAZI', ?, ?, 'YER_DEGISTIRME', ?, ?, ?, ?)
      `).run(devId, newDeviceCode, oldStationName, newStationName, `Cihaz ${oldStationName} durağından ${newStationName} durağına taşındı.`, username);
    });

    transaction();
    return {
      basarili: true,
      mesaj: `Cihaz ${oldStationName} -> ${newStationName} olarak taşındı.`,
      yeni_kod: newDeviceCode
    };
  }

  // =========================================================================
  // OTOMATİK KİOSKLAR
  // =========================================================================

  public static addKiosk(
    kioskName: string,
    lat: number,
    lon: number,
    address = '',
    responsibility: string = Responsibility.DAHILI,
    status: string = DeviceStatus.NORMAL,
    username = 'admin'
  ): any {
    if (!kioskName || lat == null || lon == null) {
      return { basarili: false, mesaj: 'Kiosk adı ve geçerli GPS koordinatları zorunludur.' };
    }

    const latF = parseFloat(lat as any);
    const lonF = parseFloat(lon as any);
    if (isNaN(latF) || isNaN(lonF)) {
      return { basarili: false, mesaj: 'Geçersiz GPS koordinat formatı.' };
    }

    const db = getDb();
    const maxRow = db.prepare('SELECT MAX(id) as max_id FROM otomatik_kiosklar').get() as any;
    const nextNum = (maxRow?.max_id || 0) + 1;
    const kioskCode = `kiosk_${nextNum}`;

    const transaction = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO otomatik_kiosklar (kiosk_kodu, ad, tip, enlem, boylam, adres, sorumluluk, durum)
        VALUES (?, ?, 'OTOMATIK_KIOSK', ?, ?, ?, ?, ?)
      `).run(kioskCode, kioskName, latF, lonF, address, responsibility, status);

      const kioskId = info.lastInsertRowid;

      db.prepare(`
        INSERT INTO cihaz_hareketleri (cihaz_turu, referans_id, cihaz_kodu, islem_turu, yeni_lokasyon, aciklama, yapan_kullanici)
        VALUES ('HARICI_KIOSK', ?, ?, 'EKLEME', ?, ?, ?)
      `).run(kioskId, kioskCode, kioskName, `Yeni otomatik kiosk tanımlandı: ${kioskName}`, username);
    });

    transaction();
    return { basarili: true, mesaj: `${kioskName} başarıyla eklendi.`, kiosk_kodu: kioskCode };
  }

  public static updateKiosk(
    kioskCode: string,
    kioskName: string,
    lat: number,
    lon: number,
    address = '',
    responsibility: string = Responsibility.DAHILI,
    status: string = DeviceStatus.NORMAL,
    username = 'admin'
  ): any {
    if (!kioskCode || !kioskName || lat == null || lon == null) {
      return { basarili: false, mesaj: 'Kiosk kodu, adı ve koordinatlar zorunludur.' };
    }

    const latF = parseFloat(lat as any);
    const lonF = parseFloat(lon as any);
    if (isNaN(latF) || isNaN(lonF)) {
      return { basarili: false, mesaj: 'Geçersiz GPS koordinat formatı.' };
    }

    const db = getDb();
    const kRow = db.prepare('SELECT id, kiosk_kodu, ad, enlem, boylam, adres FROM otomatik_kiosklar WHERE kiosk_kodu=? OR id=?').get(kioskCode, kioskCode) as any;
    if (!kRow) {
      return { basarili: false, mesaj: 'Kiosk bulunamadı.' };
    }

    const actualCode = kRow.kiosk_kodu || kioskCode;
    const oldLoc = `${kRow.ad} (${kRow.enlem}, ${kRow.boylam})`;
    const newLoc = `${kioskName} (${latF}, ${lonF})`;

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE otomatik_kiosklar
        SET ad=?, enlem=?, boylam=?, adres=?, sorumluluk=?, durum=?, guncellenme_tarihi=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(kioskName, latF, lonF, address, responsibility, status, kRow.id);

      db.prepare(`
        INSERT INTO cihaz_hareketleri (cihaz_turu, referans_id, cihaz_kodu, islem_turu, onceki_lokasyon, yeni_lokasyon, aciklama, yapan_kullanici)
        VALUES ('HARICI_KIOSK', ?, ?, 'GUNCELLEME', ?, ?, ?, ?)
      `).run(kRow.id, actualCode, oldLoc, newLoc, `Kiosk güncellendi/taşındı. Durum: ${status}`, username);
    });

    transaction();
    FaultService.syncHardwareFaults();
    return { basarili: true, mesaj: `${kioskName} bilgileri ve konumu güncellendi.` };
  }

  public static deleteKiosk(kioskCode: string, username = 'admin'): any {
    if (!kioskCode) {
      return { basarili: false, mesaj: 'Kiosk kodu belirtilmelidir.' };
    }

    const db = getDb();
    const kRow = db.prepare('SELECT id, kiosk_kodu, ad, adres FROM otomatik_kiosklar WHERE kiosk_kodu=? OR id=?').get(kioskCode, kioskCode) as any;
    if (!kRow) {
      return { basarili: false, mesaj: 'Kiosk bulunamadı.' };
    }

    const kId = kRow.id;
    const kName = kRow.ad;
    const actualCode = kRow.kiosk_kodu || kioskCode;

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM otomatik_kiosklar WHERE id=?').run(kId);

      db.prepare(`
        INSERT INTO cihaz_hareketleri (cihaz_turu, referans_id, cihaz_kodu, islem_turu, onceki_lokasyon, aciklama, yapan_kullanici)
        VALUES ('HARICI_KIOSK', ?, ?, 'SILME', ?, ?, ?)
      `).run(kId, actualCode, kName, `Kiosk cihazı sistemden tamamen kaldırıldı: ${kName}`, username);
    });

    transaction();
    return { basarili: true, mesaj: `${kName} (${actualCode}) sistemden silindi.` };
  }

  public static swapKiosks(kioskCode1: string, kioskCode2: string, username = 'admin'): any {
    if (!kioskCode1 || !kioskCode2) {
      return { basarili: false, mesaj: 'Takas edilecek her iki kiosk kodu da belirtilmelidir.' };
    }
    if (kioskCode1 === kioskCode2) {
      return { basarili: false, mesaj: 'İki farklı kiosk seçilmelidir.' };
    }

    const db = getDb();
    const k1 = db.prepare('SELECT id, kiosk_kodu, ad, enlem, boylam, adres FROM otomatik_kiosklar WHERE kiosk_kodu=? OR id=?').get(kioskCode1, kioskCode1) as any;
    const k2 = db.prepare('SELECT id, kiosk_kodu, ad, enlem, boylam, adres FROM otomatik_kiosklar WHERE kiosk_kodu=? OR id=?').get(kioskCode2, kioskCode2) as any;

    if (!k1 || !k2) {
      return { basarili: false, mesaj: 'Seçilen kiosklardan biri veya ikisi bulunamadı.' };
    }

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE otomatik_kiosklar SET enlem=?, boylam=?, adres=?, guncellenme_tarihi=CURRENT_TIMESTAMP WHERE id=?
      `).run(k2.enlem, k2.boylam, k2.adres, k1.id);

      db.prepare(`
        UPDATE otomatik_kiosklar SET enlem=?, boylam=?, adres=?, guncellenme_tarihi=CURRENT_TIMESTAMP WHERE id=?
      `).run(k1.enlem, k1.boylam, k1.adres, k2.id);

      db.prepare(`
        INSERT INTO cihaz_hareketleri (cihaz_turu, referans_id, cihaz_kodu, islem_turu, onceki_lokasyon, yeni_lokasyon, aciklama, yapan_kullanici)
        VALUES ('HARICI_KIOSK', ?, ?, 'TAKAS', ?, ?, ?, ?)
      `).run(k1.id, `${kioskCode1} <-> ${kioskCode2}`, k1.ad, k2.ad, `${k1.ad} ile ${k2.ad} kioskları yer değiştirdi.`, username);
    });

    transaction();
    return { basarili: true, mesaj: `${k1.ad} ve ${k2.ad} konumları başarıyla takas edildi.` };
  }

  // =========================================================================
  // PASİF CİHAZ VE İSTASYON YÖNETİMİ
  // =========================================================================

  public static getDisabledItems(): any {
    const db = getDb();
    const disabledStations = db.prepare(`
      SELECT i.id, i.istasyon_kodu as kod, i.ad, i.tip, i.enlem, i.boylam, 'ISTASYON' as tur,
             (SELECT GROUP_CONCAT(DISTINCT h.kod) FROM hat_istasyon_baglantisi hib JOIN hatlar h ON hib.hat_id = h.id WHERE hib.istasyon_id = i.id) as hat_bilgisi
      FROM istasyonlar i
      WHERE i.aktif = 0
    `).all() as any[];

    const disabledKiosks = db.prepare(`
      SELECT id, kiosk_kodu as kod, ad, adres, enlem, boylam, 'KIOSK' as tur,
             durum, sorumluluk
      FROM otomatik_kiosklar
      WHERE durum = 'PASIF' OR durum = 'DEVRE_DISI'
    `).all() as any[];

    return {
      basarili: true,
      pasif_istasyonlar: disabledStations,
      pasif_kiosk_lar: disabledKiosks,
      toplam_pasif_sayisi: disabledStations.length + disabledKiosks.length
    };
  }

  public static toggleStationStatus(stationId: number | string, activeStatus: boolean, username = 'admin'): any {
    const db = getDb();
    const st = db.prepare('SELECT id, ad, istasyon_kodu FROM istasyonlar WHERE id = ? OR istasyon_kodu = ?').get(stationId, stationId) as any;
    if (!st) {
      return { basarili: false, mesaj: 'İstasyon bulunamadı.' };
    }

    const val = activeStatus ? 1 : 0;
    db.prepare('UPDATE istasyonlar SET aktif = ? WHERE id = ?').run(val, st.id);

    db.prepare(`
      INSERT INTO cihaz_hareketleri (cihaz_turu, referans_id, cihaz_kodu, islem_turu, yeni_lokasyon, aciklama, yapan_kullanici)
      VALUES ('ISTASYON_CIHAZI', ?, ?, ?, ?, ?, ?)
    `).run(st.id, st.istasyon_kodu, activeStatus ? 'AKTIFLESME' : 'PASIFLESTE', st.ad, `İstasyon ${activeStatus ? 'aktifleştirildi' : 'pasifleştirildi'}`, username);

    return {
      basarili: true,
      mesaj: `${st.ad} istasyonu ${activeStatus ? 'başarıyla aktifleştirildi' : 'pasife çekildi'}.`,
      istasyon_id: st.id,
      yeni_durum: val
    };
  }

  public static toggleKioskStatus(kioskId: number | string, activeStatus: boolean, username = 'admin'): any {
    const db = getDb();
    const k = db.prepare('SELECT id, ad, kiosk_kodu FROM otomatik_kiosklar WHERE id = ? OR kiosk_kodu = ?').get(kioskId, kioskId) as any;
    if (!k) {
      return { basarili: false, mesaj: 'Kiosk bulunamadı.' };
    }

    const durumVal = activeStatus ? 'NORMAL' : 'PASIF';
    db.prepare('UPDATE otomatik_kiosklar SET durum = ? WHERE id = ?').run(durumVal, k.id);

    db.prepare(`
      INSERT INTO cihaz_hareketleri (cihaz_turu, referans_id, cihaz_kodu, islem_turu, yeni_lokasyon, aciklama, yapan_kullanici)
      VALUES ('HARICI_KIOSK', ?, ?, ?, ?, ?, ?)
    `).run(k.id, k.kiosk_kodu, activeStatus ? 'AKTIFLESME' : 'PASIFLESTE', k.ad, `Kiosk ${activeStatus ? 'aktifleştirildi' : 'pasifleştirildi'}`, username);

    return {
      basarili: true,
      mesaj: `${k.ad} kiosku ${activeStatus ? 'başarıyla aktifleştirildi' : 'pasife çekildi'}.`,
      kiosk_id: k.id,
      yeni_durum: durumVal
    };
  }
}
