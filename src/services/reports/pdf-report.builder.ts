import fs from 'fs';
import PDFDocument from 'pdfkit';
import { PRIORITY_MATRIX } from '../../constants';
import { ReportDataPayload } from './report-analytics.service';

export class PdfReportBuilder {
  private static FONT_REGULAR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
  private static FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

  /**
   * Renders copyable cell overlay text in PDF.
   */
  private static drawCopyableTextCell(
    doc: PDFKit.PDFDocument,
    text: string,
    x: number,
    y: number,
    maxLength: number,
    color = '#0f172a',
    align: 'left' | 'right' = 'left',
    width?: number
  ) {
    if (!text) return;
    const clean = text.trim();

    if (clean.length <= maxLength) {
      doc.fillColor(color).text(clean, x, y, { lineBreak: false, align, width });
    } else {
      const truncated = clean.slice(0, maxLength - 3) + '...';
      doc.fillColor(color).text(truncated, x, y, { lineBreak: false, align, width });

      doc.save();
      doc.opacity(0);
      doc.text(clean, x, y, { lineBreak: false, align, width });
      doc.restore();
    }
  }

  /**
   * Constructs a multi-page publication-grade executive PDF document using PDFKit.
   */
  public static buildPdfBuffer(data: ReportDataPayload): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 36,
          bufferPages: true,
          info: {
            Title: data.title,
            Author: 'Kayseri Ulaşım A.Ş.',
            Subject: 'Kurumsal Saha Operasyon ve Rota Yönetim Raporu'
          }
        });

        const buffers: Buffer[] = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const hasRegularFont = fs.existsSync(PdfReportBuilder.FONT_REGULAR);
        const hasBoldFont = fs.existsSync(PdfReportBuilder.FONT_BOLD);

        const setFont = (isBold = false) => {
          if (isBold && hasBoldFont) {
            doc.font(PdfReportBuilder.FONT_BOLD);
          } else if (hasRegularFont) {
            doc.font(PdfReportBuilder.FONT_REGULAR);
          } else {
            doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica');
          }
        };

        const startX = 36;
        const pageWidth = 523;
        let y = 36;

        const ensureSpace = (neededHeight: number) => {
          if (y + neededHeight > 750) {
            doc.addPage();
            y = 36;
            return true;
          }
          return false;
        };

        // 1. Executive Top Header Masthead
        doc.moveTo(startX, y).lineTo(startX + pageWidth, y).strokeColor('#0f172a').lineWidth(2.5).stroke();
        y += 12;

        setFont(true);
        doc.fillColor('#0f172a').fontSize(16).text('KAYSERİ ULAŞIM A.Ş.', startX, y);
        setFont(false);
        doc.fontSize(8.5).fillColor('#64748b').text('SAHA OPERASYON, ARIZA VE ROTA PORTALI', startX, y + 20);

        const dateStr = new Date().toLocaleDateString('tr-TR');
        const refCode = `REF: KU-SOP-${new Date().getFullYear()}`;

        setFont(true);
        doc.fontSize(7.5).fillColor('#475569');
        doc.text(refCode, startX + 300, y + 2, { align: 'right', width: 223 });

        setFont(false);
        doc.fontSize(7.5).fillColor('#64748b');
        doc.text(`Tarih: ${dateStr}  •  Operatör: ${data.username}`, startX + 300, y + 14, { align: 'right', width: 223 });
        doc.text(`Kapsam: ${data.scope}  •  Filtre: ${data.dateRange}`, startX + 300, y + 25, { align: 'right', width: 223 });

        y += 44;
        doc.moveTo(startX, y).lineTo(startX + pageWidth, y).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
        y += 16;

        // 2. Section 01: KPI Callouts
        setFont(true);
        doc.fillColor('#0f172a').fontSize(9.5).text('01  |  SİSTEM VE PERFORMANS GÖSTERGELERİ (KPİ)', startX, y);
        y += 14;

        const drawMetricColumn = (xPos: number, val: string, label: string, sub: string) => {
          setFont(true);
          doc.fillColor('#0f172a').fontSize(18).text(val, xPos, y, { lineBreak: false });
          setFont(true);
          doc.fontSize(7).fillColor('#475569').text(label, xPos, y + 23, { lineBreak: false });
          setFont(false);
          doc.fontSize(6.5).fillColor('#94a3b8').text(sub, xPos, y + 33, { lineBreak: false });
        };

        const drawDividerTick = (xPos: number) => {
          doc.moveTo(xPos, y + 2).lineTo(xPos, y + 38).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        };

        drawMetricColumn(startX, `${data.summary.toplam_kayit}`, 'TOPLAM ARIZA', 'Sistem Arıza Kaydı');
        drawDividerTick(startX + 120);

        drawMetricColumn(startX + 130, `${data.summary.toplam_bekleyen}`, 'BEKLEYEN ARIZA', 'Aktif Saha Kuyruğunda');
        drawDividerTick(startX + 250);

        drawMetricColumn(startX + 260, `%${data.summary.donanim_erisilebilirlik_yuzdesi}`, 'DONANIM ERİŞİMİ', 'Cihaz + Kiosk Aktiflik');
        drawDividerTick(startX + 380);

        drawMetricColumn(startX + 390, `${data.summary.toplam_kiosk_arizasi}`, 'KİOSK ARIZASI', '105 Otomatik Kiosk');

        y += 48;

        // Priority Summary Strip
        const pMetrics = data.summary.oncelik_dagilimi || {};
        doc.rect(startX, y, pageWidth, 20).fill('#f8fafc');
        doc.rect(startX, y, pageWidth, 20).stroke('#e2e8f0');

        setFont(true);
        doc.fillColor('#1e293b').fontSize(7.5);
        doc.text('ÖNCELİK DAĞILIMI:', startX + 8, y + 6);

        setFont(false);
        doc.fillColor('#334155').fontSize(7.5);
        const pStr = `En Acil: ${pMetrics.en_acil || 0}  •  Yüksek: ${pMetrics.yuksek || 0}  •  Orta: ${pMetrics.orta || 0}  •  Düşük: ${pMetrics.dusuk || 0}   |   Dahili: ${pMetrics.dahili || 0} / Taşeron: ${pMetrics.taseron || 0}`;
        doc.text(pStr, startX + 110, y + 6, { width: 400, lineBreak: false });

        y += 30;

        // 3. Section 02: Aylık Arıza Türü Dağılımı ("Ayda En Çok Gelen Tip")
        if (data.monthlyDistribution && data.monthlyDistribution.length > 0) {
          ensureSpace(55);
          setFont(true);
          doc.fillColor('#0f172a').fontSize(9.5).text('02  |  AYLIK EN ÇOK GELEN ARIZA TİPLERİ ANALİZİ', startX, y);
          y += 14;

          doc.moveTo(startX, y).lineTo(startX + pageWidth, y).strokeColor('#0f172a').lineWidth(1.2).stroke();
          y += 3;

          setFont(true);
          doc.fillColor('#1e293b').fontSize(7.5);
          doc.text('Dönem (Yıl-Ay)', startX + 4, y + 4);
          doc.text('Baskın Arıza Türü / Kategori', startX + 130, y + 4);
          doc.text('Sorumluluk', startX + 340, y + 4);
          doc.text('Arıza Frekansı', startX + 430, y + 4, { align: 'right', width: 88 });

          y += 16;
          doc.moveTo(startX, y).lineTo(startX + pageWidth, y).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
          y += 2;

          setFont(false);
          doc.fontSize(8);

          const monthlyTopList = data.monthlyDistribution.slice(0, 10);
          for (let i = 0; i < monthlyTopList.length; i++) {
            const m = monthlyTopList[i];
            ensureSpace(18);

            if (i % 2 === 1) {
              doc.rect(startX, y, pageWidth, 17).fill('#f8fafc');
            }

            setFont(true);
            doc.fillColor('#0f172a').text(m.ay || 'Cari Dönem', startX + 4, y + 4, { width: 110, lineBreak: false });
            setFont(false);

            const label = PRIORITY_MATRIX[m.ariza_tipi]?.etiket || m.ariza_tipi;
            PdfReportBuilder.drawCopyableTextCell(doc, label, startX + 130, y + 4, 30);

            doc.fillColor('#475569').text(m.sorumluluk || 'DAHILI', startX + 340, y + 4, { width: 70, lineBreak: false });

            setFont(true);
            doc.fillColor('#0f172a').text(`${m.ariza_sayisi} Adet`, startX + 430, y + 4, { align: 'right', width: 88, lineBreak: false });
            setFont(false);

            y += 17;
          }
          doc.moveTo(startX, y).lineTo(startX + pageWidth, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
          y += 18;
        }

        // 4. Section 03: Recurrent Chronic Locations
        if (data.recurrentLocations && data.recurrentLocations.length > 0) {
          ensureSpace(55);
          setFont(true);
          doc.fillColor('#0f172a').fontSize(9.5).text('03  |  EN ÇOK ARIZALANAN KRONİK LOKASYONLAR', startX, y);
          y += 14;

          doc.moveTo(startX, y).lineTo(startX + pageWidth, y).strokeColor('#0f172a').lineWidth(1.2).stroke();
          y += 3;

          setFont(true);
          doc.fillColor('#1e293b').fontSize(7.5);
          doc.text('Lokasyon Adı', startX + 4, y + 4);
          doc.text('Baskın Arıza Kategori', startX + 180, y + 4);
          doc.text('Frekans (Kaç Kere)', startX + 330, y + 4, { align: 'right', width: 75 });
          doc.text('Son Bildirim Tarihi', startX + 415, y + 4, { align: 'right', width: 103 });

          y += 16;
          doc.moveTo(startX, y).lineTo(startX + pageWidth, y).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
          y += 2;

          setFont(false);
          doc.fontSize(8);

          for (let i = 0; i < data.recurrentLocations.length; i++) {
            const rec = data.recurrentLocations[i];
            ensureSpace(18);

            if (i % 2 === 1) {
              doc.rect(startX, y, pageWidth, 17).fill('#f8fafc');
            }

            PdfReportBuilder.drawCopyableTextCell(doc, rec.lokasyon_adi || '', startX + 4, y + 4, 25);
            PdfReportBuilder.drawCopyableTextCell(doc, PRIORITY_MATRIX[rec.ariza_tipi]?.etiket || rec.ariza_tipi, startX + 180, y + 4, 25);

            setFont(true);
            doc.fillColor('#0f172a').text(`${rec.ariza_frekansi}x`, startX + 330, y + 4, { align: 'right', width: 75, lineBreak: false });
            setFont(false);

            const dateOnly = rec.son_bildirim ? rec.son_bildirim.slice(0, 16) : '-';
            doc.fillColor('#64748b').text(dateOnly, startX + 415, y + 4, { align: 'right', width: 103, lineBreak: false });

            y += 17;
          }
          doc.moveTo(startX, y).lineTo(startX + pageWidth, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
          y += 18;
        }

        // 5. Section 04: Master Fault Audit Log
        if (data.allFaults && data.allFaults.length > 0) {
          ensureSpace(55);
          setFont(true);
          doc.fillColor('#0f172a').fontSize(9.5).text(`04  |  ARIZA VE MÜDAHALE GÜNLÜĞÜ (${data.allFaults.length} Kayıt)`, startX, y);
          y += 14;

          doc.moveTo(startX, y).lineTo(startX + pageWidth, y).strokeColor('#0f172a').lineWidth(1.2).stroke();
          y += 3;

          setFont(true);
          doc.fillColor('#1e293b').fontSize(7.5);
          doc.text('ID', startX + 4, y + 4);
          doc.text('Lokasyon / Cihaz', startX + 36, y + 4);
          doc.text('Arıza Metni', startX + 175, y + 4);
          doc.text('Durum', startX + 330, y + 4);
          doc.text('Bildirim Tarihi', startX + 375, y + 4);
          doc.text('Süre (Saat)', startX + 465, y + 4, { align: 'right', width: 53 });

          y += 16;
          doc.moveTo(startX, y).lineTo(startX + pageWidth, y).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
          y += 2;

          setFont(false);
          doc.fontSize(8);

          const displayFaults = data.allFaults.slice(0, 40);
          for (let i = 0; i < displayFaults.length; i++) {
            const f = displayFaults[i];
            ensureSpace(18);

            if (i % 2 === 1) {
              doc.rect(startX, y, pageWidth, 17).fill('#f8fafc');
            }

            doc.fillColor('#0f172a').text(`#${f.id}`, startX + 4, y + 4, { width: 28, lineBreak: false });
            
            const locDev = f.cihaz_kodu ? `${f.lokasyon_adi} (${f.cihaz_kodu})` : (f.kiosk_kodu ? `${f.lokasyon_adi} (${f.kiosk_kodu})` : f.lokasyon_adi);
            PdfReportBuilder.drawCopyableTextCell(doc, locDev || '', startX + 36, y + 4, 21);
            PdfReportBuilder.drawCopyableTextCell(doc, f.ariza_metni || '', startX + 175, y + 4, 24);

            setFont(true);
            const statusLabel = f.durum === 'COZULDU' ? 'ÇÖZÜLDÜ' : 'BEKLİYOR';
            const statusColor = f.durum === 'COZULDU' ? '#166534' : '#991b1b';
            doc.fillColor(statusColor).text(statusLabel, startX + 330, y + 4, { width: 42, lineBreak: false });
            setFont(false);

            const bTarih = f.bildirim_zamani ? f.bildirim_zamani.slice(0, 16) : '-';
            doc.fillColor('#475569').text(bTarih, startX + 375, y + 4, { width: 85, lineBreak: false });

            const sureStr = f.cozum_suresi_saat != null ? `${f.cozum_suresi_saat} sa` : '-';
            doc.fillColor('#64748b').text(sureStr, startX + 465, y + 4, { align: 'right', width: 53, lineBreak: false });

            y += 17;
          }
          doc.moveTo(startX, y).lineTo(startX + pageWidth, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        }

        // Corporate Footer
        const range = doc.bufferedPageRange();
        const totalPages = range.count;

        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          doc.page.margins.bottom = 0;
          doc.moveTo(startX, 810).lineTo(startX + pageWidth, 810).strokeColor('#cbd5e1').lineWidth(0.5).stroke();

          setFont(false);
          doc.fontSize(7.5).fillColor('#64748b');
          doc.text('Kayseri Ulaşım A.Ş. Bilgi İşlem Müdürlüğü  •  Kurumsal Saha Operasyon Raporu', startX, 816, { width: 380, lineBreak: false });
          doc.text(`Sayfa ${i + 1} / ${totalPages}`, startX + 380, 816, { align: 'right', width: 143, lineBreak: false });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
