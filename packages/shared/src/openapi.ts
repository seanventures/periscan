import { z } from "zod";

/**
 * Convert a Zod schema (defined in this package) to JSON Schema for OpenAPI.
 * Must live in @periscan/shared so the helper and the schemas share one zod
 * instance. `io` selects input (request) vs output (response) view;
 * `unrepresentable: "any"` keeps conversion total for shapes JSON Schema can't
 * express (dates, etc.) rather than throwing.
 */
export function zodToJsonSchema(
  schema: z.ZodType,
  io: "input" | "output" = "output"
): Record<string, unknown> {
  return z.toJSONSchema(schema, { io, unrepresentable: "any" }) as Record<
    string,
    unknown
  >;
}
