import { Router, Request, Response } from 'express';
import { adminRequired } from '../middlewares/auth.middleware';
import { ReportService } from '../services/report.service';

export const reportRouter = Router();

// Protect all report endpoints with adminRequired middleware
reportRouter.use(adminRequired);

/**
 * GET /api/raporlar
 * Returns metadata list of all generated reports saved in database.
 */
reportRouter.get('/', (_req: Request, res: Response) => {
  try {
    const reports = ReportService.getAllReports();
    return res.json({
      basarili: true,
      toplam: reports.length,
      raporlar: reports
    });
  } catch (error: any) {
    return res.status(500).json({ basarili: false, mesaj: `Raporlar alınamadı: ${error.message}` });
  }
});

/**
 * POST /api/raporlar/olustur
 * Generates a new PDF and/or Excel system report and archives it in database.
 */
reportRouter.post('/olustur', async (req: Request, res: Response) => {
  try {
    const user = (req.session as any)?.kullanici;
    const username = user?.kullanici_adi || 'admin';
    const { rapor_basligi, tarih_araligi, kapsam, rapor_formati } = req.body || {};

    const reportResult = await ReportService.generateReport({
      rapor_basligi,
      tarih_araligi,
      kapsam,
      rapor_formati,
      olusturan_kullanici: username
    });

    const isExcelOnly = reportResult.rapor_formati === 'EXCEL';

    return res.status(201).json({
      basarili: true,
      mesaj: `${reportResult.rapor_formati} formatındaki sistem raporu başarıyla oluşturuldu ve kaydedildi.`,
      rapor: {
        id: reportResult.id,
        rapor_basligi: reportResult.rapor_basligi,
        olusturan_kullanici: reportResult.olusturan_kullanici,
        tarih_araligi: reportResult.tarih_araligi,
        kapsam: reportResult.kapsam,
        rapor_formati: reportResult.rapor_formati,
        dosya_adi: reportResult.dosya_adi,
        dosya_boyutu: reportResult.dosya_boyutu,
        ozet: reportResult.ozet,
        download_url: isExcelOnly ? `/api/raporlar/${reportResult.id}/indir-excel` : `/api/raporlar/${reportResult.id}/indir`,
        excel_download_url: `/api/raporlar/${reportResult.id}/indir-excel`
      }
    });
  } catch (error: any) {
    return res.status(500).json({ basarili: false, mesaj: `Rapor oluşturulurken hata oluştu: ${error.message}` });
  }
});

/**
 * GET /api/raporlar/:id/indir
 * Streams/downloads the generated PDF file from database BLOB.
 */
reportRouter.get('/:id/indir', (req: Request, res: Response) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reportId = parseInt(rawId, 10);
    if (isNaN(reportId)) {
      return res.status(400).json({ basarili: false, mesaj: 'Geçersiz rapor ID.' });
    }

    const report = ReportService.getReportById(reportId);
    if (!report) {
      return res.status(404).json({ basarili: false, mesaj: 'İstenen rapor veritabanında bulunamadı.' });
    }

    if (!report.pdf_veri) {
      // If report was created excel-only, auto-redirect to excel download
      if (report.excel_veri) {
        return res.redirect(`/api/raporlar/${reportId}/indir-excel`);
      }
      return res.status(404).json({ basarili: false, mesaj: 'Bu raporda PDF verisi bulunmamaktadır.' });
    }

    const pdfBuffer = Buffer.from(report.pdf_veri);
    const pdfFileName = report.dosya_adi.endsWith('.pdf') ? report.dosya_adi : `${report.dosya_adi.replace(/\.[^/.]+$/, '')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(pdfFileName)}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.send(pdfBuffer);
  } catch (error: any) {
    return res.status(500).json({ basarili: false, mesaj: `Rapor indirme hatası: ${error.message}` });
  }
});

/**
 * GET /api/raporlar/:id/indir-excel
 * Streams/downloads the generated Excel (.xlsx) file from database BLOB.
 */
reportRouter.get('/:id/indir-excel', async (req: Request, res: Response) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reportId = parseInt(rawId, 10);
    if (isNaN(reportId)) {
      return res.status(400).json({ basarili: false, mesaj: 'Geçersiz rapor ID.' });
    }

    const report = ReportService.getReportById(reportId);
    if (!report) {
      return res.status(404).json({ basarili: false, mesaj: 'İstenen rapor veritabanında bulunamadı.' });
    }

    let excelBuffer: Buffer;
    if (report.excel_veri) {
      excelBuffer = Buffer.from(report.excel_veri);
    } else {
      // On demand Excel generation if report was originally created PDF-only!
      excelBuffer = await ReportService.generateExcelBuffer({
        title: report.rapor_basligi,
        dateRange: report.tarih_araligi,
        scope: report.kapsam,
        username: report.olusturan_kullanici,
        summary: report.ozet,
        allFaults: [],
        resolvedFaults: [],
        pendingFaults: [],
        kioskFaults: [],
        kioskAnalyticsList: [],
        movements: [],
        recurrentLocations: report.ozet.kronik_noktalar || [],
        monthlyDistribution: report.ozet.aylik_dagilim || []
      });
    }

    const baseName = report.dosya_adi.replace(/\.[^/.]+$/, '');
    const excelFileName = `${baseName}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(excelFileName)}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    return res.send(excelBuffer);
  } catch (error: any) {
    return res.status(500).json({ basarili: false, mesaj: `Excel indirme hatası: ${error.message}` });
  }
});

/**
 * DELETE /api/raporlar/:id
 * Deletes report record from database.
 */
reportRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reportId = parseInt(rawId, 10);
    if (isNaN(reportId)) {
      return res.status(400).json({ basarili: false, mesaj: 'Geçersiz rapor ID.' });
    }

    const success = ReportService.deleteReport(reportId);
    if (!success) {
      return res.status(404).json({ basarili: false, mesaj: 'Silinecek rapor bulunamadı.' });
    }

    return res.json({ basarili: true, mesaj: 'Rapor veritabanından başarıyla silindi.' });
  } catch (error: any) {
    return res.status(500).json({ basarili: false, mesaj: `Rapor silinirken hata oluştu: ${error.message}` });
  }
});
