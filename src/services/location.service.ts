import { getDb } from '../database/db';

export interface LocationPoint {
  id: string;
  ad: string;
  tip: string;
  tip_etiket: string;
  adres?: string;
  enlem: number;
  boylam: number;
  mesafe_km: number;
}

export class LocationService {
  public static calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
      return 0.0;
    }

    const R = 6371.0;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2.0) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2.0) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }

  public static estimateDriveRoute(lat1: number, lon1: number, lat2: number, lon2: number) {
    const kusUcusu = LocationService.calculateHaversine(lat1, lon1, lat2, lon2);
    const tahminiKarayoluKm = parseFloat((kusUcusu * 1.35).toFixed(2));
    const tahminiSureDk = Math.round((tahminiKarayoluKm / 35.0) * 60);

    return {
      kus_ucusu_km: kusUcusu,
      tahmini_karayolu_km: tahminiKarayoluKm,
      tahmini_sure_dakika: Math.max(2, tahminiSureDk)
    };
  }

  public static getNearestPoints(lat: number, lon: number, limit = 3, excludeId?: string | null): LocationPoint[] {
    const db = getDb();
    const points: LocationPoint[] = [];

    // 1. Istasyonlar
    const stations = db.prepare(`
      SELECT istasyon_kodu as id, ad, 'ISTASYON' as tip, enlem, boylam FROM istasyonlar
    `).all() as any[];

    for (const st of stations) {
      if (excludeId && st.id === excludeId) continue;
      const dist = LocationService.calculateHaversine(lat, lon, st.enlem, st.boylam);
      points.push({
        id: st.id,
        ad: st.ad,
        tip: st.tip,
        tip_etiket: 'Tramvay İstasyonu',
        enlem: st.enlem,
        boylam: st.boylam,
        mesafe_km: dist
      });
    }

    // 2. Kiosklar
    const kiosks = db.prepare(`
      SELECT kiosk_kodu as id, ad, 'KIOSK' as tip, enlem, boylam, adres FROM otomatik_kiosklar
    `).all() as any[];

    for (const k of kiosks) {
      if (excludeId && k.id === excludeId) continue;
      const dist = LocationService.calculateHaversine(lat, lon, k.enlem, k.boylam);
      points.push({
        id: k.id,
        ad: k.ad,
        tip: k.tip,
        tip_etiket: 'Otomatik Kiosk',
        adres: k.adres,
        enlem: k.enlem,
        boylam: k.boylam,
        mesafe_km: dist
      });
    }

    points.sort((a, b) => a.mesafe_km - b.mesafe_km);
    return points.slice(0, limit);
  }
}
