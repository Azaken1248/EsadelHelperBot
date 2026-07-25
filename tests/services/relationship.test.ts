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
  it("offers the next floor as a choice rather than an instruction", () => {
    const guidance = describeFloorGuidance(resolveFloorState(kinds("fact")));

    expect(guidance).toContain("floor 2 of 4");
    expect(guidance).toContain("your call");
    expect(guidance).toContain("simply to answer and leave it there");
    // material she *may* use, offered in her own words
    expect(guidance).toContain(AMIA_DISCLOSURES[FLOOR_OPINIONS][0]!);
    expect(guidance).toContain("in your own words");
  });

  it("states reciprocity as a principle, not a mandated line", () => {
    const guidance = describeFloorGuidance(resolveFloorState(kinds("fact")));
    expect(guidance).toContain("never ask for more openness than you're offering");
    expect(guidance).toContain("easy out");
  });

  it("does not dictate how many questions to ask", () => {
    const guidance = describeFloorGuidance(resolveFloorState(kinds("fact")));
    expect(guidance).not.toMatch(/at most one question/i);
  });

  it("tells her to hold still once she's at her ceiling", () => {
    const guidance = describeFloorGuidance(resolveFloorState(kinds("interest", "preference")));
    expect(guidance).toContain("follow their lead");
    expect(guidance).toContain("don't push further");
  });

  it("still enforces the ceiling as a hard boundary", () => {
    const guidance = describeFloorGuidance(resolveFloorState(kinds("fact")));
    expect(guidance).toContain("has to be earned");
  });
});
