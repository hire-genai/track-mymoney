import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import Landing from "@/components/landing/Landing";

export const instant = false;

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return <Landing />;
}
