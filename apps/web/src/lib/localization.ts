import {
  LOCALE_LABELS,
  translateProductShellText,
  type SupportedLocale
} from "@periscan/shared";

export { LOCALE_LABELS };

export function translateUiText(locale: SupportedLocale, value: string) {
  return translateProductShellText(locale, value);
}
