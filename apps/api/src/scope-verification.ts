import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveTxt } from "node:dns/promises";

import {
  COMMUNITY_REPOSITORY_AUTH_FILENAME,
  extractAwsAccountId
} from "@periscan/shared";

export const DNS_TXT_VERIFICATION_PREFIX = "_periscan";

export type DnsTxtResolver = (hostname: string) => Promise<string[][]>;

export function buildDnsTxtVerificationName(scopeValue: string) {
  const hostname = scopeValue.trim().toLowerCase().replace(/\.+$/u, "");

  return `${DNS_TXT_VERIFICATION_PREFIX}.${hostname}`;
}

export function dnsTxtRecordsContainToken(
  records: string[][],
  verificationToken: string
) {
  const expectedAssignment = `periscan-verification=${verificationToken}`;

  return records.some((chunks) => {
    const joined = chunks.join("").trim();

    return (
      joined === verificationToken ||
      joined === expectedAssignment ||
      joined.includes(verificationToken)
    );
  });
}

export async function verifyDnsTxtScope(input: {
  resolver?: DnsTxtResolver;
  scopeValue: string;
  verificationToken: string;
}) {
  const verificationName = buildDnsTxtVerificationName(input.scopeValue);
  const resolver = input.resolver ?? resolveTxt;

  try {
    const records = await resolver(verificationName);

    return {
      records,
      verified: dnsTxtRecordsContainToken(records, input.verificationToken),
      verificationName
    };
  } catch {
    return {
      records: [],
      verified: false,
      verificationName
    };
  }
}

export function isSafeAbsoluteRepositoryPath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return false;
  }
  if (trimmed.includes("\0") || trimmed.includes("://")) {
    return false;
  }
  if (trimmed.split("/").includes("..")) {
    return false;
  }
  return !path.posix.normalize(trimmed).split("/").includes("..");
}

export function repositoryAuthorizationFilePath(repositoryPath: string): string {
  return path.posix.join(
    path.posix.normalize(repositoryPath.trim()),
    COMMUNITY_REPOSITORY_AUTH_FILENAME
  );
}

export function repositoryFileContainsToken(
  contents: string,
  verificationToken: string
): boolean {
  const trimmed = contents.trim();
  return (
    trimmed === verificationToken ||
    trimmed === `periscan-verification=${verificationToken}` ||
    trimmed.includes(verificationToken)
  );
}

export async function verifyRepositoryAuthorizationFile(input: {
  readFile?: (filePath: string) => Promise<string>;
  repositoryPath: string;
  verificationToken: string;
}): Promise<{
  filePath: string;
  verified: boolean;
  message: string;
}> {
  const filePath = repositoryAuthorizationFilePath(input.repositoryPath);
  if (!isSafeAbsoluteRepositoryPath(input.repositoryPath)) {
    return {
      filePath,
      message:
        "Repository scope value must be an absolute local path the control plane can read.",
      verified: false
    };
  }

  const reader = input.readFile ?? ((target) => readFile(target, "utf8"));
  try {
    const contents = await reader(filePath);
    const verified = repositoryFileContainsToken(
      contents,
      input.verificationToken
    );
    return {
      filePath,
      message: verified
        ? "Repository authorization file matched the verification token."
        : `Authorization file ${filePath} did not contain the verification token.`,
      verified
    };
  } catch {
    return {
      filePath,
      message: `Could not read ${filePath}. Write the token there, or have an Owner/Admin attest if the repo is only on a runner.`,
      verified: false
    };
  }
}

export function awsAccountIdsFromIntegrationConfig(config: unknown): string[] {
  const found = new Set<string>();

  const visit = (value: unknown) => {
    if (typeof value === "string") {
      const extracted = extractAwsAccountId(value);
      if (extracted) {
        found.add(extracted);
      }
      for (const match of value.matchAll(/\b(\d{12})\b/gu)) {
        if (match[1]) {
          found.add(match[1]);
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry);
      }
      return;
    }
    if (value && typeof value === "object") {
      for (const nested of Object.values(value as Record<string, unknown>)) {
        visit(nested);
      }
    }
  };

  visit(config);
  return [...found];
}

export function cloudAccountScopeMatchesIntegration(input: {
  config: unknown;
  scopeValue: string;
}): boolean {
  const wanted = extractAwsAccountId(input.scopeValue);
  if (!wanted) {
    return false;
  }
  return awsAccountIdsFromIntegrationConfig(input.config).includes(wanted);
}
