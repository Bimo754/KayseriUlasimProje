import { StationNode } from './topology.mapper';
import { SeedGenerator } from './seed.generator';
import { LocalSearch } from './local.search';
import { FeasibilityGuard } from './feasibility.guard';

export class EnsembleSelector {
  /**
   * Evaluates multiple candidate routes generated across different strategy variations
   * and selects the candidate with the absolute minimum total distance & time while honoring human feasibility constraints.
   */
  public static selectBestRoute(initLat: number, initLon: number): StationNode[] {
    // Generate primary candidate route
    const rawCandidate = SeedGenerator.generateCandidateRoute(initLat, initLon);

    // Apply Local Search refinement
    const refinedCandidate = LocalSearch.refineRoute(rawCandidate, initLat, initLon);

    // Evaluate Quality Scores
    const rawEval = FeasibilityGuard.evaluateRouteQuality(rawCandidate, initLat, initLon);
    const refinedEval = FeasibilityGuard.evaluateRouteQuality(refinedCandidate, initLat, initLon);

    if (refinedEval.score < rawEval.score) {
      return refinedCandidate;
    }
    return rawCandidate;
  }
}
