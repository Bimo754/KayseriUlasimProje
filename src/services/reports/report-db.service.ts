import { getDb } from '../../database/db';

export interface SavedReportRecord {
  id: number;
  rapor_basligi: string;
  olusturan_kullanici: string;
  tarih_araligi: string;
  kapsam: string;
  rapor_formati: string;
  dosya_adi: string;
  dosya_boyutu: number;
  ozet: any;
  pdfBuffer?: Buffer;
  excelBuffer?: Buffer;
}

export class ReportDbService {
  /**
   * Persists a newly generated report (with binary buffers) into SQLite database.
   */
  public static saveReport(params: {
    title: string;
    username: string;
    dateRange: string;
    scope: string;
    format: string;
    fileName: string;
    fileSize: number;
    pdfBuf?: Buffer;
    excelBuf?: Buffer;
    summaryMetrics: any;
  }): SavedReportRecord {
    const db = getDb();
    const ozetJson = JSON.stringify(params.summaryMetrics);

    const insertStmt = db.prepare(`
      INSERT INTO raporlar (
        rapor_basligi, olusturan_kullanici, tarih_araligi, kapsam, dosya_adi, 
        dosya_boyutu, pdf_veri, excel_veri, rapor_formati, ozet_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      params.title,
      params.username,
      params.dateRange,
      params.scope,
      params.fileName,
      params.fileSize,
      params.pdfBuf || Buffer.from([]),
      params.excelBuf || Buffer.from([]),
      params.format,
      ozetJson
    );

    const reportId = Number(result.lastInsertRowid);

    return {
      id: reportId,
      rapor_basligi: params.title,
      olusturan_kullanici: params.username,
      tarih_araligi: params.dateRange,
      kapsam: params.scope,
      rapor_formati: params.format,
      dosya_adi: params.fileName,
      dosya_boyutu: params.fileSize,
      ozet: params.summaryMetrics,
      pdfBuffer: params.pdfBuf,
      excelBuffer: params.excelBuf
    };
  }

  /**
   * Retrieves summary metadata for all reports in database.
   */
  public static getAllReports(): any[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT 
        id, rapor_basligi, olusturan_kullanici, tarih_araligi, kapsam, 
        COALESCE(rapor_formati, 'PDF') as rapor_formati, dosya_adi, dosya_boyutu, 
        ozet_json, olusturulma_tarihi,
        (CASE WHEN pdf_veri IS NOT NULL THEN 1 ELSE 0 END) as has_pdf,
        (CASE WHEN excel_veri IS NOT NULL THEN 1 ELSE 0 END) as has_excel
      FROM raporlar
      ORDER BY olusturulma_tarihi DESC
    `).all() as any[];

    return rows.map(r => ({
      ...r,
      ozet: JSON.parse(r.ozet_json || '{}')
    }));
  }

  /**
   * Retrieves single report record by ID (including binary data).
   */
  public static getReportById(id: number): any | null {
    const db = getDb();
    const report = db.prepare('SELECT * FROM raporlar WHERE id = ?').get(id) as any;
    if (!report) return null;
    return {
      ...report,
      ozet: JSON.parse(report.ozet_json || '{}')
    };
  }

  /**
   * Deletes a report record from database.
   */
  public static deleteReport(id: number): boolean {
    const db = getDb();
    const res = db.prepare('DELETE FROM raporlar WHERE id = ?').run(id);
    return res.changes > 0;
  }
}
