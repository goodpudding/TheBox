import { describe, expect, it } from "vitest";
import { databaseErrorMessage } from "./db-errors";

function prismaError(name: string, message: string, code?: string) {
  return Object.assign(new Error(message), { name, code });
}

describe("databaseErrorMessage", () => {
  it("leaves the app's own errors alone", () => {
    expect(databaseErrorMessage(new Error("Class is full"))).toBeNull();
    expect(databaseErrorMessage("nope")).toBeNull();
  });

  it("names the field when a value is already taken", () => {
    const err = prismaError(
      "PrismaClientKnownRequestError",
      "\nInvalid `prisma.machine.upsert()` invocation:\n\n\nUnique constraint failed on the fields: (`readerKey`)",
      "P2002",
    );
    expect(databaseErrorMessage(err)).toBe(
      "That reader key is already in use. Choose a different one.",
    );
  });

  it("never repeats the database's own words", () => {
    const err = prismaError(
      "PrismaClientValidationError",
      "\nInvalid `prisma.machine.upsert()` invocation:\n\n{\n  where: { id: \"m-1\" }\n}\n\nArgument `readerKey` is missing.",
    );
    const message = databaseErrorMessage(err);
    expect(message).toBe("That could not be saved. Please try again.");
  });

  it("recognises a database error by its code when the name is gone", () => {
    expect(databaseErrorMessage(Object.assign(new Error("boom"), { code: "P2003" }))).toBe(
      "That could not be saved. Please try again.",
    );
  });
});
