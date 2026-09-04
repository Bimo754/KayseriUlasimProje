import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { MaintenanceService } from '../services/maintenance.service';

export const maintenanceRouter = Router();

/**
 * Persists a generated maintenance report & Excel buffer to the database.
 */
function saveMaintenanceReportToDb(title: string, scope: string, username: string, ozet: any, excelBuffer: Buffer): number {
  const db = getDb();
  const timestampStr = new Date().toISOString().replace(/[-:T\.]/g, '').slice(0, 14);
  const fileName = `${title.replace(/[^a-zA-Z0-9_]/g, '_')}_${timestampStr}.xlsx`;
  const fileSize = excelBuffer.length;
  const ozetJson = JSON.stringify(ozet);

  const insertStmt = db.prepare(`
    INSERT INTO raporlar (
      rapor_basligi, olusturan_kullanici, tarih_araligi, kapsam, dosya_adi, 
      dosya_boyutu, pdf_veri, excel_veri, rapor_formati, ozet_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insertStmt.run(
    title,
    username,
    'TUMU',
    scope,
    fileName,
    fileSize,
    Buffer.from([]),
    excelBuffer,
    'EXCEL',
    ozetJson
  );

  return Number(result.lastInsertRowid);
}

/**
 * POST /api/bakim/planla-kiosk
 * Tüm 105 Otomatik Kiosk için 10 Algoritmalı Ensemble Optimizasyonu (TSP 2-Opt) ile periyodik bakım planı üretir.
 */
maintenanceRouter.post('/planla-kiosk', async (req: Request, res: Response) => {
  try {
    const { startLat, startLon, startLocationType, imei } = req.body || {};
    const targetImei = imei || (startLocationType !== 'DEPOT' && startLocationType !== 'CAR' ? startLocationType : undefined);
    const startMode: 'CAR' | 'DEPOT' = startLocationType === 'DEPOT' ? 'DEPOT' : 'CAR';
    const plan = await MaintenanceService.planKioskMaintenance(startLat, startLon, startMode, targetImei);

    const excelBuffer = await MaintenanceService.generateMaintenanceExcelBuffer(plan);
    const username = (req as any).session?.user?.kullanici_adi || 'admin';
    const reportId = saveMaintenanceReportToDb(plan.baslik, 'SADECE_KIOSKLAR', username, plan, excelBuffer);

    plan.excel_download_url = `/api/raporlar/${reportId}/indir-excel`;

    return res.json({
      basarili: true,
      mesaj: 'Tüm Otomatik Kiosklar periyodik bakım rota planı başarıyla oluşturuldu.',
      plan,
      rapor_id: reportId,
      excel_download_url: plan.excel_download_url
    });
  } catch (err: any) {
    console.error('Kiosk bakım planlama hatası:', err);
    return res.status(500).json({ basarili: false, mesaj: 'Kiosk bakım planı oluşturulurken hata oluştu: ' + err.message });
  }
});

/**
 * POST /api/bakim/planla-turnike
 * Turnikeleri tramvay hatlarına göre istasyon istasyon periyodik bakım planı olarak sıralar.
 */
maintenanceRouter.post('/planla-turnike', async (req: Request, res: Response) => {
  try {
    const { lineFilter, startLat, startLon, startLocationType, imei } = req.body || {};
    const targetImei = imei || (startLocationType !== 'DEPOT' && startLocationType !== 'CAR' ? startLocationType : undefined);
    const startMode: 'CAR' | 'DEPOT' = startLocationType === 'DEPOT' ? 'DEPOT' : 'CAR';
    const plan = await MaintenanceService.planTurnikeMaintenance(lineFilter, startLat, startLon, startMode, targetImei);

    const excelBuffer = await MaintenanceService.generateMaintenanceExcelBuffer(plan);
    const username = (req as any).session?.user?.kullanici_adi || 'admin';
    const reportId = saveMaintenanceReportToDb(plan.baslik, 'TUM_SISTEM', username, plan, excelBuffer);

    plan.excel_download_url = `/api/raporlar/${reportId}/indir-excel`;

    return res.json({
      basarili: true,
      mesaj: 'Turnike periyodik bakım rota planı başarıyla oluşturuldu.',
      plan,
      rapor_id: reportId,
      excel_download_url: plan.excel_download_url
    });
  } catch (err: any) {
    console.error('Turnike bakım planlama hatası:', err);
    return res.status(500).json({ basarili: false, mesaj: 'Turnike bakım planı oluşturulurken hata oluştu: ' + err.message });
  }
});
