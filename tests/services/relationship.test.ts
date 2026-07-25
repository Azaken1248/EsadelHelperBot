import { describe, expect, it } from "vitest";

import type { MemoryKind } from "../../src/models/memory.model";
import {
  AMIA_DISCLOSURES,
  describeFloorGuidance,
  resolveFloorState,
  FLOOR_CLICHE,
  FLOOR_FACTS,
  FLOOR_OPINIONS,
  FLOOR_FEELINGS,
} from "../../src/services/relationship";

const kinds = (...k: MemoryKind[]): MemoryKind[] => k;

describe("resolveFloorState", () => {
  it("starts at cliché with nothing known", () => {
    const state = resolveFloorState([]);
    expect(state.current).toBe(FLOOR_CLICHE);
    expect(state.mayAskUpTo).toBe(FLOOR_FACTS); // one floor up, never a leap
  });

  it("reaches facts after any disclosure", () => {
    expect(resolveFloorState(kinds("fact")).current).toBe(FLOOR_FACTS);
  });

  it("needs two opinion-level disclosures to reach opinions", () => {
    expect(resolveFloorState(kinds("fact", "interest")).current).toBe(FLOOR_FACTS);
    expect(resolveFloorState(kinds("interest", "preference")).current).toBe(FLOOR_OPINIONS);
  });

  it("never skips a floor: a lone feeling cannot jump straight to floor 4", () => {
    const state = resolveFloorState(kinds("feeling"));
    expect(state.current).toBe(FLOOR_FACTS);
  });

  it("reaches feelings only once opinions are established too", () => {
    const state = resolveFloorState(kinds("interest", "preference", "feeling"), {
      maxAskFloor: FLOOR_FEELINGS,
    });
    expect(state.current).toBe(FLOOR_FEELINGS);
    expect(state.mayAskUpTo).toBe(FLOOR_FEELINGS); // clamped at the deepest floor
  });

  it("respects the ask ceiling so she never fishes for vulnerability", () => {
    // Default ceiling is opinions, even when the user has gone deeper.
    const state = resolveFloorState(kinds("interest", "preference", "feeling"));
    expect(state.mayAskUpTo).toBe(FLOOR_OPINIONS);
  });
});

describe("describeFloorGuidance", () => {
  it("instructs permission-softening and reciprocity when escalating", () => {
    const guidance = describeFloorGuidance(resolveFloorState(kinds("fact")));
    expect(guidance).toContain("floor 2");
    expect(guidance).toContain("floor 3");
    expect(guidance).toContain("permission phrase");
    expect(guidance).toContain("reciprocate");
    // it hands her an actual matching truth to trade
    expect(guidance).toContain(AMIA_DISCLOSURES[FLOOR_OPINIONS][0]!);
  });

  it("always warns against interrogating", () => {
    expect(describeFloorGuidance(resolveFloorState([]))).toContain("never interrogate");
  });
});
