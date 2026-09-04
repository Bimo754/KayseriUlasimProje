import { StationNode } from './topology.mapper';
import { MatrixEngine } from './matrix.engine';

export class FeasibilityGuard {
  /**
   * Evaluates human operational feasibility score and total penalized travel distance for a route
   */
  public static evaluateRouteQuality(
    route: StationNode[],
    startLat: number,
    startLon: number
  ): { totalDistanceKm: number; penaltyScore: number; score: number } {
    let totalDistanceKm = MatrixEngine.computeRoadDistanceKm({ enlem: startLat, boylam: startLon }, route[0]);
    let penaltyScore = 0;

    for (let i = 0; i < route.length - 1; i++) {
      const legDist = MatrixEngine.computeRoadDistanceKm(route[i], route[i + 1]);
      totalDistanceKm += legDist;

      // Penalize long cross-town jumps (> 12 km) that double back into city center
      if (legDist > 12.0) {
        penaltyScore += legDist * 0.2;
      }
    }

    return {
      totalDistanceKm,
      penaltyScore,
      score: totalDistanceKm + penaltyScore
    };
  }
}
