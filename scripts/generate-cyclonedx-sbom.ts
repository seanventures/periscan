import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export interface SbomNodeDependency {
  dependents: string[];
  license: string;
  name: string;
  version: string;
}

export interface CycloneDxSbomInventory {
  generatedAt: string;
  moduleManifests?: unknown[];
  nodeDependencies: SbomNodeDependency[];
  tools?: unknown[];
}

export const DEFAULT_SBOM_PATH = "sbom.json";
export const CYCLONE_DX_SPEC_VERSION = "1.6";
export const CYCLONE_DX_SCHEMA =
  "http://cyclonedx.org/schema/bom-1.6.schema.json";

export interface CycloneDxSbomOptions {
  productName?: string;
  productVersion?: string;
  serialNumber?: string;
  timestamp?: string;
}

export interface CycloneDxLicenseChoice {
  expression?: string;
  license?: {
    id?: string;
    name?: string;
  };
}

export interface CycloneDxComponent {
  "bom-ref": string;
  group?: string;
  licenses: CycloneDxLicenseChoice[];
  name: string;
  purl: string;
  type: "library";
  version: string;
}

export interface CycloneDxBom {
  $schema: string;
  bomFormat: "CycloneDX";
  components: CycloneDxComponent[];
  metadata: {
    component: {
      "bom-ref": string;
      licenses: CycloneDxLicenseChoice[];
      name: string;
      type: "application";
      version?: string;
    };
    properties: Array<{ name: string; value: string }>;
    timestamp: string;
    tools: {
      components: Array<{
        "bom-ref": string;
        name: string;
        type: "application";
      }>;
    };
  };
  serialNumber: string;
  specVersion: string;
  version: number;
}

const SPDX_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/u;

function isSpdxLicenseId(license: string) {
  return (
    SPDX_ID_PATTERN.test(license) && !/^(UNKNOWN|UNLICENSED)$/iu.test(license)
  );
}

export function toCycloneDxLicense(license: string): CycloneDxLicenseChoice {
  if (/\s+(OR|AND|WITH)\s+/iu.test(license)) {
    return { expression: license };
  }

  if (isSpdxLicenseId(license)) {
    return { license: { id: license } };
  }

  return { license: { name: license } };
}

function encodeNpmPurl(packageName: string, version: string) {
  if (packageName.startsWith("@")) {
    const slash = packageName.indexOf("/");
    if (slash > 0) {
      const scope = packageName.slice(0, slash);
      const name = packageName.slice(slash + 1);
      return `pkg:npm/${encodeURIComponent(scope)}/${name}@${encodeURIComponent(version)}`;
    }
  }

  return `pkg:npm/${packageName}@${encodeURIComponent(version)}`;
}

function toCycloneDxComponent(
  dependency: SbomNodeDependency
): CycloneDxComponent {
  const purl = encodeNpmPurl(dependency.name, dependency.version);
  const slash = dependency.name.startsWith("@")
    ? dependency.name.indexOf("/")
    : -1;
  const component: CycloneDxComponent = {
    "bom-ref": purl,
    licenses: [toCycloneDxLicense(dependency.license)],
    name: slash > 0 ? dependency.name.slice(slash + 1) : dependency.name,
    purl,
    type: "library",
    version: dependency.version
  };

  if (slash > 0) {
    component.group = dependency.name.slice(0, slash);
  }

  return component;
}

export function renderCycloneDxSbom(
  inventory: CycloneDxSbomInventory,
  options: CycloneDxSbomOptions = {}
): CycloneDxBom {
  const productName = options.productName ?? "periscan";
  const productVersion = options.productVersion;
  const serialNumber = options.serialNumber ?? `urn:uuid:${randomUUID()}`;
  const timestamp = options.timestamp ?? inventory.generatedAt;
  const components = inventory.nodeDependencies
    .map(toCycloneDxComponent)
    .sort((left, right) => left.purl.localeCompare(right.purl));

  return {
    $schema: CYCLONE_DX_SCHEMA,
    bomFormat: "CycloneDX",
    specVersion: CYCLONE_DX_SPEC_VERSION,
    serialNumber,
    version: 1,
    metadata: {
      timestamp,
      tools: {
        components: [
          {
            "bom-ref": "periscan-license-inventory",
            type: "application",
            name: "periscan-license-inventory"
          }
        ]
      },
      component: {
        "bom-ref": productName,
        type: "application",
        name: productName,
        ...(productVersion ? { version: productVersion } : {}),
        licenses: [{ license: { id: "Apache-2.0" } }]
      },
      properties: [
        {
          name: "periscan:sbom-purpose",
          value:
            "Node dependency inventory. Product LICENSE is Apache-2.0; this document does not relicense third-party engines or claim redistribution of optional copyleft engines."
        },
        {
          name: "periscan:product-license",
          value: "Apache-2.0"
        }
      ]
    },
    components
  };
}

export async function writeCycloneDxSbom(
  rootDir = process.cwd(),
  outputPath = DEFAULT_SBOM_PATH
) {
  const { buildLicenseInventory } = await import("./license-inventory.ts");
  const inventory = await buildLicenseInventory(rootDir);
  const bom = renderCycloneDxSbom(inventory, {
    productVersion:
      process.env.GITHUB_SHA ??
      process.env.PERISCAN_SBOM_VERSION ??
      "unpublished",
    timestamp: inventory.generatedAt
  });
  const target = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(rootDir, outputPath);

  await writeFile(target, `${JSON.stringify(bom, null, 2)}\n`, "utf8");

  return { bom, inventory, target };
}

async function main() {
  const outputPath = process.argv[2] ?? DEFAULT_SBOM_PATH;
  const { bom, inventory, target } = await writeCycloneDxSbom(
    process.cwd(),
    outputPath
  );

  console.log(
    `Wrote CycloneDX ${bom.specVersion} SBOM to ${target} with ${bom.components.length} Node components from ${inventory.nodeDependencies.length} inventoried dependencies.`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
