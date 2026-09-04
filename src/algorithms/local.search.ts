import { StationNode } from './topology.mapper';
import { MatrixEngine } from './matrix.engine';

export class LocalSearch {
  /**
   * Refines corridor transition boundaries without breaking station sequence integrity
   */
  public static refineRoute(route: StationNode[], startLat: number, startLon: number): StationNode[] {
    if (route.length <= 3) return route;

    const calcTotalDist = (r: StationNode[]): number => {
      let sum = MatrixEngine.computeRoadDistanceKm({ enlem: startLat, boylam: startLon }, r[0]);
      for (let i = 0; i < r.length - 1; i++) {
        sum += MatrixEngine.computeRoadDistanceKm(r[i], r[i + 1]);
      }
      return sum;
    };

    let best = [...route];
    let bestDist = calcTotalDist(best);
    let improved = true;
    let iterations = 0;

    // 2-Opt Local Search across transition boundaries
    while (improved && iterations < 20) {
      improved = false;
      iterations++;
      for (let i = 0; i < best.length - 2; i++) {
        for (let j = i + 1; j < Math.min(best.length, i + 5); j++) {
          const candidate = [
            ...best.slice(0, i),
            ...best.slice(i, j + 1).reverse(),
            ...best.slice(j + 1)
          ];
          const dist = calcTotalDist(candidate);
          if (dist < bestDist - 0.05) {
            best = candidate;
            bestDist = dist;
            improved = true;
          }
        }
      }
    }
    return best;
  }
}
