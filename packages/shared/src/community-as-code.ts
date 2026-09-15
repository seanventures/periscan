import { z } from "zod";

/**
 * Community-as-code is a portable *intent* document for GitHub users.
 * The control plane does not load this file. Starts still go through
 * API + policy (`POST /api/v1/community/validation-runs`). Denied never queues.
 */
export const COMMUNITY_AS_CODE_FILENAME = ".periscan.yaml";
export const COMMUNITY_AS_CODE_EXAMPLE_FILENAME = ".periscan.example.yaml";
export const COMMUNITY_AS_CODE_KIND = "CommunityAsCode" as const;
export const COMMUNITY_AS_CODE_VERSION = 1 as const;
export const COMMUNITY_AS_CODE_PACK = "community" as const;
export const COMMUNITY_AS_CODE_RUNTIME_BINDING = "intent_only" as const;

export const CommunityAsCodeSafetyCeilingSchema = z.enum([
  "PassiveReadOnly",
  "ActiveNonInvasive"
]);

export const CommunityAsCodeDocumentSchema = z.object({
  version: z.literal(COMMUNITY_AS_CODE_VERSION),
  kind: z
    .literal(COMMUNITY_AS_CODE_KIND)
    .optional()
    .default(COMMUNITY_AS_CODE_KIND),
  pack: z.literal(COMMUNITY_AS_CODE_PACK),
  edition: z.literal(COMMUNITY_AS_CODE_PACK).optional(),
  safety: z.object({
    ceiling: CommunityAsCodeSafetyCeilingSchema,
    require_verified_scope: z.literal(true),
    deny_never_queues: z.literal(true).optional().default(true),
    live_offensive: z.literal(false).optional().default(false)
  }),
  nuclei: z.object({
    second_mission: z.literal(true),
    include_in_primary_start: z.literal(false).optional().default(false)
  }),
  engines: z.object({
    atomic: z.literal(false),
    caldera: z.literal(false).optional().default(false),
    sharphound: z.literal(false).optional().default(false),
    sqlmap: z.literal(false).optional().default(false),
    metasploit: z.literal(false).optional().default(false)
  })
});

export type CommunityAsCodeDocument = z.infer<
  typeof CommunityAsCodeDocumentSchema
>;
export type CommunityAsCodeSafetyCeiling = z.infer<
  typeof CommunityAsCodeSafetyCeilingSchema
>;

export class CommunityAsCodeError extends Error {
  readonly code: "yaml_parse_failed" | "community_as_code_invalid";

  constructor(
    code: "yaml_parse_failed" | "community_as_code_invalid",
    message: string
  ) {
    super(message);
    this.name = "CommunityAsCodeError";
    this.code = code;
  }
}

type YamlLine = {
  indent: number;
  lineNo: number;
  text: string;
};

function stripYamlComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const prev = i > 0 ? line[i - 1] : "";
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (char === '"' && !inSingle && prev !== "\\") {
      inDouble = !inDouble;
    } else if (char === "#" && !inSingle && !inDouble) {
      return line.slice(0, i).trimEnd();
    }
  }
  return line.trimEnd();
}

function tokenizeYamlLines(source: string): YamlLine[] {
  const lines: YamlLine[] = [];
  const rawLines = source.split(/\r?\n/);
  for (let i = 0; i < rawLines.length; i += 1) {
    const stripped = stripYamlComment(rawLines[i] ?? "");
    if (stripped.trim() === "") {
      continue;
    }
    const indent = stripped.match(/^ */u)?.[0].length ?? 0;
    lines.push({
      indent,
      lineNo: i + 1,
      text: stripped.slice(indent)
    });
  }
  return lines;
}

