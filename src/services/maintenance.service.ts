import ExcelJS from 'exceljs';
import { getDb } from '../database/db';
import { Config } from '../config';
import { RoutingService } from './routing.service';
import { EnsembleSelector } from '../algorithms/ensemble.selector';

export interface MaintenanceStop {
  sira_no: number;
  id: number;
  kod: string;
  ad: string;
  tur: 'KIOSK' | 'TURNIKE';
  adres: string;
  enlem: number;
  boylam: number;
  bacak_mesafe_km: number;
  bacak_sure_dk: number;
  hat_kodu?: string;
  cihaz_sayisi?: number;
}

export interface MaintenancePlanResult {
  mod: 'KIOSK' | 'TURNIKE';
  basarili: boolean;
  baslik: string;
  toplam_durak: number;
  toplam_mesafe_km: number;
  toplam_sure_dk: number;
  baslangic_noktasi: { enlem: number; boylam: number; ad: string };
  duraklar: MaintenanceStop[];
  bacaklar: any[];
  excel_download_url?: string;
}

export class MaintenanceService {
  /**
   * 1. Kiosk Bakım Planı - Tüm 105 Otomatik Kiosk İçin Kesintisiz Mekansal Süpürme Rotası
   */
  public static async planKioskMaintenance(
    startLat?: number,
    startLon?: number,
    startMode: 'CAR' | 'DEPOT' = 'CAR',
    targetImei?: string
  ): Promise<MaintenancePlanResult> {
    const db = getDb();
    const kiosks = db.prepare(`
      SELECT id, kiosk_kodu as kod, ad, enlem, boylam, adres, sorumluluk
      FROM otomatik_kiosklar
      WHERE enlem IS NOT NULL AND boylam IS NOT NULL AND enlem != 0
    `).all() as any[];

    let initLat: number;
    let initLon: number;
    let startLabel: string;

    if (startMode === 'DEPOT') {
      initLat = Config.ANA_US_LAT;
      initLon = Config.ANA_US_LON;
      startLabel = 'Kayseri Ulaşım Ana Üs & Depo';
    } else {
      const currentVeh = RoutingService.getVehiclePosition(targetImei);
      initLat = (startLat != null && !targetImei) ? startLat : (currentVeh ? currentVeh.enlem : Config.ANA_US_LAT);
      initLon = (startLon != null && !targetImei) ? startLon : (currentVeh ? currentVeh.boylam : Config.ANA_US_LON);
      const vehiclePlaka = currentVeh ? currentVeh.plaka : 'Saha Bakım Aracı';
      startLabel = `${vehiclePlaka} (${initLat.toFixed(4)}, ${initLon.toFixed(4)})`;
    }

    const rawKiosks = kiosks.map(k => ({
      id: k.id,
      kod: k.kod,
      ad: k.ad,
      tur: 'KIOSK' as const,
      adres: k.adres || `Otomatik Kiosk (${k.ad})`,
      enlem: k.enlem,
      boylam: k.boylam,
      sira_no: 0,
      bacak_mesafe_km: 0,
      bacak_sure_dk: 0
    }));

    // Multi-Strategy Ensemble Solver for Kiosk Maintenance
    const candidate1 = MaintenanceService.generateNearestNeighborRoute(initLat, initLon, rawKiosks);
    const candidate2 = MaintenanceService.generatePolarRadialRoute(initLat, initLon, rawKiosks);
    const candidate3 = MaintenanceService.generateDensityClusterRoute(initLat, initLon, rawKiosks);

    const refined1 = MaintenanceService.apply2OptRefinement(candidate1, initLat, initLon);
    const refined2 = MaintenanceService.apply2OptRefinement(candidate2, initLat, initLon);
    const refined3 = MaintenanceService.apply2OptRefinement(candidate3, initLat, initLon);

    const candidates = [candidate1, candidate2, candidate3, refined1, refined2, refined3];

    let orderedStops = refined1;
    let minCost = Infinity;

    for (const cand of candidates) {
      if (cand.length === 0) continue;
      let cost = RoutingService.calculateDistance(initLat, initLon, cand[0].enlem, cand[0].boylam);
      for (let i = 0; i < cand.length - 1; i++) {
        cost += RoutingService.calculateDistance(cand[i].enlem, cand[i].boylam, cand[i + 1].enlem, cand[i + 1].boylam);
      }
      if (cost < minCost) {
        minCost = cost;
        orderedStops = cand;
      }
    }

    // Assign leg distances, durations, and sequence numbers
    let totalDistance = 0.0;
    let totalTimeMins = 0;
    let curLat = initLat;
    let curLon = initLon;

    for (let idx = 0; idx < orderedStops.length; idx++) {
      const stop = orderedStops[idx];
      const airD = RoutingService.calculateDistance(curLat, curLon, stop.enlem, stop.boylam);
      const roadKm = parseFloat((airD * 1.35).toFixed(2));
      const durMins = Math.max(2, Math.round((roadKm / 35.0) * 60));

      stop.sira_no = idx + 1;
      stop.bacak_mesafe_km = roadKm;
      stop.bacak_sure_dk = durMins;

      totalDistance += roadKm;
      totalTimeMins += durMins;

      curLat = stop.enlem;
      curLon = stop.boylam;
    }

    return {
      mod: 'KIOSK',
      basarili: true,
      baslik: 'Tüm Otomatik Kiosklar Periyodik Bakım Rota Planı',
      toplam_durak: orderedStops.length,
      toplam_mesafe_km: parseFloat(totalDistance.toFixed(1)),
      toplam_sure_dk: totalTimeMins,
      baslangic_noktasi: {
        enlem: initLat,
        boylam: initLon,
        ad: startLabel
      },
      duraklar: orderedStops,
      bacaklar: []
    };
  }

