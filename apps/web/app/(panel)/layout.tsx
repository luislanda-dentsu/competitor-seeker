import { AppShell } from "@/components/app/shell/AppShell";

/** Todo el panel (con sesión) lleva la barra lateral y la superior; /entrar no. */
export default function PanelLayout({ children }: LayoutProps<"/">): React.ReactElement {
  return <AppShell>{children}</AppShell>;
}
