import { StationNode, LineCorridor } from './topology.mapper';
import { RoutingService } from '../services/routing.service';

export interface NextCorridorTarget {
  closestStation: StationNode;
  bestCorridor: LineCorridor;
  distance: number;
}

export class JunctionSolver {
  /**
   * Finds the absolute closest unvisited station on the map across all line corridors relative to curLat, curLon
   */
  public static findClosestUnvisitedStation(
    curLat: number,
    curLon: number,
    lineCorridors: LineCorridor[],
    visitedIds: Set<number>
  ): NextCorridorTarget | null {
    let closestStation: StationNode | null = null;
    let minDistance = Infinity;
    let bestCorridor: LineCorridor | null = null;

    for (const corridor of lineCorridors) {
      for (const st of corridor.stations) {
        if (!visitedIds.has(st.id)) {
          const d = RoutingService.calculateDistance(curLat, curLon, st.enlem, st.boylam);
          if (d < minDistance) {
            minDistance = d;
            closestStation = st;
            bestCorridor = corridor;
          }
        }
      }
    }

    if (!closestStation || !bestCorridor) return null;

    return {
      closestStation,
      bestCorridor,
      distance: minDistance
    };
  }
}
