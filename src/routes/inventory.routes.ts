import { Router, Request, Response } from 'express';
import { InventoryService } from '../services/inventory.service';
import { LocationService } from '../services/location.service';

export const inventoryRouter = Router();

inventoryRouter.get('/tum-veri', (_req: Request, res: Response) => {
  const data = InventoryService.getAllSystemData();
  res.json(data);
});

inventoryRouter.get('/ana-us', (_req: Request, res: Response) => {
  const data = InventoryService.getAnaUs();
  res.json(data);
});

inventoryRouter.get('/en-yakin-noktalar', (req: Request, res: Response): any => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);
  const limit = parseInt((req.query.limit as string) || '3', 10);
  const excludeId = (req.query.exclude_id as string) || null;

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ hata: 'Geçersiz koordinatlar' });
  }

  const points = LocationService.getNearestPoints(lat, lon, limit, excludeId);
  return res.json(points);
});

inventoryRouter.post('/mesafe-hesapla', (req: Request, res: Response): any => {
  const { lat1, lon1, lat2, lon2 } = req.body || {};

  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return res.status(400).json({ hata: 'Geçersiz koordinat parametreleri' });
  }

  const resData = LocationService.estimateDriveRoute(
    parseFloat(lat1),
    parseFloat(lon1),
    parseFloat(lat2),
    parseFloat(lon2)
  );
  return res.json(resData);
});
