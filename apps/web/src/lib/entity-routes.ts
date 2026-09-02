/**
 * Web re-export of shared ontology deep-links (P11R-3).
 *
 * Single source of truth lives in `@periscan/shared` (`DEDICATED_HREF`,
 * `ontologyEntityHref`, `OBJECT_EXPLORER_TYPES`). Do not reintroduce a
 * parallel ENTITY_ROUTE map here — divergence is the bug we closed.
 *
 * Full graph neighborhood Object Explorer remains a separate surface
 * (`object-workspace`); this module is type → honest href only.
 */

export {
  DEDICATED_HREF,
  OBJECT_EXPLORER_TYPES,
  entityHref,
  hasEntityRoute,
  objectExplorerHref,
  ontologyEntityHref,
  ontologyHasEntityHref
} from "@periscan/shared";
