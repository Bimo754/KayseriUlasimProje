import { Router, Request, Response } from 'express';
import { DeviceService } from '../services/device.service';
import { SystemSyncService } from '../services/system-sync.service';
import { adminRequired } from '../middlewares/auth.middleware';

export const deviceRouter = Router();

// =========================================================================
// İSTASYON CİHAZ İŞLEMLERİ
// =========================================================================

deviceRouter.post('/cihaz/ekle', adminRequired, (req: Request, res: Response) => {
  const { istasyon_kodu, cihaz_turu, cihaz_no, tur_etiket, aciklama, sorumluluk, durum } = req.body || {};
  const username = (req.session as any)?.kullanici?.kullanici_adi || 'admin';

  const result = DeviceService.addStationDevice(
    istasyon_kodu,
    cihaz_turu,
    cihaz_no || 1,
    tur_etiket,
    aciklama || '',
    sorumluluk || 'DAHILI',
    durum || 'NORMAL',
    username
  );

  if (result.basarili) {
    SystemSyncService.notifyChange();
  }
  res.json(result);
});

deviceRouter.put('/cihaz/guncelle/:deviceCode', adminRequired, (req: Request, res: Response) => {
  const deviceCode = req.params.deviceCode as string;
  const { tur_etiket, aciklama, sorumluluk, durum } = req.body || {};
  const username = (req.session as any)?.kullanici?.kullanici_adi || 'admin';

  const result = DeviceService.updateStationDevice(
    deviceCode,
    tur_etiket,
    aciklama || '',
    sorumluluk || 'DAHILI',
    durum || 'NORMAL',
    username
  );

  if (result.basarili) {
    SystemSyncService.notifyChange();
  }
  res.json(result);
});

deviceRouter.delete('/cihaz/sil/:deviceCode', adminRequired, (req: Request, res: Response) => {
  const deviceCode = req.params.deviceCode as string;
  const username = (req.session as any)?.kullanici?.kullanici_adi || 'admin';

  const result = DeviceService.deleteStationDevice(deviceCode, username);
  if (result.basarili) {
    SystemSyncService.notifyChange();
  }
  res.json(result);
});

deviceRouter.post('/cihaz/yer-degistir', adminRequired, (req: Request, res: Response) => {
  const { cihaz_kodu, hedef_istasyon_kodu } = req.body || {};
  const username = (req.session as any)?.kullanici?.kullanici_adi || 'admin';

  const result = DeviceService.relocateStationDevice(cihaz_kodu, hedef_istasyon_kodu, username);
  if (result.basarili) {
    SystemSyncService.notifyChange();
  }
  res.json(result);
});

// =========================================================================
// OTOMATİK KİOSK İŞLEMLERİ
// =========================================================================

deviceRouter.post('/kiosk/ekle', adminRequired, (req: Request, res: Response) => {
  const { ad, enlem, boylam, adres, sorumluluk, durum } = req.body || {};
  const username = (req.session as any)?.kullanici?.kullanici_adi || 'admin';

  const result = DeviceService.addKiosk(ad, enlem, boylam, adres || '', sorumluluk || 'DAHILI', durum || 'NORMAL', username);
  if (result.basarili) {
    SystemSyncService.notifyChange();
  }
  res.json(result);
});

deviceRouter.put('/kiosk/guncelle/:kioskCode', adminRequired, (req: Request, res: Response) => {
  const kioskCode = req.params.kioskCode as string;
  const { ad, enlem, boylam, adres, sorumluluk, durum } = req.body || {};
  const username = (req.session as any)?.kullanici?.kullanici_adi || 'admin';

  const result = DeviceService.updateKiosk(
    kioskCode,
    ad,
    enlem,
    boylam,
    adres || '',
    sorumluluk || 'DAHILI',
    durum || 'NORMAL',
    username
  );
  if (result.basarili) {
    SystemSyncService.notifyChange();
  }
  res.json(result);
});

deviceRouter.delete('/kiosk/sil/:kioskCode', adminRequired, (req: Request, res: Response) => {
  const kioskCode = req.params.kioskCode as string;
  const username = (req.session as any)?.kullanici?.kullanici_adi || 'admin';

  const result = DeviceService.deleteKiosk(kioskCode, username);
  if (result.basarili) {
    SystemSyncService.notifyChange();
  }
  res.json(result);
});

deviceRouter.post('/kiosk/takas', adminRequired, (req: Request, res: Response) => {
  const { kiosk_1, kiosk_2 } = req.body || {};
  const username = (req.session as any)?.kullanici?.kullanici_adi || 'admin';

  const result = DeviceService.swapKiosks(kiosk_1, kiosk_2, username);
  if (result.basarili) {
    SystemSyncService.notifyChange();
  }
  res.json(result);
});

// =========================================================================
// PASİF CİHAZ VE İSTASYON YÖNETİMİ UÇ NOKTALARI
// =========================================================================

deviceRouter.get('/pasif-elemanlar', (_req: Request, res: Response) => {
  const result = DeviceService.getDisabledItems();
  res.json(result);
});

deviceRouter.post('/istasyon/durum-degistir', (req: Request, res: Response) => {
  const { istasyon_id, aktif } = req.body || {};
  const username = (req.session as any)?.kullanici?.kullanici_adi || 'admin';

  const result = DeviceService.toggleStationStatus(istasyon_id, Boolean(aktif), username);
  if (result.basarili) {
    SystemSyncService.notifyChange();
  }
  res.json(result);
});

deviceRouter.post('/kiosk/durum-degistir', (req: Request, res: Response) => {
  const { kiosk_id, aktif } = req.body || {};
  const username = (req.session as any)?.kullanici?.kullanici_adi || 'admin';

  const result = DeviceService.toggleKioskStatus(kiosk_id, Boolean(aktif), username);
  if (result.basarili) {
    SystemSyncService.notifyChange();
  }
  res.json(result);
});
