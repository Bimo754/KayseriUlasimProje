import { getDb } from '../database/db';

export class InventoryService {
  public static getAllSystemData(): any {
    const db = getDb();

    // 1. Ana Us
    const anaUsRow = db.prepare('SELECT * FROM ana_us WHERE id=1').get() as any;
    const anaUs = anaUsRow || {};

    // 2. Hatlar & Hat Istasyonlari
    const hatlar: Record<string, any> = {};
    const hatRows = db.prepare(`
      SELECT 
          h.id as hat_id, h.kod as hat_kod, h.ad as hat_ad, h.renk, 
          h.baslangic_istasyon, h.bitis_istasyon, h.istasyon_sayisi,
          i.istasyon_kodu as st_kod, i.ad as st_ad, i.enlem as st_enlem, i.boylam as st_boylam,
          hib.sira_no
      FROM hatlar h
      LEFT JOIN hat_istasyon_baglantisi hib ON h.id = hib.hat_id
      LEFT JOIN istasyonlar i ON i.id = hib.istasyon_id
      ORDER BY h.id, hib.sira_no
    `).all() as any[];

    for (const r of hatRows) {
      const hKod = r.hat_kod;
      if (!hatlar[hKod]) {
        hatlar[hKod] = {
          kod: hKod,
          ad: r.hat_ad,
          renk: r.renk,
          baslangic: r.baslangic_istasyon,
          bitis: r.bitis_istasyon,
          istasyon_sayisi: 0,
          istasyonlar: []
        };
      }
      if (r.st_kod) {
        hatlar[hKod].istasyonlar.push({
          id: r.st_kod,
          ad: r.st_ad,
          enlem: r.st_enlem,
          boylam: r.st_boylam,
          sira_no: r.sira_no
        });
        hatlar[hKod].istasyon_sayisi = hatlar[hKod].istasyonlar.length;
      }
    }

    // 3. Istasyon Cihazlari
    const devicesByStationId: Record<number, any[]> = {};
    const devRows = db.prepare(`
      SELECT 
          id as db_id, istasyon_id, cihaz_kodu as cihaz_id, cihaz_no, 
          cihaz_turu as tur, tur_etiket, aciklama, sorumluluk, durum
      FROM cihazlar
      ORDER BY id
    `).all() as any[];

    for (const d of devRows) {
      if (!devicesByStationId[d.istasyon_id]) {
        devicesByStationId[d.istasyon_id] = [];
      }
      devicesByStationId[d.istasyon_id].push(d);
    }

    // 4. Istasyon Hat Baglantilari
    const linesByStationId: Record<number, string[]> = {};
    const lineConnRows = db.prepare(`
      SELECT hib.istasyon_id, h.kod as hat_kodu
      FROM hat_istasyon_baglantisi hib
      JOIN hatlar h ON h.id = hib.hat_id
      ORDER BY h.id
    `).all() as any[];

    for (const lc of lineConnRows) {
      if (!linesByStationId[lc.istasyon_id]) {
        linesByStationId[lc.istasyon_id] = [];
      }
      linesByStationId[lc.istasyon_id].push(lc.hat_kodu);
    }

    // 5. Istasyonlar
    const istasyonlar: Record<string, any> = {};
    const istRows = db.prepare('SELECT * FROM istasyonlar ORDER BY ad').all() as any[];

    for (const st of istRows) {
      const stId = st.id;
      const stKod = st.istasyon_kodu;
      const gecenHatlar = linesByStationId[stId] || [];
      const stCihazlar = devicesByStationId[stId] || [];

      istasyonlar[stKod] = {
        db_id: stId,
        id: stKod,
        ad: st.ad,
        tip: st.tip,
        enlem: st.enlem,
        boylam: st.boylam,
        hatlar: gecenHatlar,
        aktif: Boolean(st.aktif),
        cihazlar: stCihazlar,
        toplam_turnike: st.toplam_turnike,
        toplam_iade: st.toplam_iade,
        toplam_kiosk: st.toplam_kiosk,
        toplam_serbest_kapi: st.toplam_serbest_kapi
      };
    }

    // 6. Otomatik Kiosklar
    const kioskRows = db.prepare(`
      SELECT id as db_id, kiosk_kodu as id, ad, tip, enlem, boylam, adres, sorumluluk, durum 
      FROM otomatik_kiosklar ORDER BY ad
    `).all() as any[];

    // 7. Yetkili Bayiler
    const bayiRows = db.prepare(`
      SELECT id as db_id, bayi_kodu as id, ad, tip, enlem, boylam, adres, durum 
      FROM yetkili_bayiler ORDER BY ad
    `).all() as any[];

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return {
      sistem: {
        ad: 'Kayseri Ulaşım Raylı Sistem ve Saha Cihaz Yönetimi',
        versiyon: '3.0.0 (TypeScript Performance Architecture)',
        veritabani: 'SQLite (kayseri_ulasim.db)',
        guncelleme_tarihi: formattedDate,
        sehir: 'Kayseri, Türkiye'
      },
      ana_us: anaUs,
      istatistikler: {
        toplam_hat_sayisi: Object.keys(hatlar).length,
        toplam_istasyon_sayisi: Object.keys(istasyonlar).length,
        toplam_otomatik_kiosk_sayisi: kioskRows.length,
        toplam_yetkili_bayi_sayisi: bayiRows.length,
        toplam_kart_dolum_noktasi: kioskRows.length + bayiRows.length,
        toplam_turnike_sayisi: Object.keys(istasyonlar).length * 4,
        toplam_iade_validatoru_sayisi: Object.keys(istasyonlar).length * 2,
        toplam_istasyon_kiosku_sayisi: Object.keys(istasyonlar).length,
        toplam_cihaz_sayisi: Object.keys(istasyonlar).length * 8 + kioskRows.length
      },
      hatlar,
      istasyonlar,
      kiosklar: kioskRows,
      bayiler: bayiRows
    };
  }

  public static getAnaUs(): any {
    const db = getDb();
    const row = db.prepare('SELECT * FROM ana_us WHERE id=1').get() as any;
    return row || {};
  }
}