  /**
   * 2. Turnike Bakım Planı - Tramvay İstasyonlarını Hat ve Koridor Sırasına Göre Planlar
   */
  public static async planTurnikeMaintenance(
    lineFilter?: string,
    startLat?: number,
    startLon?: number,
    startMode: 'CAR' | 'DEPOT' = 'CAR',
    targetImei?: string
  ): Promise<MaintenancePlanResult> {
    const db = getDb();

    let initLat: number;
    let initLon: number;
    let startLabel: string;

    if (startMode === 'DEPOT') {
      initLat = Config.ANA_US_LAT;
      initLon = Config.ANA_US_LON;
      startLabel = 'Kayseri Ulaşım Ana Üs & Depo';
    } else {
      const currentVeh = RoutingService.getVehiclePosition(targetImei);
      initLat = (startLat != null && !targetImei) ? startLat : (currentVeh ? currentVeh.enlem : Config.ANA_US_LAT);
      initLon = (startLon != null && !targetImei) ? startLon : (currentVeh ? currentVeh.boylam : Config.ANA_US_LON);
      const vehiclePlaka = currentVeh ? currentVeh.plaka : 'Saha Bakım Aracı';
      startLabel = `${vehiclePlaka} (${initLat.toFixed(4)}, ${initLon.toFixed(4)})`;
    }

    let stations: any[] = [];

    if (lineFilter && lineFilter !== 'ALL') {
      // Single line mode: Fetch strictly in line order (hib.sira_no)
      const query = `
        SELECT i.id, i.istasyon_kodu as kod, i.ad, i.enlem, i.boylam,
               hib.sira_no as line_sira,
               (SELECT COUNT(*) FROM cihazlar c WHERE c.istasyon_id = i.id AND c.cihaz_turu = 'TURNIKE') as turnike_sayisi,
               (SELECT GROUP_CONCAT(DISTINCT h2.kod) FROM hat_istasyon_baglantisi hib2 JOIN hatlar h2 ON hib2.hat_id = h2.id WHERE hib2.istasyon_id = i.id) as hat_kodu
        FROM istasyonlar i
        JOIN hat_istasyon_baglantisi hib ON i.id = hib.istasyon_id
        JOIN hatlar h ON hib.hat_id = h.id
        WHERE i.aktif = 1 AND i.enlem IS NOT NULL AND i.boylam IS NOT NULL AND h.kod = ?
        ORDER BY hib.sira_no ASC
      `;
      let raw = db.prepare(query).all(lineFilter) as any[];
      if (raw.length > 1) {
        const dStart = RoutingService.calculateDistance(initLat, initLon, raw[0].enlem, raw[0].boylam);
        const dEnd = RoutingService.calculateDistance(initLat, initLon, raw[raw.length - 1].enlem, raw[raw.length - 1].boylam);
        if (dEnd < dStart) {
          raw.reverse();
        }
      }
      stations = raw;
    } else {
      // ALL Lines mode: 10-Algorithm Ensemble Hybrid Optimization Pipeline
      stations = EnsembleSelector.selectBestRoute(initLat, initLon);
    }

    let curLat = initLat;
    let curLon = initLon;
    let totalDistance = 0.0;
    let totalTimeMins = 0;

    const orderedStops: MaintenanceStop[] = stations.map((st, idx) => {
      const airD = RoutingService.calculateDistance(curLat, curLon, st.enlem, st.boylam);
      const roadKm = parseFloat((airD * 1.35).toFixed(2));
      const durMins = Math.max(2, Math.round((roadKm / 35.0) * 60));

      totalDistance += roadKm;
      totalTimeMins += durMins;
      curLat = st.enlem;
      curLon = st.boylam;

      return {
        sira_no: idx + 1,
        id: st.id,
        kod: st.kod,
        ad: st.ad,
        tur: 'TURNIKE',
        adres: `${st.hat_kodu || 'Raylı Sistem'} Hattı Bağlantısı`,
        enlem: st.enlem,
        boylam: st.boylam,
        bacak_mesafe_km: roadKm,
        bacak_sure_dk: durMins,
        hat_kodu: st.hat_kodu,
        cihaz_sayisi: st.turnike_sayisi || 4
      };
    });

    return {
      mod: 'TURNIKE',
      basarili: true,
      baslik: `Turnike Periyodik Bakım Rota Planı ${lineFilter ? `(${lineFilter} Hattı)` : '(Tüm Hatlar)'}`,
      toplam_durak: orderedStops.length,
      toplam_mesafe_km: parseFloat(totalDistance.toFixed(1)),
      toplam_sure_dk: totalTimeMins,
      baslangic_noktasi: {
        enlem: initLat,
        boylam: initLon,
        ad: startLabel
      },
      duraklar: orderedStops,
      bacaklar: []
    };
  }

