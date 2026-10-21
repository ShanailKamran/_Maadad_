import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuthView } from "@/components/maddad/AuthView";

export const metadata: Metadata = {
  title: "Create Account · Maddad Lahore",
  description: "Create an account on Maddad Lahore to post plumbing & electrical jobs or bid as an independent technician.",
};

export default async function SignUpPage() {
  const user = await getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div style={{ padding: "16px 0 32px" }}>
      <AuthView
        currentUser={null}
        initialMode="signup"
        onNavigateMarketplace={() => {
          if (typeof window !== "undefined") window.location.href = "/";
        }}
        showToast={() => {}}
      />
    </div>
  );
}
