import { getDb } from '../../database/db';

export interface ReportDataPayload {
  title: string;
  dateRange: string;
  scope: string;
  format: string;
  username: string;
  summary: any;
  allFaults: any[];
  resolvedFaults: any[];
  pendingFaults: any[];
  kioskFaults: any[];
  kioskAnalyticsList: any[];
  movements: any[];
  recurrentLocations: any[];
  monthlyDistribution: any[];
}

export class ReportAnalyticsService {
  /**
   * Generates dynamic SQL query filtering clauses and collects system metrics/analytics.
   */
  public static collectAnalytics(params: {
    rapor_basligi?: string;
    tarih_araligi?: string;
    kapsam?: string;
    rapor_formati?: string;
    olusturan_kullanici: string;
  }): ReportDataPayload {
    const db = getDb();
    const title = params.rapor_basligi?.trim() || 'Kayseri Ulaşım Saha Operasyon Raporu';
    const dateRange = params.tarih_araligi || 'TUMU';
    const scope = params.kapsam || 'TUM_SISTEM';
    const format = params.rapor_formati || 'HEPSI';
    const username = params.olusturan_kullanici || 'admin';

    // 1. Date Filter SQL Clause
    let dateFilterClause = '';
    if (dateRange === 'BUGUN') {
      dateFilterClause = " AND DATE(a.bildirim_zamani) = DATE('now', 'localtime')";
    } else if (dateRange === 'SON_7_GUN') {
      dateFilterClause = " AND a.bildirim_zamani >= DATETIME('now', '-7 days', 'localtime')";
    } else if (dateRange === 'SON_30_GUN') {
      dateFilterClause = " AND a.bildirim_zamani >= DATETIME('now', '-30 days', 'localtime')";
    } else if (dateRange === 'BU_AY') {
      dateFilterClause = " AND STRFTIME('%Y-%m', a.bildirim_zamani) = STRFTIME('%Y-%m', 'now', 'localtime')";
    }

    // 2. Scope SQL Clause
    let scopeClause = '';
    if (scope === 'SADECE_KIOSKLAR') {
      scopeClause = ' AND a.kiosk_id IS NOT NULL';
    } else if (scope === 'SADECE_COZULENLER') {
      scopeClause = " AND a.durum = 'COZULDU'";
    } else if (scope === 'SADECE_BEKLEYENLER') {
      scopeClause = " AND a.durum = 'BEKLIYOR'";
    }

    // 3. Database Queries for Analytics

    // A. All matching faults (with calculated resolution duration in hours)
    const masterFaultsQuery = `
      SELECT 
        a.*, 
        c.cihaz_kodu, 
        k.kiosk_kodu,
        ROUND((JULIANDAY(COALESCE(a.cozum_zamani, 'now', 'localtime')) - JULIANDAY(a.bildirim_zamani)) * 24, 1) as cozum_suresi_saat
      FROM arizalar a
      LEFT JOIN cihazlar c ON a.cihaz_id = c.id
      LEFT JOIN otomatik_kiosklar k ON a.kiosk_id = k.id
      WHERE 1=1 ${dateFilterClause} ${scopeClause}
      ORDER BY a.id DESC
    `;
    const allFaults = db.prepare(masterFaultsQuery).all() as any[];

    // Subsets
    const pendingFaults = allFaults.filter(f => f.durum === 'BEKLIYOR');
    const resolvedFaults = allFaults.filter(f => f.durum === 'COZULDU');
    const kioskFaults = allFaults.filter(f => f.kiosk_id != null || (f.kiosk_kodu && f.kiosk_kodu.trim() !== ''));

    // B. Recurrent / Chronic Locations
    const recurrentQuery = `
      SELECT 
        a.lokasyon_adi, 
        a.ariza_tipi, 
        a.sorumluluk, 
        COUNT(*) as ariza_frekansi, 
        SUM(CASE WHEN a.durum = 'BEKLIYOR' THEN 1 ELSE 0 END) as bekleyen_sayisi,
        SUM(CASE WHEN a.durum = 'COZULDU' THEN 1 ELSE 0 END) as cozulen_sayisi,
        MAX(a.bildirim_zamani) as son_bildirim
      FROM arizalar a
      WHERE 1=1 ${dateFilterClause} ${scopeClause}
      GROUP BY a.lokasyon_adi
      ORDER BY ariza_frekansi DESC, son_bildirim DESC
      LIMIT 15
    `;
    const recurrentLocations = db.prepare(recurrentQuery).all() as any[];

    // C. Monthly Distribution
    const monthlyQuery = `
      SELECT 
        STRFTIME('%Y-%m', a.bildirim_zamani) as ay,
        a.ariza_tipi,
        a.sorumluluk,
        COUNT(*) as ariza_sayisi
      FROM arizalar a
      WHERE a.bildirim_zamani IS NOT NULL ${dateFilterClause} ${scopeClause}
      GROUP BY ay, a.ariza_tipi
      ORDER BY ay DESC, ariza_sayisi DESC
    `;
    const monthlyDistribution = db.prepare(monthlyQuery).all() as any[];

    // D. 105 Kiosks Master Inventory & Fault Analysis
    const kiosksMasterQuery = `
      SELECT 
        k.id,
        k.kiosk_kodu,
        k.ad as kiosk_adi,
        k.adres,
        k.durum,
        k.sorumluluk,
        COUNT(a.id) as toplam_ariza_sayisi,
        SUM(CASE WHEN a.sorumluluk = 'DAHILI' THEN 1 ELSE 0 END) as dahili_ariza_sayisi,
        SUM(CASE WHEN a.sorumluluk = 'TASERON' THEN 1 ELSE 0 END) as taseron_ariza_sayisi,
        MAX(a.bildirim_zamani) as son_ariza_tarihi
      FROM otomatik_kiosklar k
      LEFT JOIN arizalar a ON a.kiosk_id = k.id ${dateFilterClause}
      GROUP BY k.id
      ORDER BY toplam_ariza_sayisi DESC, k.id ASC
    `;
    const kioskAnalyticsList = db.prepare(kiosksMasterQuery).all() as any[];

    // E. Equipment Movements Log
    const movementsQuery = `
      SELECT * FROM cihaz_hareketleri
      ORDER BY islem_tarihi DESC, id DESC
      LIMIT 100
    `;
    const movements = db.prepare(movementsQuery).all() as any[];

    // F. KPI Metrics
    const totalCihazCount = (db.prepare('SELECT COUNT(*) as cnt FROM cihazlar').get() as any).cnt;
    const arizaliCihazCount = (db.prepare(`
      SELECT COUNT(DISTINCT c.id) as cnt 
      FROM cihazlar c 
      LEFT JOIN arizalar a ON a.cihaz_id = c.id AND a.durum = 'BEKLIYOR'
      WHERE c.durum = 'ARIZALI' OR a.id IS NOT NULL
    `).get() as any).cnt;

    const totalKioskCount = (db.prepare('SELECT COUNT(*) as cnt FROM otomatik_kiosklar').get() as any).cnt;
    const arizaliKioskCount = (db.prepare(`
      SELECT COUNT(DISTINCT k.id) as cnt 
      FROM otomatik_kiosklar k 
      LEFT JOIN arizalar a ON a.kiosk_id = k.id AND a.durum = 'BEKLIYOR'
      WHERE k.durum = 'ARIZALI' OR a.id IS NOT NULL
    `).get() as any).cnt;

    const totalEquipment = totalCihazCount + totalKioskCount;
    const faultyEquipment = arizaliCihazCount + arizaliKioskCount;
    const availabilityRate = totalEquipment > 0
      ? (((totalEquipment - faultyEquipment) / totalEquipment) * 100).toFixed(1)
      : '100.0';

    const priorityCountsRow = db.prepare(`
      SELECT 
        SUM(CASE WHEN a.oncelik_puani >= 90 THEN 1 ELSE 0 END) as en_acil,
        SUM(CASE WHEN a.oncelik_puani >= 70 AND a.oncelik_puani < 90 THEN 1 ELSE 0 END) as yuksek,
        SUM(CASE WHEN a.oncelik_puani >= 40 AND a.oncelik_puani < 70 THEN 1 ELSE 0 END) as orta,
        SUM(CASE WHEN a.oncelik_puani < 40 THEN 1 ELSE 0 END) as dusuk,
        SUM(CASE WHEN a.sorumluluk = 'DAHILI' THEN 1 ELSE 0 END) as dahili_sayi,
        SUM(CASE WHEN a.sorumluluk = 'TASERON' THEN 1 ELSE 0 END) as taseron_sayi
      FROM arizalar a
      WHERE 1=1 ${dateFilterClause} ${scopeClause}
    `).get() as any;

    const priorityMetrics = {
      en_acil: priorityCountsRow?.en_acil || 0,
      yuksek: priorityCountsRow?.yuksek || 0,
      orta: priorityCountsRow?.orta || 0,
      dusuk: priorityCountsRow?.dusuk || 0,
      dahili: priorityCountsRow?.dahili_sayi || 0,
      taseron: priorityCountsRow?.taseron_sayi || 0
    };

    const summaryMetrics = {
      toplam_kayit: allFaults.length,
      toplam_cozulen: resolvedFaults.length,
      toplam_bekleyen: pendingFaults.length,
      toplam_kiosk_arizasi: kioskFaults.length,
      toplam_cihaz: totalCihazCount,
      arizali_cihaz: arizaliCihazCount,
      toplam_kiosk: totalKioskCount,
      arizali_kiosk: arizaliKioskCount,
      donanim_erisilebilirlik_yuzdesi: availabilityRate,
      oncelik_dagilimi: priorityMetrics,
      kronik_noktalar: recurrentLocations,
      aylik_dagilim: monthlyDistribution,
      rapor_tarihi: new Date().toISOString()
    };

    return {
      title,
      dateRange,
      scope,
      format,
      username,
      summary: summaryMetrics,
      allFaults,
      resolvedFaults,
      pendingFaults,
      kioskFaults,
      kioskAnalyticsList,
      movements,
      recurrentLocations,
      monthlyDistribution
    };
  }
}
