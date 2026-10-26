import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ImportFlow from "@/components/import/ImportFlow";

export const instant = false;

export default async function DashboardImportPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <ImportFlow />;
}
