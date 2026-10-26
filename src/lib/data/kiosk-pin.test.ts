import { beforeEach, describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";
import { verifyKioskPin } from "@/lib/workstation/pin";

describe("shop PIN provider", () => {
  beforeEach(() => {
    process.env.VITEST = "true";
  });

  it("stores a verifiable hash and clears a staff reset flag", async () => {
    const provider = createMockDataProvider("u-maya");
    const reset = await provider.adminResetMemberKioskPin("u-maya", "u-staff");
    expect(reset.user.kioskPinMustChange).toBe(true);
    expect(reset.temporaryPin).toMatch(/^\d{6}$/);
    const issued = provider.kioskPinRecord("u-maya");
    expect(issued?.hash.startsWith("scrypt:")).toBe(true);
    expect(await verifyKioskPin(reset.temporaryPin, issued?.hash)).toBe(true);
    const events = (await provider.adminListAuditEvents("u-maya")).filter(
      (event) => event.action === "member.pin_reset",
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.actorId).toBe("u-staff");
    expect(JSON.stringify(events[0]?.metadata ?? {})).not.toContain(
      reset.temporaryPin,
    );

    const updated = await provider.setMyKioskPin("u-maya", "4821");
    expect(updated.kioskPinSet).toBe(true);
    expect(updated.kioskPinMustChange).toBe(false);
    const saved = provider.kioskPinRecord("u-maya");
    expect(await verifyKioskPin("4821", saved?.hash)).toBe(true);
    expect(await verifyKioskPin(reset.temporaryPin, saved?.hash)).toBe(false);
    expect(saved?.hash).not.toContain("4821");
  });

  it("rejects a trivial PIN and a member trying to reset one", async () => {
    const provider = createMockDataProvider("u-admin");
    await expect(provider.setMyKioskPin("u-maya", "1234")).rejects.toThrow(
      /obvious/i,
    );
    await expect(
      provider.adminResetMemberKioskPin("u-maya", "u-jordan"),
    ).rejects.toThrow(/staff/i);
  });
});
