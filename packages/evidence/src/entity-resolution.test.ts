import { describe, expect, it } from "vitest";

import {
  normalizeAssetIdentifiers,
  resolveAssetObservation
} from "./entity-resolution.js";

describe("asset entity resolution", () => {
  it("normalizes URLs and host identifiers deterministically", () => {
    expect(
      normalizeAssetIdentifiers({
        Hostname: "API.EXAMPLE.COM.",
        repositoryUrl: "HTTPS://GitHub.com/Acme/Repo/"
      })
    ).toEqual({
      hostname: "api.example.com",
      repositoryurl: "https://github.com/Acme/Repo"
    });
  });

  it("matches a strong identifier without overwriting conflicting source fields", () => {
    const resolved = resolveAssetObservation({
      candidates: [
        {
          assetId: "asset-1",
          assetType: "CloudResource",
          identifiers: { region: "us-east-1", resourceId: "VM-1" },
          name: "Primary VM"
        }
      ],
      observed: {
        assetType: "CloudResource",
        identifiers: {
          ip: "203.0.113.10",
          region: "us-west-2",
          resourceId: "vm-1"
        },
        name: "Renamed VM"
      }
    });

    expect(resolved).toMatchObject({
      confidence: 1,
      conflictFields: ["region"],
      matchedAssetId: "asset-1",
      status: "ConflictMatched"
    });
    expect(resolved.mergedIdentifiers).toEqual({
      ip: "203.0.113.10",
      region: "us-east-1",
      resourceId: "VM-1"
    });
  });

  it("does not silently merge equally plausible candidates", () => {
    const resolved = resolveAssetObservation({
      candidates: ["asset-1", "asset-2"].map((assetId) => ({
        assetId,
        assetType: "Host",
        identifiers: { hostname: "shared.example.com" },
        name: "shared.example.com"
      })),
      observed: {
        assetType: "Host",
        identifiers: { hostname: "shared.example.com" },
        name: "shared.example.com"
      }
    });
    expect(resolved).toMatchObject({
      confidence: 0.5,
      matchedAssetId: null,
      status: "AmbiguousCreated"
    });
  });

  it("does not collapse sibling resources that share provider hierarchy identifiers", () => {
    const resolved = resolveAssetObservation({
      candidates: [
        {
          assetId: "asset-1",
          assetType: "CloudResource",
          identifiers: {
            region: "us-east-1",
            subscriptionId: "subscription-1"
          },
          name: "subscription/subscription-1"
        }
      ],
      observed: {
        assetType: "CloudResource",
        identifiers: {
          region: "us-east-1",
          subscriptionId: "subscription-1"
        },
        name: "virtual-machine/web-01"
      }
    });

    expect(resolved).toMatchObject({
      matchedAssetId: null,
      status: "Created"
    });
  });
});
