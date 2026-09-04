import { StationNode } from './topology.mapper';
import { RoutingService } from '../services/routing.service';

export class MatrixEngine {
  /**
   * Computes vehicular road distance in km between two stations with road tortuosity factor
   */
  public static computeRoadDistanceKm(from: { enlem: number; boylam: number }, to: { enlem: number; boylam: number }): number {
    const airD = RoutingService.calculateDistance(from.enlem, from.boylam, to.enlem, to.boylam);
    return parseFloat((airD * 1.35).toFixed(2));
  }

  /**
   * Computes driving duration in minutes between two stations
   */
  public static computeDrivingDurationMins(roadKm: number): number {
    return Math.max(2, Math.round((roadKm / 35.0) * 60));
  }
}
