import https from 'https';
import { Config } from '../config';
import { FaultService } from './fault.service';
import { Responsibility } from '../constants';
import { getSavedVehicleTelemetry, saveVehicleTelemetryToDb } from '../database/schema';

export interface VehicleState {
  enlem: number;
  boylam: number;
  ad: string;
  son_guncelleme: string;
  sunucu_zaman?: string | null;
  imei: string;
  plaka: string;
  hiz?: number | null;
}

export type DispatchMode = 'DUAL_SPLIT' | 'SINGLE_VEHICLE';

export class RoutingService {
  private static vehiclesMap: Map<string, VehicleState> = new Map([
    [
      '861000000000001',
      {
        imei: '861000000000001',
        plaka: '38 BKM 001',
        ad: '38 BKM 001 - AUS Arıza ve Bakım Hizmet Aracı',
        enlem: Config.ANA_US_LAT,
        boylam: Config.ANA_US_LON,
        son_guncelleme: new Date().toISOString(),
        sunucu_zaman: null,
        hiz: 0
      }
    ],
    [
      '861000000000002',
      {
        imei: '861000000000002',
        plaka: '38 BKM 002',
        ad: '38 BKM 002 - AUS Arıza ve Bakım Hizmet Aracı',
        enlem: 38.7315,
        boylam: 35.4982,
        son_guncelleme: new Date().toISOString(),
        sunucu_zaman: null,
        hiz: 0
      }
    ]
  ]);

  private static activeSelectedImei: string = '861000000000001';

  public static LEG_COLORS = [
    '#38bdf8',
    '#818cf8',
    '#34d399',
    '#fbbf24',
    '#f472b6',
    '#c084fc',
    '#fb923c',
    '#2dd4bf'
  ];

  /**
   * Veritabanından saklanan son kaydedilen araç konumlarını yükler
   */
  public static loadSavedVehiclesFromDb(): void {
    try {
      const rows = getSavedVehicleTelemetry();
      for (const r of rows) {
        if (r.imei && RoutingService.vehiclesMap.has(r.imei)) {
          const existing = RoutingService.vehiclesMap.get(r.imei)!;
          existing.enlem = r.son_enlem || existing.enlem;
          existing.boylam = r.son_boylam || existing.boylam;
          existing.hiz = r.son_hiz || 0;
          existing.sunucu_zaman = r.son_canli_gps || existing.sunucu_zaman;
          existing.son_guncelleme = r.guncellenme_tarihi || new Date().toISOString();
        }
      }
    } catch (_e) {}
  }

  public static getActiveSelectedImei(): string {
    return RoutingService.activeSelectedImei;
  }

  public static setActiveSelectedImei(imei: string): void {
    if (RoutingService.vehiclesMap.has(imei)) {
      RoutingService.activeSelectedImei = imei;
    }
  }

  public static getVehiclePosition(imei?: string): VehicleState {
    const targetImei = imei || RoutingService.activeSelectedImei;
    const v = RoutingService.vehiclesMap.get(targetImei);
    if (v) return v;
    return RoutingService.vehiclesMap.get('861000000000001')!;
  }

  public static getAllVehiclesPosition(): VehicleState[] {
    return Array.from(RoutingService.vehiclesMap.values());
  }

  public static setVehiclePosition(
    lat: number,
    lon: number,
    label?: string | null,
    serverTime?: string | null,
    imei?: string | null,
    plate?: string | null,
    speed?: number | null
  ): VehicleState {
    const targetImei = imei || '861000000000001';
    let v = RoutingService.vehiclesMap.get(targetImei);

    if (!v) {
      v = {
        imei: targetImei,
        plaka: plate || '38 BKM 001',
        ad: label || `${plate || 'Araç'} - Hizmet Aracı`,
        enlem: parseFloat(lat as any),
        boylam: parseFloat(lon as any),
        son_guncelleme: new Date().toISOString(),
        sunucu_zaman: serverTime || null,
        hiz: speed != null ? speed : 0
      };
      RoutingService.vehiclesMap.set(targetImei, v);
    } else {
      v.enlem = parseFloat(lat as any);
      v.boylam = parseFloat(lon as any);
      if (label) v.ad = label;
      if (serverTime) v.sunucu_zaman = serverTime;
      if (plate) v.plaka = plate;
      if (speed != null) v.hiz = speed;
      v.son_guncelleme = new Date().toISOString();
    }

    // Persist position to SQLite Database
    saveVehicleTelemetryToDb(
      v.imei,
      v.plaka,
      v.ad,
      v.enlem,
      v.boylam,
      v.hiz || 0,
      v.sunucu_zaman || new Date().toISOString()
    );

    return v;
  }

