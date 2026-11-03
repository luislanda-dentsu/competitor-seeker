import { NotFoundSwitch } from "@/components/app/states/NotFoundSwitch";

export const metadata = { title: "No encontrado" };

/** 404 global dentro del shell. */
export default function NotFound(): React.ReactElement {
  return <NotFoundSwitch />;
}
