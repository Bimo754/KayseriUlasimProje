import { Router, Request, Response } from 'express';
import { FaultService } from '../services/fault.service';
import { RoutingService } from '../services/routing.service';
import { SystemSyncService } from '../services/system-sync.service';

export const routingRouter = Router();

routingRouter.get('/arizalar', (req: Request, res: Response) => {
  const status = (req.query.durum as string) || 'BEKLIYOR';
  const faults = FaultService.getAllFaults(status);
  res.json({
    basarili: true,
    toplam_ariza_sayisi: faults.length,
    arizalar: faults
  });
});

routingRouter.post('/ariza/ekle', (req: Request, res: Response): any => {
  const { lokasyon_adi, ariza_metni, ariza_tipi, cihaz_id, kiosk_id, sorumluluk } = req.body || {};

  if (!lokasyon_adi || !ariza_metni) {
    return res.status(400).json({ basarili: false, mesaj: 'Lokasyon adı ve arıza metni zorunludur.' });
  }

  const faultId = FaultService.addFault(
    lokasyon_adi,
    ariza_metni,
    ariza_tipi || 'GENEL',
    cihaz_id || null,
    kiosk_id || null,
    sorumluluk || 'DAHILI'
  );

  SystemSyncService.notifyChange();
  return res.json({
    basarili: true,
    ariza_id: faultId,
    mesaj: `${lokasyon_adi} için arıza kaydı başarıyla oluşturuldu.`
  });
});

routingRouter.post('/ariza/metin-ayristir', (req: Request, res: Response): any => {
  const { metin } = req.body || {};

  if (!metin) {
    return res.status(400).json({ basarili: false, mesaj: 'Lütfen ayrıştırılacak arıza metnini giriniz.' });
  }

  const result = FaultService.parseBulkText(metin);
  SystemSyncService.notifyChange();
  return res.json(result);
});

const updateFaultHandler = (req: Request, res: Response) => {
  const arizaId = parseInt(req.params.arizaId as string, 10);
  const { durum } = req.body || {};
  const newStatus = durum || 'COZULDU';

  FaultService.updateFaultStatus(arizaId, newStatus);

  SystemSyncService.notifyChange();
  res.json({
    basarili: true,
    mesaj: `Arıza durumu "${newStatus}" olarak güncellendi.`
  });
};

routingRouter.post('/ariza/durum-guncelle/:arizaId', updateFaultHandler);
routingRouter.put('/ariza/durum-guncelle/:arizaId', updateFaultHandler);

const deleteFaultHandler = (req: Request, res: Response): any => {
  const arizaId = parseInt(req.params.arizaId as string, 10);
  const basarili = FaultService.deleteFault(arizaId);

  if (basarili) {
    SystemSyncService.notifyChange();
    return res.json({ basarili: true, mesaj: 'Arıza kaydı başarıyla silindi.' });
  }
  return res.status(404).json({ basarili: false, mesaj: 'Arıza bulunamadı.' });
};

import { adminRequired } from '../middlewares/auth.middleware';

routingRouter.post('/ariza/sil/:arizaId', adminRequired, deleteFaultHandler);
routingRouter.delete('/ariza/sil/:arizaId', adminRequired, deleteFaultHandler);

routingRouter.post('/ariza/sorumluluk-degistir/:arizaId', (req: Request, res: Response): any => {
  const arizaId = parseInt(req.params.arizaId as string, 10);
  const newResp = FaultService.toggleResponsibility(arizaId);

  if (newResp) {
    SystemSyncService.notifyChange();
    return res.json({
      basarili: true,
      yeni_sorumluluk: newResp,
      mesaj: `Sorumluluk ${newResp} olarak değiştirildi.`
    });
  }
  return res.status(404).json({ basarili: false, mesaj: 'Arıza bulunamadı.' });
});

routingRouter.get('/navigasyon/rota', async (req: Request, res: Response) => {
  const selectedImei = (req.query.imei as string) || (req.query.secili_imei as string) || undefined;
  const dispatchMode = (req.query.mode as any) || (req.query.dagitim_modu as any) || undefined;
  const routeData = await RoutingService.optimizeRoute(selectedImei, dispatchMode);
  res.json(routeData);
});

routingRouter.post('/navigasyon/dagitim-modu', (req: Request, res: Response): any => {
  const { mode } = req.body || {};
  if (mode !== 'DUAL_SPLIT' && mode !== 'SINGLE_VEHICLE') {
    return res.status(400).json({ basarili: false, mesaj: 'Geçersiz dağıtım modu. "DUAL_SPLIT" veya "SINGLE_VEHICLE" olmalıdır.' });
  }

  RoutingService.setDispatchMode(mode);
  SystemSyncService.notifyChange();
  return res.json({
    basarili: true,
    dagitim_modu: mode,
    mesaj: mode === 'DUAL_SPLIT' 
      ? 'Otomatik Araç Paylaşım Modu Aktif (Arızalar 2 Araç Arasında Bölünür)' 
      : 'Tek Araç Odaklı Mod Aktif (Tüm Arızalar Seçili Araca Atanır)'
  });
});

