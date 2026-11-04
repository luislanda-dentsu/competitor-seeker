import { Suspense } from "react";
import { Resumen } from "@/components/app/home/Resumen";
import { GitConflictBanner } from "@/components/app/shell/GitConflictBanner";
import Loading from "./loading";

export const metadata = { title: "Resumen" };

/**
 * Home: la isla <Resumen/> lee cookie (marca activa) y disco, así que va en
 * Suspense (Cache Components); el shell y el skeleton se sirven estáticos.
 */
export default function ResumenPage(): React.ReactElement {
  return (
    <>
    <GitConflictBanner />
    <Suspense fallback={<Loading />}>
      <Resumen />
    </Suspense>
    </>
  );
}
