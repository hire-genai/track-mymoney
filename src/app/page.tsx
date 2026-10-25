import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { FinanceProvider } from "@/context/FinanceContext";
import DashboardApp from "@/components/dashboard/DashboardApp";

export const instant = false;

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <FinanceProvider>
      <DashboardApp user={null} />
    </FinanceProvider>
  );
}