routingRouter.get('/arac/konum', (req: Request, res: Response) => {
  const selectedImei = (req.query.imei as string) || undefined;
  res.json({
    basarili: true,
    secili_imei: selectedImei || RoutingService.getActiveSelectedImei(),
    arac_konumu: RoutingService.getVehiclePosition(selectedImei),
    tum_araclar: RoutingService.getAllVehiclesPosition()
  });
});

routingRouter.post('/arac/konum', (req: Request, res: Response): any => {
  const { enlem, boylam, ad, imei, plaka, hiz } = req.body || {};
  if (enlem == null || boylam == null) {
    return res.status(400).json({ basarili: false, mesaj: 'Enlem ve boylam gereklidir.' });
  }

  const pos = RoutingService.setVehiclePosition(enlem, boylam, ad, null, imei, plaka, hiz);
  SystemSyncService.notifyChange();
  return res.json({
    basarili: true,
    arac_konumu: pos,
    tum_araclar: RoutingService.getAllVehiclesPosition(),
    mesaj: 'Araç GPS konumu güncellendi.'
  });
});

import { GpsTelemetryService } from '../services/gps-telemetry.service';

routingRouter.get('/telemetri/durum', (_req: Request, res: Response) => {
  res.json({
    basarili: true,
    telemetri_durumu: GpsTelemetryService.getStatus()
  });
});

routingRouter.post('/telemetri/proxy', (req: Request, res: Response): any => {
  const { proxy_url } = req.body || {};
  GpsTelemetryService.setProxyUrl(proxy_url || null);
  return res.json({
    basarili: true,
    mesaj: proxy_url ? `Proxy sunucusu ${proxy_url} olarak ayarlandı.` : 'Proxy kullanımı devre dışı bırakıldı.',
    telemetri_durumu: GpsTelemetryService.getStatus()
  });
});

routingRouter.post('/telemetri/oturum-anahtari', (req: Request, res: Response): any => {
  const { oturum_anahtari } = req.body || {};

  if (!oturum_anahtari || !String(oturum_anahtari).trim()) {
    return res.status(400).json({
      basarili: false,
      mesaj: 'Lütfen geçerli bir Oturum Anahtarı (Session Key) giriniz.'
    });
  }

  GpsTelemetryService.setSessionCookie(oturum_anahtari);
  GpsTelemetryService.startPolling();

  return res.json({
    basarili: true,
    mesaj: 'Oturum anahtarı (Session Key) veritabanına kaydedildi ve canlı takip başlatıldı.',
    telemetri_durumu: GpsTelemetryService.getStatus()
  });
});

routingRouter.post('/telemetri/arac-sec', (req: Request, res: Response): any => {
  const { imei } = req.body || {};
  if (!imei) {
    return res.status(400).json({
      basarili: false,
      mesaj: 'Lütfen geçerli bir araç IMEI numarası belirtiniz.'
    });
  }

  try {
    const selectedVehicle = GpsTelemetryService.setTargetImei(imei);
    return res.json({
      basarili: true,
      mesaj: `Seçili araç ${selectedVehicle.plaka} olarak değiştirildi.`,
      telemetri_durumu: GpsTelemetryService.getStatus()
    });
  } catch (err: any) {
    return res.status(400).json({
      basarili: false,
      mesaj: err.message
    });
  }
});

routingRouter.post('/telemetri/baslat', (req: Request, res: Response): any => {
  const { oturum_anahtari, aralik_ms } = req.body || {};

  if (oturum_anahtari && String(oturum_anahtari).trim()) {
    GpsTelemetryService.setSessionCookie(oturum_anahtari);
  }

  const currentCookie = GpsTelemetryService.getSessionCookie();
  if (!currentCookie) {
    return res.status(400).json({
      basarili: false,
      mesaj: 'Canlı akışı başlatmak için geçerli bir Oturum Anahtarı (Session Key) girilmelidir.'
    });
  }

  const pollInterval = aralik_ms ? parseInt(aralik_ms as string, 10) : 5000;
  GpsTelemetryService.startPolling(pollInterval);

  return res.json({
    basarili: true,
    mesaj: `Canlı SignalR GPS akışı başlatıldı.`,
    telemetri_durumu: GpsTelemetryService.getStatus()
  });
});

routingRouter.post('/telemetri/durdur', (_req: Request, res: Response): any => {
  GpsTelemetryService.stopPolling();
  return res.json({
    basarili: true,
    mesaj: 'Canlı GPS telemetri akışı durduruldu.',
    telemetri_durumu: GpsTelemetryService.getStatus()
  });
});


