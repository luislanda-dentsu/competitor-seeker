import { THEME_INIT_SCRIPT } from "@/lib/theme";

/**
 * Script inline que fija data-theme (y data-sidebar) en <html> antes del
 * primer paint. Va en <head>; no depende de React ni de hidratación.
 */
export function ThemeScript(): React.ReactElement {
  return (
    <script
      id="cs-theme-init"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: script estático y autocontenido
      dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
    />
  );
}
