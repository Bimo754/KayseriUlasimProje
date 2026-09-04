import { StationNode, TopologyMapper, LineCorridor } from './topology.mapper';
import { CorridorSweep } from './corridor.sweep';
import { JunctionSolver } from './junction.solver';

export class SeedGenerator {
  /**
   * Generates a candidate maintenance route starting dynamically from initLat, initLon
   */
  public static generateCandidateRoute(initLat: number, initLon: number): StationNode[] {
    const lineCorridors: LineCorridor[] = TopologyMapper.loadLineCorridors();
    const visitedIds = new Set<number>();
    const route: StationNode[] = [];

    let curLat = initLat;
    let curLon = initLon;

    while (visitedIds.size < 75) {
      const nextTarget = JunctionSolver.findClosestUnvisitedStation(curLat, curLon, lineCorridors, visitedIds);
      if (!nextTarget) break;

      const sweepSegment = CorridorSweep.getSweepSegment(nextTarget.closestStation, nextTarget.bestCorridor, visitedIds);

      for (const st of sweepSegment) {
        if (!visitedIds.has(st.id)) {
          visitedIds.add(st.id);
          route.push(st);
          curLat = st.enlem;
          curLon = st.boylam;
        }
      }
    }

    // Safety fallback for any unvisited active stations
    const allActive = TopologyMapper.loadAllActiveStations();
    const remainingUnvisited = allActive.filter(st => !visitedIds.has(st.id));

    while (remainingUnvisited.length > 0) {
      let nearestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < remainingUnvisited.length; i++) {
        const st = remainingUnvisited[i];
        const d = Math.hypot(curLat - st.enlem, curLon - st.boylam);
        if (d < minDist) {
          minDist = d;
          nearestIdx = i;
        }
      }
      const nextSt = remainingUnvisited.splice(nearestIdx, 1)[0];
      visitedIds.add(nextSt.id);
      route.push(nextSt);
      curLat = nextSt.enlem;
      curLon = nextSt.boylam;
    }

    return route;
  }
}
