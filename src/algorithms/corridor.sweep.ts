import { StationNode, LineCorridor } from './topology.mapper';
import { SpurSolver } from './spur.solver';

export class CorridorSweep {
  /**
   * Sweeps a contiguous unvisited station segment along the bestCorridor starting from closestSt
   */
  public static getSweepSegment(
    closestSt: StationNode,
    bestCorridor: LineCorridor,
    visitedIds: Set<number>
  ): StationNode[] {
    // First, check if a specialized Dead-End Spur Turnaround applies
    const spurSegment = SpurSolver.evaluateSpurTurnaround(closestSt, bestCorridor, visitedIds);
    if (spurSegment && spurSegment.length > 0) {
      return spurSegment;
    }

    const corridorSt = bestCorridor.stations;
    const bestIdx = corridorSt.findIndex(s => s.id === closestSt.id);

    if (bestIdx < 0) return [closestSt];

    // Evaluate contiguous forward unvisited stations
    const fwdSeq: StationNode[] = [];
    for (let i = bestIdx; i < corridorSt.length; i++) {
      const s = corridorSt[i];
      if (visitedIds.has(s.id)) break;
      fwdSeq.push(s);
    }

    // Evaluate contiguous backward unvisited stations
    const bwdSeq: StationNode[] = [];
    for (let i = bestIdx; i >= 0; i--) {
      const s = corridorSt[i];
      if (visitedIds.has(s.id)) break;
      bwdSeq.push(s);
    }

    let sweepSegment = fwdSeq.length >= bwdSeq.length ? fwdSeq : bwdSeq;
    if (sweepSegment.length === 0) {
      sweepSegment = [closestSt];
    }
    return sweepSegment;
  }
}
