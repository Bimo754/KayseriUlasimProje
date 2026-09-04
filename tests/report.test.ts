import request from 'supertest';
import { createApp } from '../src/server';
import { getDb } from '../src/database/db';
import { initDatabase } from '../src/database/schema';
import { ReportService } from '../src/services/report.service';
import { Role } from '../src/constants';

let app: any;

beforeAll(() => {
  initDatabase(':memory:');
  app = createApp();
});

describe('PDF ve Excel Rapor Servisi ile REST API Testleri (Report System)', () => {
  let createdReportId: number;

  test('1. ReportService.generateReport birim testi (PDF + Excel İkili Paket)', async () => {
    const res = await ReportService.generateReport({
      rapor_basligi: 'Birim Test Operasyon Raporu',
      tarih_araligi: 'BU_AY',
      kapsam: 'TUM_SISTEM',
      rapor_formati: 'HEPSI',
      olusturan_kullanici: 'admin'
    });

    expect(res).toHaveProperty('id');
    expect(res.id).toBeGreaterThan(0);
    expect(res.rapor_basligi).toBe('Birim Test Operasyon Raporu');
    expect(res.dosya_boyutu).toBeGreaterThan(0);

    // Verify PDF Buffer
    expect(res.pdfBuffer).toBeDefined();
    expect(Buffer.isBuffer(res.pdfBuffer)).toBe(true);
    expect(res.pdfBuffer!.length).toBeGreaterThan(100);

    // Verify Excel Buffer
    expect(res.excelBuffer).toBeDefined();
    expect(Buffer.isBuffer(res.excelBuffer)).toBe(true);
    expect(res.excelBuffer!.length).toBeGreaterThan(100);

    // Verify Analytics Summary Object
    expect(res.ozet).toHaveProperty('kronik_noktalar');
    expect(res.ozet).toHaveProperty('aylik_dagilim');
    expect(Array.isArray(res.ozet.kronik_noktalar)).toBe(true);
    expect(Array.isArray(res.ozet.aylik_dagilim)).toBe(true);

    createdReportId = res.id;
  });

  test('2. ReportService.generateReport Sadece Kiosklar ve Excel testi', async () => {
    const kioskReport = await ReportService.generateReport({
      rapor_basligi: 'Sadece 105 Kiosk Analiz Raporu',
      tarih_araligi: 'TUMU',
      kapsam: 'SADECE_KIOSKLAR',
      rapor_formati: 'EXCEL',
      olusturan_kullanici: 'admin'
    });

    expect(kioskReport.id).toBeGreaterThan(0);
    expect(kioskReport.excelBuffer).toBeDefined();
    expect(kioskReport.excelBuffer!.length).toBeGreaterThan(100);
    expect(kioskReport.kapsam).toBe('SADECE_KIOSKLAR');
  });

  test('3. ReportService.getAllReports ve getReportById birim testi', () => {
    const reports = ReportService.getAllReports();
    expect(Array.isArray(reports)).toBe(true);
    expect(reports.length).toBeGreaterThanOrEqual(2);

    const single = ReportService.getReportById(createdReportId);
    expect(single).not.toBeNull();
    expect(single.id).toBe(createdReportId);
    expect(single.pdf_veri).toBeDefined();
    expect(single.excel_veri).toBeDefined();
  });

  test('4. Giriş yapmamış kullanıcı /api/raporlar erişimi engellenmeli (403)', async () => {
    const res = await request(app).get('/api/raporlar');
    expect(res.status).toBe(403);
    expect(res.body.basarili).toBe(false);
  });

  test('5. OPERATOR (saha) rolündeki kullanıcı /api/raporlar erişimi yetkisiz olmalı (403)', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/giris')
      .send({ kullanici_adi: 'saha', sifre: 'saha123' });

    const res = await agent.get('/api/raporlar');
    expect(res.status).toBe(403);
    expect(res.body.basarili).toBe(false);
  });

  test('6. ADMIN kullanıcı PDF ve Excel raporu üretebilmeli ve indirebilmeli (200 / 201)', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/giris')
      .send({ kullanici_adi: 'admin', sifre: 'admin123' });

    // GET List
    const listRes = await agent.get('/api/raporlar');
    expect(listRes.status).toBe(200);
    expect(listRes.body.basarili).toBe(true);
    expect(Array.isArray(listRes.body.raporlar)).toBe(true);

    // POST Create Report (PDF + Excel İkili Paket)
    const createRes = await agent
      .post('/api/raporlar/olustur')
      .send({
        rapor_basligi: 'API Test Raporu',
        tarih_araligi: 'BUGUN',
        kapsam: 'TUM_SISTEM',
        rapor_formati: 'HEPSI'
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.basarili).toBe(true);
    expect(createRes.body.rapor).toHaveProperty('id');
    expect(createRes.body.rapor).toHaveProperty('excel_download_url');
    const newId = createRes.body.rapor.id;

    // GET Download PDF
    const downloadPdfRes = await agent
      .get(`/api/raporlar/${newId}/indir`)
      .responseType('blob');
    expect(downloadPdfRes.status).toBe(200);
    expect(downloadPdfRes.header['content-type']).toBe('application/pdf');
    expect(downloadPdfRes.body.length).toBeGreaterThan(100);

    // GET Download Excel (.xlsx)
    const downloadExcelRes = await agent
      .get(`/api/raporlar/${newId}/indir-excel`)
      .responseType('blob');
    expect(downloadExcelRes.status).toBe(200);
    expect(downloadExcelRes.header['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(downloadExcelRes.body.length).toBeGreaterThan(100);

    // DELETE Report
    const delRes = await agent.delete(`/api/raporlar/${newId}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.basarili).toBe(true);
  });
});