  public static resetVehiclePosition(imei?: string): VehicleState {
    const targetImei = imei || '861000000000001';
    const isPrimary = targetImei === '861000000000001';
    const resetState: VehicleState = {
      imei: targetImei,
      plaka: isPrimary ? '38 BKM 001' : '38 BKM 002',
      ad: isPrimary ? '38 BKM 001 - AUS Arıza ve Bakım Hizmet Aracı' : '38 BKM 002 - AUS Arıza ve Bakım Hizmet Aracı',
      enlem: isPrimary ? Config.ANA_US_LAT : 38.7315,
      boylam: isPrimary ? Config.ANA_US_LON : 35.4982,
      son_guncelleme: new Date().toISOString(),
      sunucu_zaman: null,
      hiz: 0
    };
    RoutingService.vehiclesMap.set(targetImei, resetState);
    return resetState;
  }

  public static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
      return 0.0;
    }
    const R = 6371.0;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }

  private static routeCache: Map<string, { geometry: [number, number][]; mesafe_km: number; sure_dk: number }> = new Map();

  private static currentDispatchMode: DispatchMode = 'DUAL_SPLIT';

  public static getDispatchMode(): DispatchMode {
    return RoutingService.currentDispatchMode;
  }

  public static setDispatchMode(mode: DispatchMode): void {
    if (mode === 'DUAL_SPLIT' || mode === 'SINGLE_VEHICLE') {
      RoutingService.currentDispatchMode = mode;
    }
  }

  public static async optimizeRoute(selectedImei?: string, requestedMode?: DispatchMode): Promise<any> {
    if (requestedMode) {
      RoutingService.setDispatchMode(requestedMode);
    }
    if (selectedImei && RoutingService.vehiclesMap.has(selectedImei)) {
      RoutingService.setActiveSelectedImei(selectedImei);
    }
    const activeImei = RoutingService.getActiveSelectedImei();
    const mode = RoutingService.getDispatchMode();

    const v093 = RoutingService.getVehiclePosition('861000000000001');
    const v089 = RoutingService.getVehiclePosition('861000000000002');

    const allFaults = FaultService.getAllFaults('BEKLIYOR');
    const actionableFaults = allFaults.filter(
      f => f.sorumluluk === Responsibility.DAHILI && f.istasyon_aktif !== false && f.enlem != null && f.boylam != null && f.enlem !== 0
    );

    let res093: any;
    let res089: any;

    if (mode === 'SINGLE_VEHICLE') {
      // Entire load assigned to the active selected car
      if (activeImei === '861000000000002') {
        res089 = await RoutingService.calculateRouteForFaultSubset(v089, actionableFaults, true);
        res093 = await RoutingService.calculateRouteForFaultSubset(v093, [], true);
      } else {
        res093 = await RoutingService.calculateRouteForFaultSubset(v093, actionableFaults, true);
        res089 = await RoutingService.calculateRouteForFaultSubset(v089, [], true);
      }
    } else {
      // DUAL_SPLIT (Default): Partition active faults geographically & workload-wise
      const { v1Faults, v2Faults } = RoutingService.partitionFaultsForVehicles(actionableFaults, v093, v089);
      res093 = await RoutingService.calculateRouteForFaultSubset(v093, v1Faults, true);
      res089 = await RoutingService.calculateRouteForFaultSubset(v089, v2Faults, true);
    }

    const primaryResult = activeImei === '861000000000002' ? res089 : res093;
    const secondaryResult = activeImei === '861000000000002' ? res093 : res089;

    const dualSummaries: Record<string, any> = {
      '861000000000001': {
        imei: v093.imei,
        plaka: v093.plaka,
        ad: v093.ad,
        toplam_durak: res093.toplam_durak,
        toplam_mesafe_km: res093.toplam_mesafe_km,
        toplam_sure_dk: res093.toplam_sure_dk,
        duraklar: res093.duraklar || [],
        bacaklar: res093.bacaklar || [],
        secili: activeImei === '861000000000001'
      },
      '861000000000002': {
        imei: v089.imei,
        plaka: v089.plaka,
        ad: v089.ad,
        toplam_durak: res089.toplam_durak,
        toplam_mesafe_km: res089.toplam_mesafe_km,
        toplam_sure_dk: res089.toplam_sure_dk,
        duraklar: res089.duraklar || [],
        bacaklar: res089.bacaklar || [],
        secili: activeImei === '861000000000002'
      }
    };

    primaryResult.cift_arac_ozeti = dualSummaries;
    primaryResult.secili_imei = activeImei;
    primaryResult.dagitim_modu = mode;
    return primaryResult;
  }

  private static partitionFaultsForVehicles(
    faults: any[],
    v1: VehicleState,
    v2: VehicleState
  ): { v1Faults: any[]; v2Faults: any[] } {
    const v1Faults: any[] = [];
    const v2Faults: any[] = [];

    for (const fault of faults) {
      const d1 = RoutingService.calculateDistance(v1.enlem, v1.boylam, fault.enlem, fault.boylam);
      const d2 = RoutingService.calculateDistance(v2.enlem, v2.boylam, fault.enlem, fault.boylam);

      if (d1 <= d2) {
        v1Faults.push(fault);
      } else {
        v2Faults.push(fault);
      }
    }

    return { v1Faults, v2Faults };
  }

  private static optimizeFaultSetWithEnsemble(faults: any[], vehicle: VehicleState): any[] {
    if (faults.length === 0) return [];
    if (faults.length === 1) return [...faults];

    // Candidate 1: Urgency-First Greedy
    const candidate1 = RoutingService.generateGreedyCandidate(faults, vehicle, 'URGENCY');
    // Candidate 2: Cluster-Density Sweep
    const candidate2 = RoutingService.generateGreedyCandidate(faults, vehicle, 'CLUSTER');
    // Candidate 3: Distance-Minimal Sweep
    const candidate3 = RoutingService.generateGreedyCandidate(faults, vehicle, 'DISTANCE');
    // Candidate 4: Hybrid Balanced
    const candidate4 = RoutingService.generateGreedyCandidate(faults, vehicle, 'HYBRID');

    const candidates = [candidate1, candidate2, candidate3, candidate4];
    const refinedCandidates = candidates.map(c => RoutingService.apply2OptRefinement(c));

    let bestRoute = refinedCandidates[0];
    let minCost = RoutingService.evaluateCandidateCost(bestRoute, vehicle);

    for (let i = 1; i < refinedCandidates.length; i++) {
      const cost = RoutingService.evaluateCandidateCost(refinedCandidates[i], vehicle);
      if (cost < minCost) {
        minCost = cost;
        bestRoute = refinedCandidates[i];
      }
    }

    return bestRoute;
  }

  private static generateGreedyCandidate(faults: any[], vehicle: VehicleState, strategy: 'URGENCY' | 'CLUSTER' | 'DISTANCE' | 'HYBRID'): any[] {
    let currentLat = vehicle.enlem;
    let currentLon = vehicle.boylam;
    const unvisited = faults.map(f => ({ ...f }));
    const ordered: any[] = [];

    while (unvisited.length > 0) {
      let bestCandidate: any = null;
      let bestScore = -Infinity;

      for (const candidate of unvisited) {
        const airDist = RoutingService.calculateDistance(currentLat, currentLon, candidate.enlem, candidate.boylam);
        const estRoadKm = parseFloat((airDist * 1.35).toFixed(2));
        let score = 0;

        if (strategy === 'URGENCY') {
          score = (candidate.oncelik_puani || 50) * 2.0 - 0.8 * estRoadKm;
        } else if (strategy === 'CLUSTER') {
          score = 25.0 * (candidate.kume_sayisi || 0) + (candidate.oncelik_puani || 50) - 1.0 * estRoadKm;
        } else if (strategy === 'DISTANCE') {
          score = -10.0 * estRoadKm + (candidate.oncelik_puani || 50) * 0.1;
        } else {
          // HYBRID
          score = (candidate.oncelik_puani || 50) + 15.0 * (candidate.kume_sayisi || 0) - 1.2 * estRoadKm;
        }

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
          bestCandidate._secili_mesafe = estRoadKm;
          bestCandidate._secili_sure = Math.max(2, Math.round((estRoadKm / 35.0) * 60));
          bestCandidate._skor = parseFloat(score.toFixed(1));
        }
      }

      const index = unvisited.indexOf(bestCandidate);
      if (index > -1) unvisited.splice(index, 1);

      ordered.push(bestCandidate);
      currentLat = bestCandidate.enlem;
      currentLon = bestCandidate.boylam;
    }

    return ordered;
  }

  private static evaluateCandidateCost(route: any[], vehicle: VehicleState): number {
    let totalCost = 0;
    let curLat = vehicle.enlem;
    let curLon = vehicle.boylam;

    for (let idx = 0; idx < route.length; idx++) {
      const stop = route[idx];
      const dist = RoutingService.calculateDistance(curLat, curLon, stop.enlem, stop.boylam);
      totalCost += (dist * 10) - ((stop.oncelik_puani || 50) * 0.5) - ((stop.kume_sayisi || 0) * 2.0);
      curLat = stop.enlem;
      curLon = stop.boylam;
    }

    return totalCost;
  }

  private static async calculateRouteForFaultSubset(vehicle: VehicleState, actionableFaults: any[], fetchOsrm: boolean = true): Promise<any> {
    if (actionableFaults.length === 0) {
      return {
        basarili: true,
        mesaj: 'Bekleyen aktif dahili arıza bulunmamaktadır.',
        arac_konumu: vehicle,
        toplam_durak: 0,
        toplam_mesafe_km: 0.0,
        toplam_sure_dk: 0,
        duraklar: [],
        bacaklar: [],
        rota_geometrisi: []
      };
    }

    // Clustering Analysis (1.5 km radius)
    for (let i = 0; i < actionableFaults.length; i++) {
      let kumeSayisi = 0;
      for (let j = 0; j < actionableFaults.length; j++) {
        if (i !== j) {
          const d = RoutingService.calculateDistance(
            actionableFaults[i].enlem,
            actionableFaults[i].boylam,
            actionableFaults[j].enlem,
            actionableFaults[j].boylam
          );
          if (d <= 1.5) kumeSayisi++;
        }
      }
      actionableFaults[i].kume_sayisi = kumeSayisi;
    }

    // 10-Algorithm Ensemble Optimization Pipeline for Arıza
    let orderedStops = RoutingService.optimizeFaultSetWithEnsemble(actionableFaults, vehicle);

    // Sequence numbers & totals
    let totalDistance = 0.0;
    let totalTimeMins = 0;
    let curLat = vehicle.enlem;
    let curLon = vehicle.boylam;

    for (let idx = 0; idx < orderedStops.length; idx++) {
      const stop = orderedStops[idx];
      const airD = RoutingService.calculateDistance(curLat, curLon, stop.enlem, stop.boylam);
      const roadKm = parseFloat((airD * 1.35).toFixed(2));
      const durMins = Math.max(2, Math.round((roadKm / 35.0) * 60));

      stop.sira_no = idx + 1;
      stop.atandi_imei = vehicle.imei;
      stop.atandi_plaka = vehicle.plaka;
      stop.bacak_mesafe_km = roadKm;
      stop.bacak_sure_dk = durMins;
      stop.optimizasyon_skoru = parseFloat(((stop.oncelik_puani || 50) + 15.0 * (stop.kume_sayisi || 0) - 1.2 * roadKm).toFixed(1));

      totalDistance += roadKm;
      totalTimeMins += durMins;

      curLat = stop.enlem;
      curLon = stop.boylam;
    }

    totalDistance = parseFloat(totalDistance.toFixed(2));

    // Generate OSRM or Synthetic Bacaklar in Parallel
    const legPromises = orderedStops.map(async (toStop, i) => {
      const color = RoutingService.LEG_COLORS[i % RoutingService.LEG_COLORS.length];
      const startLat = i === 0 ? vehicle.enlem : orderedStops[i - 1].enlem;
      const startLon = i === 0 ? vehicle.boylam : orderedStops[i - 1].boylam;
      const startName = i === 0 ? vehicle.ad : orderedStops[i - 1].lokasyon_adi;

      let legGeometry: [number, number][] = [];
      if (fetchOsrm) {
        const osrmResult = await RoutingService.fetchOsrmRoute(startLat, startLon, toStop.enlem, toStop.boylam);
        if (osrmResult && osrmResult.geometry && osrmResult.geometry.length > 0) {
          legGeometry = osrmResult.geometry;
        } else {
          legGeometry = [
            [startLat, startLon],
            [toStop.enlem, toStop.boylam]
          ];
        }
      } else {
        legGeometry = [
          [startLat, startLon],
          [toStop.enlem, toStop.boylam]
        ];
      }

      return {
        sira_no: i + 1,
        baslangic_ad: startName,
        hedef_ad: `${toStop.lokasyon_adi} (${toStop.ariza_metni})`,
        mesafe_km: toStop.bacak_mesafe_km,
        sure_dk: toStop.bacak_sure_dk,
        renk: color,
        geometri: legGeometry
      };
    });

    const legs = await Promise.all(legPromises);
    const geometryPoints: [number, number][] = [];
    legs.forEach(leg => {
      leg.geometri.forEach((pt: [number, number]) => geometryPoints.push(pt));
    });

    return {
      basarili: true,
      arac_konumu: vehicle,
      toplam_durak: orderedStops.length,
      toplam_mesafe_km: totalDistance,
      toplam_sure_dk: totalTimeMins,
      duraklar: orderedStops,
      bacaklar: legs,
      rota_geometrisi: geometryPoints
    };
  }

  private static apply2OptRefinement(stops: any[]): any[] {
    let best = [...stops];
    let improved = true;
    let iterations = 0;
    const maxIterations = 50;

    const calcTotalDist = (route: any[]) => {
      let d = 0;
      for (let i = 0; i < route.length - 1; i++) {
        d += RoutingService.calculateDistance(route[i].enlem, route[i].boylam, route[i + 1].enlem, route[i + 1].boylam);
      }
      return d;
    };

    let bestDist = calcTotalDist(best);

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      for (let i = 0; i < best.length - 1; i++) {
        for (let k = i + 1; k < best.length; k++) {
          const newRoute = RoutingService.twoOptSwap(best, i, k);
          const newDist = calcTotalDist(newRoute);

          if (newDist < bestDist - 0.01) {
            best = newRoute;
            bestDist = newDist;
            improved = true;
          }
        }
      }
    }

    return best;
  }

  private static twoOptSwap(route: any[], i: number, k: number): any[] {
    const newRoute = route.slice(0, i);
    const reversedSegment = route.slice(i, k + 1).reverse();
    const tail = route.slice(k + 1);
    return newRoute.concat(reversedSegment, tail);
  }

  private static async fetchSingleOsrmUrl(url: string): Promise<any> {
    return new Promise((resolve) => {
      const options = {
        headers: {
          'User-Agent': 'KayseriUlasimApp/1.0',
          'Connection': 'close'
        },
        agent: new https.Agent({ keepAlive: false }),
        timeout: 5000
      };

      const req = https
        .get(url, options, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const parsed = JSON.parse(data);
                if (parsed.routes && parsed.routes.length > 0) {
                  const route = parsed.routes[0];
                  const coords = route.geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]);
                  const distKm = parseFloat((route.distance / 1000.0).toFixed(2));
                  const durMins = Math.round(route.duration / 60.0);
                  return resolve({ geometry: coords, mesafe_km: distKm, sure_dk: durMins });
                }
              }
            } catch (_e) {}
            resolve(null);
          });
        })
        .on('error', () => {
          resolve(null);
        })
        .on('timeout', () => {
          req.destroy();
          resolve(null);
        });
    });
  }

  private static async fetchOsrmRoute(lat1: number, lon1: number, lat2: number, lon2: number): Promise<any> {
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_OSRM === 'true') {
      return null;
    }

    const cacheKey = `${lat1.toFixed(4)},${lon1.toFixed(4)}->${lat2.toFixed(4)},${lon2.toFixed(4)}`;
    if (RoutingService.routeCache.has(cacheKey)) {
      return RoutingService.routeCache.get(cacheKey)!;
    }

    const osrmBase = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
    const primaryUrl = `${osrmBase}/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;

    let result = await RoutingService.fetchSingleOsrmUrl(primaryUrl);

    // Secondary fallback mirror if primary OSRM server fails
    if (!result || !result.geometry || result.geometry.length === 0) {
      const fallbackUrl = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
      result = await RoutingService.fetchSingleOsrmUrl(fallbackUrl);
    }

    if (result && result.geometry && result.geometry.length > 0) {
      RoutingService.routeCache.set(cacheKey, result);
    }

    return result;
  }
}

// Initial auto-load of saved DB telemetry into RoutingService
RoutingService.loadSavedVehiclesFromDb();
