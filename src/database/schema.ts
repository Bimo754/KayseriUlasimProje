import fs from 'fs';
import bcrypt from 'bcryptjs';
import { getDb } from './db';
import { Config } from '../config';
import { Role, Responsibility, DeviceStatus } from '../constants';
import { FaultService } from '../services/fault.service';

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function initDatabase(dbPath?: string): void {
  const db = getDb(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS kullanicilar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kullanici_adi TEXT UNIQUE NOT NULL,
        sifre_hash TEXT NOT NULL,
        ad_soyad TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT '${Role.OPERATOR}',
        aktif INTEGER NOT NULL DEFAULT 1,
        olusturulma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ana_us (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kod TEXT UNIQUE NOT NULL,
        ad TEXT NOT NULL,
        kisa_ad TEXT NOT NULL,
        tip TEXT NOT NULL DEFAULT 'MERKEZ_US',
        enlem REAL NOT NULL,
        boylam REAL NOT NULL,
        adres TEXT,
        aciklama TEXT,
        olusturulma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hatlar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kod TEXT UNIQUE NOT NULL,
        ad TEXT NOT NULL,
        renk TEXT NOT NULL,
        baslangic_istasyon TEXT NOT NULL,
        bitis_istasyon TEXT NOT NULL,
        istasyon_sayisi INTEGER DEFAULT 0,
        olusturulma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS istasyonlar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        istasyon_kodu TEXT UNIQUE NOT NULL,
        ad TEXT NOT NULL,
        tip TEXT NOT NULL DEFAULT 'TRAMVAY_ISTASYONU',
        enlem REAL NOT NULL,
        boylam REAL NOT NULL,
        aktif INTEGER NOT NULL DEFAULT 1,
        toplam_turnike INTEGER DEFAULT 4,
        toplam_iade INTEGER DEFAULT 2,
        toplam_kiosk INTEGER DEFAULT 1,
        toplam_serbest_kapi INTEGER DEFAULT 1,
        olusturulma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hat_istasyon_baglantisi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hat_id INTEGER NOT NULL,
        istasyon_id INTEGER NOT NULL,
        sira_no INTEGER NOT NULL,
        FOREIGN KEY (hat_id) REFERENCES hatlar(id) ON DELETE CASCADE,
        FOREIGN KEY (istasyon_id) REFERENCES istasyonlar(id) ON DELETE CASCADE,
        UNIQUE (hat_id, istasyon_id)
    );

    CREATE TABLE IF NOT EXISTS cihazlar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cihaz_kodu TEXT UNIQUE NOT NULL,
        istasyon_id INTEGER NOT NULL,
        cihaz_turu TEXT NOT NULL,
        cihaz_no INTEGER NOT NULL,
        tur_etiket TEXT NOT NULL,
        aciklama TEXT,
        sorumluluk TEXT NOT NULL DEFAULT '${Responsibility.DAHILI}',
        durum TEXT NOT NULL DEFAULT '${DeviceStatus.NORMAL}',
        olusturulma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
        guncellenme_tarihi DATETIME,
        FOREIGN KEY (istasyon_id) REFERENCES istasyonlar(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS otomatik_kiosklar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kiosk_kodu TEXT UNIQUE NOT NULL,
        ad TEXT NOT NULL,
        tip TEXT NOT NULL DEFAULT 'OTOMATIK_KIOSK',
        enlem REAL NOT NULL,
        boylam REAL NOT NULL,
        adres TEXT,
        istasyon_ici_mi INTEGER NOT NULL DEFAULT 0,
        sorumluluk TEXT NOT NULL DEFAULT '${Responsibility.DAHILI}',
        durum TEXT NOT NULL DEFAULT '${DeviceStatus.NORMAL}',
        olusturulma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
        guncellenme_tarihi DATETIME
    );

    CREATE TABLE IF NOT EXISTS yetkili_bayiler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bayi_kodu TEXT UNIQUE NOT NULL,
        ad TEXT NOT NULL,
        tip TEXT NOT NULL DEFAULT 'YETKILI_BAYI',
        enlem REAL NOT NULL,
        boylam REAL NOT NULL,
        adres TEXT,
        durum TEXT NOT NULL DEFAULT 'AKTIF',
        olusturulma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cihaz_hareketleri (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cihaz_turu TEXT NOT NULL,
        referans_id INTEGER NOT NULL,
        cihaz_kodu TEXT NOT NULL,
        islem_turu TEXT NOT NULL,
        onceki_lokasyon TEXT,
        yeni_lokasyon TEXT,
        aciklama TEXT,
        yapan_kullanici TEXT DEFAULT 'admin',
        islem_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS arizalar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cihaz_id INTEGER,
        kiosk_id INTEGER,
        lokasyon_adi TEXT NOT NULL,
        ariza_metni TEXT NOT NULL,
        ariza_tipi TEXT NOT NULL,
        oncelik_puani INTEGER NOT NULL DEFAULT 50,
        sorumluluk TEXT NOT NULL DEFAULT '${Responsibility.DAHILI}',
        durum TEXT NOT NULL DEFAULT 'BEKLIYOR',
        bildirim_zamani DATETIME DEFAULT CURRENT_TIMESTAMP,
        cozum_zamani DATETIME,
        FOREIGN KEY (cihaz_id) REFERENCES cihazlar(id) ON DELETE SET NULL,
        FOREIGN KEY (kiosk_id) REFERENCES otomatik_kiosklar(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS raporlar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rapor_basligi TEXT NOT NULL,
        olusturan_kullanici TEXT NOT NULL,
        tarih_araligi TEXT NOT NULL DEFAULT 'TUMU',
        kapsam TEXT NOT NULL DEFAULT 'TUM_SISTEM',
        dosya_adi TEXT NOT NULL,
        dosya_boyutu INTEGER NOT NULL,
        pdf_veri BLOB,
        excel_veri BLOB,
        rapor_formati TEXT NOT NULL DEFAULT 'PDF',
        ozet_json TEXT NOT NULL,
        olusturulma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS arac_telemetri (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        imei TEXT UNIQUE NOT NULL,
        plaka TEXT NOT NULL,
        ad TEXT NOT NULL,
        son_enlem REAL NOT NULL,
        son_boylam REAL NOT NULL,
        son_hiz REAL DEFAULT 0,
        son_canli_gps DATETIME,
        aktif INTEGER DEFAULT 0,
        guncellenme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sistem_ayarlari (
        anahtar TEXT PRIMARY KEY,
        deger TEXT,
        guncellenme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_kullanicilar_kadi ON kullanicilar(kullanici_adi);
    CREATE INDEX IF NOT EXISTS idx_istasyonlar_kod ON istasyonlar(istasyon_kodu);
    CREATE INDEX IF NOT EXISTS idx_cihazlar_istasyon ON cihazlar(istasyon_id);
    CREATE INDEX IF NOT EXISTS idx_cihazlar_tur ON cihazlar(cihaz_turu);
    CREATE INDEX IF NOT EXISTS idx_cihazlar_durum ON cihazlar(durum);
    CREATE INDEX IF NOT EXISTS idx_kiosklar_kod ON otomatik_kiosklar(kiosk_kodu);
    CREATE INDEX IF NOT EXISTS idx_kiosklar_durum ON otomatik_kiosklar(durum);
    CREATE INDEX IF NOT EXISTS idx_bayiler_kod ON yetkili_bayiler(bayi_kodu);
    CREATE INDEX IF NOT EXISTS idx_hareketler_cihaz ON cihaz_hareketleri(cihaz_kodu);
    CREATE INDEX IF NOT EXISTS idx_arizalar_durum ON arizalar(durum);
    CREATE INDEX IF NOT EXISTS idx_arizalar_oncelik ON arizalar(oncelik_puani);
    CREATE INDEX IF NOT EXISTS idx_raporlar_tarih ON raporlar(olusturulma_tarihi);
    CREATE INDEX IF NOT EXISTS idx_arac_telemetri_imei ON arac_telemetri(imei);
  `);

  // Migrate existing raporlar table if needed
  try {
    const tableInfo = db.prepare("PRAGMA table_info(raporlar)").all() as any[];
    const hasExcel = tableInfo.some(c => c.name === 'excel_veri');
    if (!hasExcel) {
      db.exec("ALTER TABLE raporlar ADD COLUMN excel_veri BLOB;");
    }
    const hasFormat = tableInfo.some(c => c.name === 'rapor_formati');
    if (!hasFormat) {
      db.exec("ALTER TABLE raporlar ADD COLUMN rapor_formati TEXT DEFAULT 'PDF';");
    }
  } catch (_e) {
    // Ignore migration error
  }

  // Default Users
  const adminHash = hashPassword('admin123');
  const sahaHash = hashPassword('saha123');

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO kullanicilar (id, kullanici_adi, sifre_hash, ad_soyad, rol, aktif)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  insertUser.run(1, 'admin', adminHash, 'Sistem Yöneticisi', Role.ADMIN);
  insertUser.run(2, 'saha', sahaHash, 'Saha Bakım Personeli', Role.OPERATOR);

  // Default Vehicle Telemetry Entries (38 BKM 001 and 38 BKM 002)
  const insertArac = db.prepare(`
    INSERT OR IGNORE INTO arac_telemetri (imei, plaka, ad, son_enlem, son_boylam, son_hiz, son_canli_gps)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  insertArac.run('861000000000001', '38 BKM 001', '38 BKM 001 - AUS Arıza ve Bakım Hizmet Aracı', 38.7219412, 35.4872933, 0);
  insertArac.run('861000000000002', '38 BKM 002', '38 BKM 002 - AUS Arıza ve Bakım Hizmet Aracı', 38.7315, 35.4982, 0);
}

export function populateDatabaseFromJson(dbPath?: string): void {
  const jsonPath = Config.JSON_DATA_PATH;
  if (!fs.existsSync(jsonPath)) {
    return;
  }

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(rawData);

  const db = getDb(dbPath);

  const transaction = db.transaction(() => {
    // 1. Ana Us
    const anaUs = data.ana_us || {};
    if (anaUs.ad) {
      db.prepare(`
        INSERT OR REPLACE INTO ana_us (id, kod, ad, kisa_ad, tip, enlem, boylam, adres, aciklama)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        anaUs.id || 'ana_us_merkez',
        anaUs.ad || 'Kayseri Ulaşım Ana Üs',
        anaUs.kisa_ad || 'Ana Üs (Merkez)',
        anaUs.tip || 'MERKEZ_US',
        anaUs.enlem || Config.ANA_US_LAT,
        anaUs.boylam || Config.ANA_US_LON,
        anaUs.adres || '',
        anaUs.aciklama || ''
      );
    }

    // 2. Hatlar
    const hatIdMap: Record<string, number> = {};
    const insertHat = db.prepare(`
      INSERT OR REPLACE INTO hatlar (kod, ad, renk, baslangic_istasyon, bitis_istasyon, istasyon_sayisi)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const [hatKod, hatInfo] of Object.entries<any>(data.hatlar || {})) {
      insertHat.run(
        hatInfo.kod || hatKod,
        hatInfo.ad || '',
        hatInfo.renk || '#2563eb',
        hatInfo.baslangic || '',
        hatInfo.bitis || '',
        hatInfo.istasyon_sayisi || 0
      );
      const row = db.prepare('SELECT id FROM hatlar WHERE kod=?').get(hatKod) as { id: number };
      if (row) {
        hatIdMap[hatKod] = row.id;
      }
    }

    // 3. İstasyonlar & Cihazlar
    const istasyonIdMap: Record<string, number> = {};
    const insertIstasyon = db.prepare(`
      INSERT OR REPLACE INTO istasyonlar (istasyon_kodu, ad, tip, enlem, boylam, aktif, toplam_turnike, toplam_iade, toplam_kiosk, toplam_serbest_kapi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertCihaz = db.prepare(`
      INSERT OR REPLACE INTO cihazlar (cihaz_kodu, istasyon_id, cihaz_turu, cihaz_no, tur_etiket, aciklama, sorumluluk, durum)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const [stKod, stInfo] of Object.entries<any>(data.istasyonlar || {})) {
      insertIstasyon.run(
        stKod,
        stInfo.ad || '',
        stInfo.tip || 'TRAMVAY_ISTASYONU',
        stInfo.enlem || 0.0,
        stInfo.boylam || 0.0,
        stInfo.aktif !== false ? 1 : 0,
        stInfo.toplam_turnike || 4,
        stInfo.toplam_iade || 2,
        stInfo.toplam_kiosk || 1,
        stInfo.toplam_serbest_kapi || 1
      );

      const stRow = db.prepare('SELECT id FROM istasyonlar WHERE istasyon_kodu=?').get(stKod) as { id: number };
      const dbStId = stRow.id;
      istasyonIdMap[stKod] = dbStId;

      for (const dev of stInfo.cihazlar || []) {
        insertCihaz.run(
          dev.cihaz_id,
          dbStId,
          dev.tur,
          dev.cihaz_no || 1,
          dev.tur_etiket || '',
          dev.aciklama || '',
          dev.sorumluluk || Responsibility.DAHILI,
          dev.durum || DeviceStatus.NORMAL
        );
      }
    }

    // 4. Hat-İstasyon Bağlantıları
    db.prepare('DELETE FROM hat_istasyon_baglantisi').run();
    const insertBaglanti = db.prepare(`
      INSERT OR IGNORE INTO hat_istasyon_baglantisi (hat_id, istasyon_id, sira_no)
      VALUES (?, ?, ?)
    `);

    for (const [hatKod, hatInfo] of Object.entries<any>(data.hatlar || {})) {
      const dbHatId = hatIdMap[hatKod];
      if (!dbHatId) continue;
      let idx = 1;
      for (const stItem of hatInfo.istasyonlar || []) {
        const dbStId = istasyonIdMap[stItem.id];
        if (dbStId) {
          insertBaglanti.run(dbHatId, dbStId, idx++);
        }
      }
    }

    // 5. Otomatik Kiosklar
    const insertKiosk = db.prepare(`
      INSERT OR REPLACE INTO otomatik_kiosklar (kiosk_kodu, ad, tip, enlem, boylam, adres, sorumluluk, durum)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const k of data.kiosklar || []) {
      insertKiosk.run(
        k.id,
        k.ad || '',
        k.tip || 'OTOMATIK_KIOSK',
        k.enlem || 0.0,
        k.boylam || 0.0,
        k.adres || '',
        k.sorumluluk || Responsibility.DAHILI,
        k.durum || DeviceStatus.NORMAL
      );
    }

    // 6. Yetkili Bayiler
    const insertBayi = db.prepare(`
      INSERT OR REPLACE INTO yetkili_bayiler (bayi_kodu, ad, tip, enlem, boylam, adres, durum)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const b of data.bayiler || []) {
      insertBayi.run(
        b.id,
        b.ad || '',
        b.tip || 'YETKILI_BAYI',
        b.enlem || 0.0,
        b.boylam || 0.0,
        b.adres || '',
        b.durum || 'AKTIF'
      );
    }
  });

  transaction();
  FaultService.syncHardwareFaults();
}

export function getSavedSessionCookie(dbPath?: string): string | null {
  const db = getDb(dbPath);
  try {
    const row = db.prepare("SELECT deger FROM sistem_ayarlari WHERE anahtar = 'oturum_anahtari'").get() as any;
    return row && row.deger ? row.deger : null;
  } catch (_e) {
    return null;
  }
}

export function saveSessionCookieToDb(cookie: string | null, dbPath?: string): void {
  const db = getDb(dbPath);
  try {
    db.prepare(`
      INSERT INTO sistem_ayarlari (anahtar, deger, guncellenme_tarihi)
      VALUES ('oturum_anahtari', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger, guncellenme_tarihi = CURRENT_TIMESTAMP
    `).run(cookie || '');
  } catch (_e) {}
}

export function getSavedVehicleTelemetry(dbPath?: string): any[] {
  const db = getDb(dbPath);
  try {
    return db.prepare("SELECT * FROM arac_telemetri ORDER BY id ASC").all();
  } catch (_e) {
    return [];
  }
}

export function saveVehicleTelemetryToDb(
  imei: string,
  plaka: string,
  ad: string,
  enlem: number,
  boylam: number,
  hiz: number,
  canliGpsTime: string | null,
  dbPath?: string
): void {
  const db = getDb(dbPath);
  try {
    db.prepare(`
      INSERT INTO arac_telemetri (imei, plaka, ad, son_enlem, son_boylam, son_hiz, son_canli_gps, guncellenme_tarihi)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(imei) DO UPDATE SET
        plaka = excluded.plaka,
        ad = excluded.ad,
        son_enlem = excluded.son_enlem,
        son_boylam = excluded.son_boylam,
        son_hiz = excluded.son_hiz,
        son_canli_gps = excluded.son_canli_gps,
        guncellenme_tarihi = CURRENT_TIMESTAMP
    `).run(imei, plaka, ad, enlem, boylam, hiz, canliGpsTime || new Date().toISOString());
  } catch (_e) {}
}
