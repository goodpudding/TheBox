import { redirect } from "next/navigation";

/** Member certifications live under Learn — keep this path for old links. */
export default function CertificationsRedirectPage() {
  redirect("/learn");
}
