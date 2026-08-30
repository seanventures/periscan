/**
 * Cytoscape does not accept CSS Color 4 eight-digit hex values even though
 * browsers do. Convert design-token values such as `#ffffff38` to rgba while
 * preserving ordinary CSS colors unchanged.
 */
export function toCytoscapeColor(value: string): string {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})([\da-f]{2})$/iu.exec(
    value.trim()
  );

  if (!match) {
    return value;
  }

  const [, red, green, blue, alpha] = match;
  const opacity = Number((Number.parseInt(alpha!, 16) / 255).toFixed(3));

  return `rgba(${Number.parseInt(red!, 16)}, ${Number.parseInt(
    green!,
    16
  )}, ${Number.parseInt(blue!, 16)}, ${opacity})`;
}