function unquote(raw: string): string {
  if (
    (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) ||
    (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2)
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

function parseScalar(raw: string): string | number | boolean | null {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null" || raw === "~") return null;
  if (/^-?\d+$/u.test(raw)) return Number(raw);
  if (/^-?\d+\.\d+$/u.test(raw)) return Number(raw);
  return unquote(raw);
}

function splitMappingEntry(text: string): { key: string; value?: string } {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const prev = i > 0 ? text[i - 1] : "";
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (char === '"' && !inSingle && prev !== "\\") {
      inDouble = !inDouble;
    } else if (char === ":" && !inSingle && !inDouble) {
      const key = unquote(text.slice(0, i).trim());
      if (!key) {
        throw new Error(`missing key before ':'`);
      }
      const rest = text.slice(i + 1).trim();
      return rest === "" ? { key } : { key, value: rest };
    }
  }
  throw new Error(`expected 'key: value', got ${JSON.stringify(text)}`);
}

function parseNode(
  lines: YamlLine[],
  index: number,
  indent: number
): { next: number; value: unknown } {
  const line = lines[index];
  if (!line || line.indent !== indent) {
    throw new Error(`indent mismatch at line ${line?.lineNo ?? index + 1}`);
  }
  if (line.text === "-" || line.text.startsWith("- ")) {
    return parseSequence(lines, index, indent);
  }
  return parseMapping(lines, index, indent);
}

function parseMapping(
  lines: YamlLine[],
  index: number,
  indent: number
): { next: number; value: Record<string, unknown> } {
  const value: Record<string, unknown> = {};
  let i = index;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.indent < indent) {
      break;
    }
    if (line.indent > indent) {
      throw new Error(`unexpected indent at line ${line.lineNo}`);
    }
    if (line.text === "-" || line.text.startsWith("- ")) {
      throw new Error(`unexpected sequence entry at line ${line.lineNo}`);
    }
    const entry = splitMappingEntry(line.text);
    if (entry.value !== undefined) {
      value[entry.key] = parseScalar(entry.value);
      i += 1;
      continue;
    }
    const nextLine = lines[i + 1];
    if (!nextLine || nextLine.indent <= indent) {
      value[entry.key] = null;
      i += 1;
      continue;
    }
    const nested = parseNode(lines, i + 1, nextLine.indent);
    value[entry.key] = nested.value;
    i = nested.next;
  }
  return { next: i, value };
}

function parseSequence(
  lines: YamlLine[],
  index: number,
  indent: number
): { next: number; value: unknown[] } {
  const value: unknown[] = [];
  let i = index;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.indent < indent) {
      break;
    }
    if (line.indent > indent) {
      throw new Error(`unexpected indent at line ${line.lineNo}`);
    }
    if (line.text !== "-" && !line.text.startsWith("- ")) {
      break;
    }
    const rest = line.text === "-" ? "" : line.text.slice(2).trim();
    if (rest !== "") {
      value.push(parseScalar(rest));
      i += 1;
      continue;
    }
    const nextLine = lines[i + 1];
    if (!nextLine || nextLine.indent <= indent) {
      value.push(null);
      i += 1;
      continue;
    }
    const nested = parseNode(lines, i + 1, nextLine.indent);
    value.push(nested.value);
    i = nested.next;
  }
  return { next: i, value };
}

function parseSimpleYaml(source: string): unknown {
  if (source.includes("\t")) {
    throw new Error("tabs are not allowed; use spaces");
  }
  if (/(^|\n)\s*[&*]|(^|\n)\s*<<:/u.test(source)) {
    throw new Error("YAML aliases, anchors, and merge keys are not supported");
  }
  const lines = tokenizeYamlLines(source);
  if (lines.length === 0) {
    throw new Error("document is empty");
  }
  const first = lines[0];
  if (!first) {
    throw new Error("document is empty");
  }
  const parsed = parseNode(lines, 0, first.indent);
  if (parsed.next !== lines.length) {
    const leftover = lines[parsed.next];
    throw new Error(`unexpected content at line ${leftover?.lineNo ?? "?"}`);
  }
  return parsed.value;
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "document";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function parseCommunityAsCodeYaml(
  source: string
): CommunityAsCodeDocument {
  let raw: unknown;
  try {
    raw = parseSimpleYaml(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid YAML";
    throw new CommunityAsCodeError("yaml_parse_failed", message);
  }
  const parsed = CommunityAsCodeDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CommunityAsCodeError(
      "community_as_code_invalid",
      formatZodIssues(parsed.error)
    );
  }
  return parsed.data;
}

export function communityAsCodeIsRuntimeBound(): boolean {
  return COMMUNITY_AS_CODE_RUNTIME_BINDING !== "intent_only";
}
