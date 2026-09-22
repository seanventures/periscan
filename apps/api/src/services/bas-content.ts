import { previewBasContent } from "@periscan/modules";
import {
  AppServiceError,
  requireRole,
  TENANT_ADMIN_ROLES
} from "../runtime-services.js";
import type { AppServices } from "../runtime-services.js";

export function createBasContentServices(): Pick<
  AppServices,
  "previewBasContent"
> {
  return {
    async previewBasContent(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "preview BAS content"
      );
      try {
        return previewBasContent(input);
      } catch {
        throw new AppServiceError(
          "Invalid BAS scenario content.",
          400,
          "bas_content_invalid"
        );
      }
    }
  };
}
