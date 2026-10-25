import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { FinanceProvider } from "@/context/FinanceContext";

export const instant = false;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <FinanceProvider>{children}</FinanceProvider>;
}
