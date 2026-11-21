/**
 * Which machine a job at a desk is for.
 *
 * The estimate on the screen and the job that is sent must name the same
 * machine, or the member is shown one price and the server prices another.
 * Both call this. A machine the member picked wins. Otherwise it is the
 * desk's own machine, except that a desk that bills by the gram defaults to
 * the first 3D printer.
 */
export function jobMachineIdFor(input: {
  chosenMachineId: string;
  deskMachineId: string | undefined;
  deskBillsByGram: boolean;
  firstPrinterId: string | undefined;
}): string {
  return (
    input.chosenMachineId ||
    (input.deskBillsByGram ? input.firstPrinterId : undefined) ||
    input.deskMachineId ||
    ""
  );
}
