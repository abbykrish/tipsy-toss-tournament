import { describe, expect, it } from "vitest";
import { funnyTeamName, uniqueFunnyTeamName } from "../shared/teamNames";

describe("team names", () => {
  it("makes names that fit the 40-character limit", () => {
    for (let i = 0; i < 500; i++) {
      const name = funnyTeamName();
      expect(name.length).toBeGreaterThan(0);
      expect(name.length).toBeLessThanOrEqual(40);
    }
  });

  it("never suggests a taken name, ignoring case", () => {
    const taken = ["bottle rockets", "The Tipsy Geese"];
    for (let i = 0; i < 500; i++) {
      const name = uniqueFunnyTeamName(taken).toLowerCase();
      expect(taken.map((t) => t.toLowerCase())).not.toContain(name);
    }
  });

  it("adds a number if the random picks keep colliding", () => {
    const always = () => 0; // always "Bottle Rockets"
    expect(uniqueFunnyTeamName(["Bottle Rockets"], always)).toBe("Bottle Rockets 2");
    expect(uniqueFunnyTeamName(["Bottle Rockets", "Bottle Rockets 2"], always)).toBe("Bottle Rockets 3");
  });
});
