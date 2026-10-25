import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import DashboardApp from "@/components/dashboard/DashboardApp";

export const instant = false;

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <DashboardApp user={user} />;
}