  /**
   * Generates a field-ready Excel checklist workbook (.xlsx) using ExcelJS
   */
  public static async generateMaintenanceExcelBuffer(plan: MaintenancePlanResult): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Kayseri Ulaşım Bilgi İşlem Müdürlüğü';
    workbook.created = new Date();

    // TAB 1: Adım Adım Bakım Listesi (1..N)
    const sheet1 = workbook.addWorksheet('Adım Adım Bakım Listesi', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
    });

    // Title Block
    sheet1.mergeCells('A1:H1');
    const titleCell = sheet1.getCell('A1');
    titleCell.value = `KAYSERİ ULAŞIM A.Ş. - ${plan.baslik.toUpperCase()}`;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004990' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet1.getRow(1).height = 36;

    // Subheader Info
    sheet1.mergeCells('A2:H2');
    const subCell = sheet1.getCell('A2');
    subCell.value = `Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')} | Toplam Nokta: ${plan.toplam_durak} | Tahmini Toplam Mesafe: ${plan.toplam_mesafe_km} km | Tahmini Sürüş: ~${plan.toplam_sure_dk} dk`;
    subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF334155' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet1.getRow(2).height = 24;

    sheet1.addRow([]);

    // Table Headers
    const headers = [
      'Sıra No',
      'Cihaz / Nokta Kodu',
      'Lokasyon / Cihaz Adı',
      'Adres / Hat Bilgisi',
      'Mesafe (km)',
      'Tahmini Varış (dk)',
      'Bakım Durumu [X]',
      'Tekniker Notu & İmza'
    ];
    const headerRow = sheet1.addRow(headers);
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF004990' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } }
      };
    });

    // Data Rows
    plan.duraklar.forEach((st, idx) => {
      const row = sheet1.addRow([
        st.sira_no,
        st.kod,
        st.ad,
        st.adres,
        st.bacak_mesafe_km,
        st.bacak_sure_dk,
        '[   ]',
        ''
      ]);
      row.height = 22;

      const isZebra = idx % 2 === 1;
      const bgArgb = isZebra ? 'FFF8FAFC' : 'FFFFFFFF';

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9.5 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        if (colNumber === 1 || colNumber === 2 || colNumber === 7) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNumber === 5 || colNumber === 6) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    // Dynamic Column Auto-Fit Calculation for Sheet 1
    sheet1.columns.forEach((col, colIdx) => {
      let maxLen = headers[colIdx] ? headers[colIdx].length : 0;
      sheet1.eachRow((row, rowNumber) => {
        if (rowNumber <= 3) return; // Skip title/header banner rows
        const cellVal = row.getCell(colIdx + 1).value;
        const text = cellVal != null ? String(cellVal) : '';
        if (text.length > maxLen) {
          maxLen = text.length;
        }
      });
      col.width = Math.max(maxLen + 4, 12);
    });

    // TAB 2: Güzergah İstatistiği
    const sheet2 = workbook.addWorksheet('Güzergah İstatistiği');

    sheet2.mergeCells('A1:D1');
    const s2Title = sheet2.getCell('A1');
    s2Title.value = 'PERİYODİK BAKIM GÜZERGAH ÖZET İSTATİSTİĞİ';
    s2Title.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    s2Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004990' } };
    s2Title.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet2.getRow(1).height = 30;

    const summaryData = [
      ['Parametre', 'Değer'],
      ['Bakım Modu', plan.mod === 'KIOSK' ? 'Otomatik Kiosk Bakımı' : 'Turnike Bakımı'],
      ['Başlangıç Noktası', plan.baslangic_noktasi.ad],
      ['Toplam Bakım Noktası', `${plan.toplam_durak} Adet`],
      ['Toplam Sürüş Mesafesi', `${plan.toplam_mesafe_km} km`],
      ['Tahmini Toplam Sürüş Süresi', `~${plan.toplam_sure_dk} dakika`],
      ['Rapor Üretim Tarihi', new Date().toLocaleString('tr-TR')],
      ['Yetkili Birim', 'Kayseri Ulaşım A.Ş. Akıllı Ulaşım Sistemleri (AUS) Bakım Birimi']
    ];

    summaryData.forEach((r, idx) => {
      const row = sheet2.addRow(r);
      row.height = 22;
      if (idx === 0) {
        row.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        row.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      } else {
        row.getCell(1).font = { bold: true };
      }
    });

    // Dynamic Column Auto-Fit Calculation for Sheet 2
    sheet2.columns.forEach((col, colIdx) => {
      let maxLen = 0;
      sheet2.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip merged title
        const cellVal = row.getCell(colIdx + 1).value;
        const text = cellVal != null ? String(cellVal) : '';
        if (text.length > maxLen) {
          maxLen = text.length;
        }
      });
      col.width = Math.max(maxLen + 4, 24);
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private static generateNearestNeighborRoute(startLat: number, startLon: number, kiosks: any[]): MaintenanceStop[] {
    const unvisited = [...kiosks];
    let curLat = startLat;
    let curLon = startLon;
    const result: MaintenanceStop[] = [];

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const d = RoutingService.calculateDistance(curLat, curLon, unvisited[i].enlem, unvisited[i].boylam);
        if (d < minDistance) {
          minDistance = d;
          nearestIdx = i;
        }
      }

      const selected = unvisited.splice(nearestIdx, 1)[0];
      result.push(selected);
      curLat = selected.enlem;
      curLon = selected.boylam;
    }
    return result;
  }

  private static generatePolarRadialRoute(startLat: number, startLon: number, kiosks: any[]): MaintenanceStop[] {
    const sorted = [...kiosks].sort((a, b) => {
      const angleA = Math.atan2(a.boylam - startLon, a.enlem - startLat);
      const angleB = Math.atan2(b.boylam - startLon, b.enlem - startLat);
      return angleA - angleB;
    });
    return sorted;
  }

  private static generateDensityClusterRoute(startLat: number, startLon: number, kiosks: any[]): MaintenanceStop[] {
    const sorted = [...kiosks].sort((a, b) => {
      const dA = RoutingService.calculateDistance(startLat, startLon, a.enlem, a.boylam);
      const dB = RoutingService.calculateDistance(startLat, startLon, b.enlem, b.boylam);
      return dA - dB;
    });

    const result: MaintenanceStop[] = [];
    const unvisited = [...sorted];
    let curLat = startLat;
    let curLon = startLon;

    while (unvisited.length > 0) {
      let bestIdx = 0;
      let bestScore = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const dist = RoutingService.calculateDistance(curLat, curLon, unvisited[i].enlem, unvisited[i].boylam);
        if (dist < bestScore) {
          bestScore = dist;
          bestIdx = i;
        }
      }

      const selected = unvisited.splice(bestIdx, 1)[0];
      result.push(selected);
      curLat = selected.enlem;
      curLon = selected.boylam;
    }
    return result;
  }

  private static apply2OptRefinement(stops: MaintenanceStop[], startLat: number, startLon: number): MaintenanceStop[] {
    if (!stops || stops.length < 3) return stops || [];
    let best = [...stops];
    let improved = true;
    let iterations = 0;
    const maxIterations = 20;
    const maxWindow = 25;

    const calcTotalDist = (route: MaintenanceStop[]) => {
      let d = RoutingService.calculateDistance(startLat, startLon, route[0].enlem, route[0].boylam);
      for (let i = 0; i < route.length - 1; i++) {
        d += RoutingService.calculateDistance(route[i].enlem, route[i].boylam, route[i + 1].enlem, route[i + 1].boylam);
      }
      return d;
    };

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      for (let i = 0; i < best.length - 1; i++) {
        const kMax = Math.min(i + maxWindow, best.length - 1);
        for (let k = i + 1; k <= kMax; k++) {
          const prevLat = i === 0 ? startLat : best[i - 1].enlem;
          const prevLon = i === 0 ? startLon : best[i - 1].boylam;
          const nextLat = k === best.length - 1 ? best[k].enlem : best[k + 1].enlem;
          const nextLon = k === best.length - 1 ? best[k].boylam : best[k + 1].boylam;

          const oldEdge1 = RoutingService.calculateDistance(prevLat, prevLon, best[i].enlem, best[i].boylam);
          const oldEdge2 = (k < best.length - 1) ? RoutingService.calculateDistance(best[k].enlem, best[k].boylam, nextLat, nextLon) : 0;

          const newEdge1 = RoutingService.calculateDistance(prevLat, prevLon, best[k].enlem, best[k].boylam);
          const newEdge2 = (k < best.length - 1) ? RoutingService.calculateDistance(best[i].enlem, best[i].boylam, nextLat, nextLon) : 0;

          if ((newEdge1 + newEdge2) < (oldEdge1 + oldEdge2) - 0.005) {
            best = [
              ...best.slice(0, i),
              ...best.slice(i, k + 1).reverse(),
              ...best.slice(k + 1)
            ];
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }
    return best;
  }
}
