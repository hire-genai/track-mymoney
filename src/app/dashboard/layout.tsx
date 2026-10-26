import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { FinanceProvider } from "@/context/FinanceContext";
import { loadUserData } from "@/lib/user-data";

export const instant = false;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { txns, importsByPerson } = await loadUserData(user.id);

  return (
    <FinanceProvider initialTxns={txns} importsByPerson={importsByPerson} authenticated>
      {children}
    </FinanceProvider>
  );
}
