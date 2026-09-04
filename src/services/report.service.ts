import { ReportAnalyticsService } from './reports/report-analytics.service';
import { ExcelReportBuilder, getPriorityLabel } from './reports/excel-report.builder';
import { PdfReportBuilder } from './reports/pdf-report.builder';
import { ReportDbService, SavedReportRecord } from './reports/report-db.service';

export interface ReportCreateParams {
  rapor_basligi?: string;
  tarih_araligi?: string; // 'TUMU' | 'BUGUN' | 'SON_7_GUN' | 'SON_30_GUN' | 'BU_AY'
  kapsam?: string;       // 'TUM_SISTEM' | 'SADECE_KIOSKLAR' | 'SADECE_COZULENLER' | 'SADECE_BEKLEYENLER'
  rapor_formati?: string; // 'PDF' | 'EXCEL' | 'HEPSI'
  olusturan_kullanici: string;
}

export class ReportService {
  /**
   * Helper to return priority label string.
   */
  public static getPriorityLabel(pScore?: number | null): string {
    return getPriorityLabel(pScore);
  }

  /**
   * Primary entry point: Generates PDF and/or Excel report, persists to DB, and returns details.
   */
  public static async generateReport(params: ReportCreateParams): Promise<SavedReportRecord> {
    // 1. Analytics & Query Aggregation
    const payload = ReportAnalyticsService.collectAnalytics(params);

    // 2. Report Document Generation (PDF / Excel)
    let pdfBuf: Buffer | undefined;
    let excelBuf: Buffer | undefined;

    if (payload.format === 'PDF' || payload.format === 'HEPSI') {
      pdfBuf = await PdfReportBuilder.buildPdfBuffer(payload);
    }

    if (payload.format === 'EXCEL' || payload.format === 'HEPSI') {
      excelBuf = await ExcelReportBuilder.generateExcelBuffer(payload);
    }

    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:\.]/g, '-').slice(0, 19);
    const baseFileName = `Kayseri_Ulasim_Rapor_${timestampStr}`;
    const fileName = payload.format === 'EXCEL' ? `${baseFileName}.xlsx` : `${baseFileName}.pdf`;
    const primaryBuffer = pdfBuf || excelBuf || Buffer.from([]);
    const fileSize = primaryBuffer.length;

    // 3. Database Persistence
    return ReportDbService.saveReport({
      title: payload.title,
      username: payload.username,
      dateRange: payload.dateRange,
      scope: payload.scope,
      format: payload.format,
      fileName,
      fileSize,
      pdfBuf,
      excelBuf,
      summaryMetrics: payload.summary
    });
  }

  /**
   * Retrieves summary metadata for all reports in database.
   */
  public static getAllReports(): any[] {
    return ReportDbService.getAllReports();
  }

  /**
   * Retrieves single report record by ID (including binary data).
   */
  public static getReportById(id: number): any | null {
    return ReportDbService.getReportById(id);
  }

  /**
   * Deletes a report record from database.
   */
  public static deleteReport(id: number): boolean {
    return ReportDbService.deleteReport(id);
  }

  /**
   * Direct delegate for Excel buffer generation.
   */
  public static async generateExcelBuffer(data: any): Promise<Buffer> {
    return ExcelReportBuilder.generateExcelBuffer(data);
  }
}
