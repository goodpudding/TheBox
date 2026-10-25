export function isWorkstationKioskPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/workstation") return true;
  if (pathname.startsWith("/workstation/")) {
    return !pathname.startsWith("/workstation/approve");
  }
  return false;
}
