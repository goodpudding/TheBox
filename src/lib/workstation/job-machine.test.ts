import { describe, expect, it } from "vitest";
import { jobMachineIdFor } from "./job-machine";

describe("jobMachineIdFor", () => {
  it("is the desk's own machine on a laser desk, even when the shop has a 3D printer", () => {
    // Sending used to pick the first printer here while the estimate showed
    // the laser, so the job was refused for having no filament weight.
    expect(
      jobMachineIdFor({
        chosenMachineId: "",
        deskMachineId: "m-laser",
        deskBillsByGram: false,
        firstPrinterId: "m-printer",
      }),
    ).toBe("m-laser");
  });

  it("is the first printer on a desk that bills by the gram", () => {
    expect(
      jobMachineIdFor({
        chosenMachineId: "",
        deskMachineId: "m-printer-2",
        deskBillsByGram: true,
        firstPrinterId: "m-printer-1",
      }),
    ).toBe("m-printer-1");
  });

  it("is the machine the member picked", () => {
    expect(
      jobMachineIdFor({
        chosenMachineId: "m-cnc",
        deskMachineId: "m-laser",
        deskBillsByGram: false,
        firstPrinterId: "m-printer",
      }),
    ).toBe("m-cnc");
  });

  it("is empty when the desk knows no machine", () => {
    expect(
      jobMachineIdFor({
        chosenMachineId: "",
        deskMachineId: undefined,
        deskBillsByGram: false,
        firstPrinterId: undefined,
      }),
    ).toBe("");
  });
});
