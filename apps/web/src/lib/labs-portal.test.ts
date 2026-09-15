import { describe, expect, it } from "vitest";

import {
  LABS_CATEGORY_ORDER,
  LABS_DESTINATION_HREFS,
  LABS_DESTINATIONS,
  isLabsPath,
  labsDestinationForPath
} from "./labs-portal";

describe("LABS_DESTINATIONS (UX-W10 portal catalog)", () => {
  it("lists former Labs peers with categories for portal + palette", () => {
    expect(LABS_DESTINATIONS.length).toBeGreaterThanOrEqual(8);
    expect(LABS_DESTINATION_HREFS.has("/workflows")).toBe(true);
    expect(LABS_DESTINATION_HREFS.has("/swarm")).toBe(true);
    expect(LABS_DESTINATION_HREFS.has("/ai-apps")).toBe(true);
    expect(LABS_DESTINATION_HREFS.has("/labs")).toBe(false);
    for (const category of LABS_CATEGORY_ORDER) {
      expect(
        LABS_DESTINATIONS.some((item) => item.category === category)
      ).toBe(true);
    }
  });

  it("matches portal and destination paths", () => {
    expect(isLabsPath("/labs")).toBe(true);
    expect(isLabsPath("/workflows")).toBe(true);
    expect(isLabsPath("/model-gateway/foo")).toBe(true);
    expect(isLabsPath("/threat-feed")).toBe(true);
    expect(isLabsPath("/findings")).toBe(false);
    expect(labsDestinationForPath("/threat-center")?.label).toBe("Threats");
    expect(labsDestinationForPath("/labs")).toBeUndefined();
  });
});
