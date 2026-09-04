import { StationNode, LineCorridor } from './topology.mapper';

export class SpurSolver {
  /**
   * Checks if entering corridor at closestSt presents a dead-end spur branch turnaround opportunity
   * (e.g. Talas Belediyesi -> Talas Cemil Baba terminus -> turnaround to Bahçelievler).
   * Returns the turnaround optimized segment if applicable, or null if standard corridor sweep should apply.
   */
  public static evaluateSpurTurnaround(
    closestSt: StationNode,
    bestCorridor: LineCorridor,
    visitedIds: Set<number>
  ): StationNode[] | null {
    const corridorSt = bestCorridor.stations;

    // Check for Talas Cemil Baba spur branch (T2 corridor)
    if (bestCorridor.hat_kod === 'T2' && closestSt.ad === 'Talas Belediyesi') {
      const cemilBaba = corridorSt.filter(s => s.ad === 'Talas Cemil Baba' && !visitedIds.has(s.id));
      if (cemilBaba.length > 0) {
        const bwdUnvisited = [...corridorSt.slice(0, corridorSt.findIndex(s => s.id === closestSt.id) + 1)]
          .reverse()
          .filter(s => !visitedIds.has(s.id) && s.ad !== 'Talas Belediyesi' && s.ad !== 'Talas Cemil Baba');

        return [closestSt, ...cemilBaba, ...bwdUnvisited];
      }
    }

    // Check general end-of-spur terminal proximity (terminal index 0 or N-1)
    const idx = corridorSt.findIndex(s => s.id === closestSt.id);
    if (idx === 1 && !visitedIds.has(corridorSt[0].id)) {
      // 1 hop from terminal 0
      const term0 = corridorSt[0];
      const fwd = corridorSt.slice(idx + 1).filter(s => !visitedIds.has(s.id));
      return [closestSt, term0, ...fwd];
    }

    if (idx === corridorSt.length - 2 && !visitedIds.has(corridorSt[corridorSt.length - 1].id)) {
      // 1 hop from terminal N-1
      const termLast = corridorSt[corridorSt.length - 1];
      const bwd = [...corridorSt.slice(0, idx)].reverse().filter(s => !visitedIds.has(s.id));
      return [closestSt, termLast, ...bwd];
    }

    return null;
  }
}
