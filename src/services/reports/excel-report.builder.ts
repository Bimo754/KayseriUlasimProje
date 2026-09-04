import ExcelJS from 'exceljs';
import { PRIORITY_MATRIX } from '../../constants';
import { ReportDataPayload } from './report-analytics.service';

export function getPriorityLabel(pScore?: number | null): string {
  if (pScore == null) return '-';
  if (pScore >= 90) return 'En Acil';
  if (pScore >= 70) return 'Yüksek';
  if (pScore >= 40) return 'Orta';
  return 'Düşük';
}

export class ExcelReportBuilder {
  /**
   * Constructs a multi-sheet corporate Excel workbook (.xlsx) using ExcelJS.
   */
  public static async generateExcelBuffer(data: ReportDataPayload): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Kayseri Ulaşım A.Ş.';
    workbook.lastModifiedBy = data.username;
    workbook.created = new Date();

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' } // Dark Slate
    };
    const headerFont: Partial<ExcelJS.Font> = {
      name: 'Segoe UI',
      bold: true,
      color: { argb: 'FFFFFFFF' },
      size: 11
    };
    const titleFont: Partial<ExcelJS.Font> = {
      name: 'Segoe UI',
      bold: true,
      color: { argb: 'FF0F172A' },
      size: 16
    };
    const subTitleFont: Partial<ExcelJS.Font> = {
      name: 'Segoe UI',
      color: { argb: 'FF64748B' },
      size: 10
    };
    const zebraFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' }
    };
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    const styleHeaderRow = (row: ExcelJS.Row) => {
      row.height = 28;
      row.eachCell(cell => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = thinBorder;
      });
    };

    const styleDataRows = (sheet: ExcelJS.Worksheet, startRow = 5) => {
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber >= startRow) {
          row.height = 20;
          if (rowNumber % 2 === 1) {
            row.eachCell(cell => {
              cell.fill = zebraFill;
            });
          }
          row.eachCell(cell => {
            cell.border = thinBorder;
            if (!cell.alignment) {
              cell.alignment = { vertical: 'middle', horizontal: 'left' };
            }
          });
        }
      });
    };

    const autofitColumns = (sheet: ExcelJS.Worksheet, dataStartRow = 5) => {
      sheet.columns.forEach(col => {
        let maxDataLen = 0;
        let headerLen = 0;
        if (col.values) {
          col.values.forEach((v, rowIdx) => {
            if (rowIdx === 4 && v != null) {
              headerLen = v.toString().length;
            } else if (rowIdx >= dataStartRow && v != null) {
              const str = v.toString();
              if (str.length > maxDataLen) maxDataLen = str.length;
            }
          });
        }

        let targetWidth = maxDataLen + 4;
        if (maxDataLen <= 10) {
          targetWidth = Math.max(maxDataLen + 5, 11);
        } else if (headerLen > targetWidth) {
          targetWidth = Math.min(Math.max(headerLen + 2, targetWidth), 35);
        }
        col.width = Math.min(Math.max(targetWidth, 10), 42);
      });
    };

    // ==========================================
    // TAB 1: YÖNETİCİ ÖZETİ & KPİ'LAR
    // ==========================================
    const ws1 = workbook.addWorksheet('Yönetici Özeti');
    ws1.views = [{ showGridLines: true }];

    ws1.mergeCells('A1:C1');
    const titleCell = ws1.getCell('A1');
    titleCell.value = 'KAYSERİ ULAŞIM A.Ş. - SAHA OPERASYON VE PERFORMANS RAPORU';
    titleCell.font = titleFont;

    ws1.mergeCells('A2:C2');
    const subCell = ws1.getCell('A2');
    subCell.value = `Tarih: ${new Date().toLocaleDateString('tr-TR')}  |  Operatör: ${data.username}  |  Kapsam: ${data.scope}  |  Filtre: ${data.dateRange}`;
    subCell.font = subTitleFont;

    ws1.addRow([]); // Blank line

    const kpiHeader = ws1.addRow(['Performans Göstergesi (KPI)', 'Metrik Değeri', 'Açıklama / Not']);
    kpiHeader.height = 24;
    kpiHeader.eachCell(c => { c.fill = headerFill; c.font = headerFont; c.border = thinBorder; });

    const s = data.summary;
    const p = s.oncelik_dagilimi || {};

    const kpiRows = [
      ['Donanım Erişilebilirlik Oranı', `%${s.donanim_erisilebilirlik_yuzdesi}`, 'İstasyon Cihazları + Otomatik Kiosk Aktifliği'],
      ['Toplam Çözülen Arıza Kaydı', s.toplam_cozulen, 'Tamamlanan saha müdahaleleri'],
      ['Aktif Bekleyen Arıza Kaydı', s.toplam_bekleyen, 'Saha ekipleri müdahale kuyruğu'],
      ['Otomatik Kiosk Arızaları (105 Kiosk)', s.toplam_kiosk_arizasi, 'Dolum otomatı arıza kayıtları'],
      ['Toplam Tramvay İstasyon Cihazı', s.toplam_cihaz, 'Turnike, İade Validatörü, Serbest Kapı'],
      ['Toplam Otomatik Kiosk', s.toplam_kiosk, 'Saha dolum otomatı sayısı'],
      ['Arızalı Cihaz / Kiosk Sayısı', s.arizali_cihaz + s.arizali_kiosk, 'Mevcut arızalı donanımlar'],
      ['En Acil Arızalar (Puan >= 90)', p.en_acil || 0, 'Kritik istasyon kilitlenmeleri'],
      ['Yüksek Öncelikli Arızalar (70-89)', p.yuksek || 0, 'Giriş kapasitesi etkileri'],
      ['Orta / Düşüş Öncelikli Arızalar', (p.orta || 0) + (p.dusuk || 0), 'İkincil arızalar'],
      ['Dahili Ekip Sorumluluğundaki Arızalar', p.dahili || 0, 'Kayseri Ulaşım bakım personeli'],
      ['Taşeron Sorumluluğundaki Arızalar', p.taseron || 0, 'Kaset dolu, para sıkışması vb.']
    ];

    kpiRows.forEach(r => {
      const row = ws1.addRow(r);
      row.border = thinBorder;
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    });
    styleDataRows(ws1, 5);
    autofitColumns(ws1);

    // ==========================================
    // TAB 2: TÜM ARIZA KAYITLARI (AUDIT LOG)
    // ==========================================
    const ws2 = workbook.addWorksheet('Tüm Arıza Kayıtları');
    ws2.views = [{ showGridLines: true }];

    ws2.mergeCells('A1:M1');
    ws2.getCell('A1').value = 'KAYSERİ ULAŞIM - TÜM ARIZA VE MÜDAHALE AUDİT KAYITLARI';
    ws2.getCell('A1').font = titleFont;

    ws2.mergeCells('A2:M2');
    ws2.getCell('A2').value = `Toplam Kayıt: ${data.allFaults.length}  |  Oluşturma: ${new Date().toLocaleString('tr-TR')}`;
    ws2.getCell('A2').font = subTitleFont;

    ws2.addRow([]);

    const fHeader = ws2.addRow([
      'Arıza ID', 'Lokasyon Adı', 'Arıza Tanımı', 'Arıza Tipi', 'Cihaz Kodu', 
      'Kiosk Kodu', 'Sorumluluk', 'Durum', 'Öncelik Puanı', 'Öncelik Seviyesi',
      'Bildirim Tarihi', 'Çözüm Tarihi', 'Çözüm Süresi (Saat)'
    ]);
    styleHeaderRow(fHeader);
    ws2.autoFilter = 'A4:M4';

    data.allFaults.forEach(f => {
      const pLabel = getPriorityLabel(f.oncelik_puani);
      const isResolved = f.durum === 'COZULDU';
      const statusText = isResolved ? 'ÇÖZÜLDÜ' : 'BEKLİYOR';

      const row = ws2.addRow([
        f.id,
        f.lokasyon_adi || '-',
        f.ariza_metni || '-',
        PRIORITY_MATRIX[f.ariza_tipi]?.etiket || f.ariza_tipi || '-',
        f.cihaz_kodu || '-',
        f.kiosk_kodu || '-',
        f.sorumluluk || 'DAHILI',
        statusText,
        f.oncelik_puani || 50,
        pLabel,
        f.bildirim_zamani || '-',
        f.cozum_zamani || '-',
        f.cozum_suresi_saat != null ? Number(f.cozum_suresi_saat) : '-'
      ]);

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(13).alignment = { vertical: 'middle', horizontal: 'center' };
    });

    styleDataRows(ws2, 5);

    ws2.eachRow((row, rowNumber) => {
      if (rowNumber >= 5) {
        const durumCell = row.getCell(8);
        const statusText = durumCell.value?.toString();
        durumCell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (statusText === 'ÇÖZÜLDÜ') {
          durumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
          durumCell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FF166534' } };
        } else if (statusText === 'BEKLİYOR') {
          durumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          durumCell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FF991B1B' } };
        }

        const pCell = row.getCell(10);
        const pLabel = pCell.value?.toString();
        pCell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (pLabel === 'En Acil') {
          pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          pCell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FF991B1B' } };
        } else if (pLabel === 'Yüksek') {
          pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
          pCell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FF9A3412' } };
        } else if (pLabel === 'Orta') {
          pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          pCell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FF854D0E' } };
        } else if (pLabel === 'Düşük') {
          pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
          pCell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FF334155' } };
        }
      }
    });

    autofitColumns(ws2);

    // ==========================================
    // TAB 3: KİOSK ANALİZİ (105 KİOSK)
    // ==========================================
    const ws3 = workbook.addWorksheet('Kiosk Analizi');
    ws3.views = [{ showGridLines: true }];

    ws3.mergeCells('A1:I1');
    ws3.getCell('A1').value = 'OTOMATİK KİOSKLAR DONANIM VE ARIZA ANALİZİ (105 KİOSK)';
    ws3.getCell('A1').font = titleFont;

    ws3.mergeCells('A2:I2');
    ws3.getCell('A2').value = 'Dolum otomatı bazında arıza frekansı ve taşeron sorumluluk kırılımı';
    ws3.getCell('A2').font = subTitleFont;

    ws3.addRow([]);

    const kHeader = ws3.addRow([
      'Kiosk Kodu', 'Kiosk Adı / Lokasyon', 'Adres', 'Mevcut Durum', 'Sorumluluk',
      'Toplam Arıza Sayısı', 'Dahili Arıza', 'Taşeron Arıza', 'Son Arıza Tarihi'
    ]);
    styleHeaderRow(kHeader);
    ws3.autoFilter = 'A4:I4';

    data.kioskAnalyticsList.forEach(k => {
      const isFaulty = k.durum === 'ARIZALI';
      const statusText = isFaulty ? 'ARIZALI' : 'NORMAL';

      const row = ws3.addRow([
        k.kiosk_kodu,
        k.kiosk_adi,
        k.adres || 'Saha Dolum Noktası',
        statusText,
        k.sorumluluk || 'DAHILI',
        k.toplam_ariza_sayisi || 0,
        k.dahili_ariza_sayisi || 0,
        k.taseron_ariza_sayisi || 0,
        k.son_ariza_tarihi || '-'
      ]);

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
    });

    styleDataRows(ws3, 5);

    ws3.eachRow((row, rowNumber) => {
      if (rowNumber >= 5) {
        const kDurumCell = row.getCell(4);
        const statusText = kDurumCell.value?.toString();
        kDurumCell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (statusText === 'ARIZALI') {
          kDurumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          kDurumCell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FF991B1B' } };
        } else if (statusText === 'NORMAL') {
          kDurumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
          kDurumCell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FF166534' } };
        }

        const respCell = row.getCell(5);
        const respText = respCell.value?.toString();
        respCell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (respText === 'TASERON') {
          respCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          respCell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FF92400E' } };
        } else if (respText === 'DAHILI') {
          respCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
          respCell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FF0369A1' } };
        }
      }
    });

    autofitColumns(ws3);

    // ==========================================
    // TAB 4: AYLIK ARIZA DAĞILIMI
    // ==========================================
    const ws4 = workbook.addWorksheet('Aylık Arıza Dağılımı');
    ws4.views = [{ showGridLines: true }];

    ws4.mergeCells('A1:E1');
    ws4.getCell('A1').value = 'AYLIK ARIZA TİPLERİ VE TREND MATRİSİ';
    ws4.getCell('A1').font = titleFont;

    ws4.mergeCells('A2:E2');
    ws4.getCell('A2').value = 'Dönem bazında en çok tekrar eden arıza kategorileri';
    ws4.getCell('A2').font = subTitleFont;

    ws4.addRow([]);

    const mHeader = ws4.addRow([
      'Dönem (Yıl-Ay)', 'Arıza Kodu / Kategori', 'Arıza Etiketi', 'Sorumluluk', 'Arıza Sayısı (Frekans)'
    ]);
    styleHeaderRow(mHeader);
    ws4.autoFilter = 'A4:E4';

    data.monthlyDistribution.forEach(m => {
      const label = PRIORITY_MATRIX[m.ariza_tipi]?.etiket || m.ariza_tipi;
      const row = ws4.addRow([
        m.ay || 'Diğer',
        m.ariza_tipi,
        label,
        m.sorumluluk || 'DAHILI',
        m.ariza_sayisi
      ]);

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    });

    styleDataRows(ws4, 5);

    ws4.eachRow((row, rowNumber) => {
      if (rowNumber >= 5) {
        const respCell = row.getCell(4);
        const respText = respCell.value?.toString();
        respCell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (respText === 'TASERON') {
          respCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          respCell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FF92400E' } };
        } else if (respText === 'DAHILI') {
          respCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
          respCell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FF0369A1' } };
        }
      }
    });

    autofitColumns(ws4);

    // ==========================================
    // TAB 5: EN ÇOK ARIZALANAN LOKASYONLAR (HOTSPOT)
    // ==========================================
    const ws5 = workbook.addWorksheet('Kronik Lokasyonlar');
    ws5.views = [{ showGridLines: true }];

    ws5.mergeCells('A1:G1');
    ws5.getCell('A1').value = 'TEKRARLAYAN KRONİK LOKASYON ANALİZİ';
    ws5.getCell('A1').font = titleFont;

    ws5.mergeCells('A2:G2');
    ws5.getCell('A2').value = 'En yüksek arıza frekansına sahip istasyon ve dolum noktaları';
    ws5.getCell('A2').font = subTitleFont;

    ws5.addRow([]);

    const rHeader = ws5.addRow([
      'Sıra', 'Lokasyon Adı', 'Arıza Frekansı', 'Bekleyen Arıza', 
      'Çözülen Arıza', 'Baskın Arıza Tipi', 'Son Bildirim Tarihi'
    ]);
    styleHeaderRow(rHeader);
    ws5.autoFilter = 'A4:G4';

    data.recurrentLocations.forEach((r, idx) => {
      const label = PRIORITY_MATRIX[r.ariza_tipi]?.etiket || r.ariza_tipi;
      const row = ws5.addRow([
        idx + 1,
        r.lokasyon_adi,
        r.ariza_frekansi,
        r.bekleyen_sayisi || 0,
        r.cozulen_sayisi || 0,
        label,
        r.son_bildirim || '-'
      ]);

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
    });

    styleDataRows(ws5, 5);
    autofitColumns(ws5);

    // ==========================================
    // TAB 6: CİHAZ HAREKET GÜNLÜĞÜ
    // ==========================================
    const ws6 = workbook.addWorksheet('Cihaz Hareket Günlüğü');
    ws6.views = [{ showGridLines: true }];

    ws6.mergeCells('A1:H1');
    ws6.getCell('A1').value = 'CİHAZ VE DONANIM TAKAS / DEĞİŞİM GÜNLÜĞÜ';
    ws6.getCell('A1').font = titleFont;

    ws6.mergeCells('A2:H2');
    ws6.getCell('A2').value = 'Sahadaki donanım hareketleri ve bakım geçmişi';
    ws6.getCell('A2').font = subTitleFont;

    ws6.addRow([]);

    const movHeader = ws6.addRow([
      'Kayıt ID', 'Cihaz Kodu', 'Cihaz Türü', 'İşlem Türü', 'Önceki Lokasyon', 
      'Yeni Lokasyon / Açıklama', 'İşlemi Yapan Operatör', 'İşlem Tarihi'
    ]);
    styleHeaderRow(movHeader);
    ws6.autoFilter = 'A4:H4';

    data.movements.forEach(m => {
      const row = ws6.addRow([
        m.id,
        m.cihaz_kodu,
        m.cihaz_turu || '-',
        m.islem_turu || '-',
        m.onceki_lokasyon || '-',
        m.yeni_lokasyon || m.aciklama || '-',
        m.yapan_kullanici || 'admin',
        m.islem_tarihi || '-'
      ]);

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
    });

    styleDataRows(ws6, 5);
    autofitColumns(ws6);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
