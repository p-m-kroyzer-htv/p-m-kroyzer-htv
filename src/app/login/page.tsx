import { redirect } from "next/navigation";
import { isOwner } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "כניסה · מנויומטר" };

export default async function LoginPage() {
  if (await isOwner()) redirect("/");
  return <LoginForm />;
}
