/**
 * Builds the local database the kiosk browser tests sign in against.
 *
 * Usage: npm run e2e:db   (stop `next dev` first: it holds the database open)
 *
 * `next dev` reaches the database through the D1 binding in wrangler.jsonc,
 * which Miniflare keeps as a SQLite file under .wrangler/state/v3/d1. This
 * script deletes that local database, applies migrations/*.sql in order the
 * way the deploy does, then adds one desk, three members and one staff
 * account. The rows go in after the migrations because 0007 to 0009 delete
 * example machines and people, and through Prisma so dates are stored the way
 * the app stores them.
 *
 * It must never reach the live database: test members with a known PIN do not
 * belong there. So Wrangler runs with --local, the seed uses a binding with
 * remote access switched off, and any Cloudflare API credentials are removed
 * from the environment before either one starts.
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@prisma/client";
import { getPlatformProxy } from "wrangler";
import {
  KIOSK_DEVICE_ID,
  KIOSK_MEMBER,
  KIOSK_PIN,
  KIOSK_RESET_MEMBER,
  KIOSK_STAFF,
  KIOSK_TYPO_MEMBER,
} from "../e2e/kiosk-fixtures";
import { hashKioskPin } from "../src/lib/workstation/pin";

type D1Binding = ConstructorParameters<typeof PrismaD1>[0];

const root = process.cwd();
const localD1 = path.join(root, ".wrangler", "state", "v3", "d1");

const MACHINE_ID = "m-bambu-a1";
const CERT_IDS = ["cert-shop-orientation", "cert-3d-printing"];

for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY", "CLOUDFLARE_EMAIL"]) {
  delete process.env[name];
}

function applyMigrations() {
  const run = spawnSync(
    "npx",
    ["wrangler", "d1", "migrations", "apply", "thebox-db", "--local"],
    {
      cwd: root,
      stdio: "inherit",
      // CI=true answers Wrangler's "apply these migrations?" prompt.
      env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
    },
  );
  if (run.status !== 0) {
    throw new Error("wrangler d1 migrations apply --local failed");
  }
}

async function seed(prisma: PrismaClient) {
  await prisma.certification.create({
    data: {
      id: "cert-shop-orientation",
      slug: "shop-orientation",
      name: "Shop Orientation",
      description: "Shop rules and safety walkthrough.",
      requiresCertificationIds: "[]",
    },
  });
  await prisma.certification.create({
    data: {
      id: "cert-3d-printing",
      slug: "3d-printing",
      name: "3D Printing (FDM)",
      description: "FDM printer setup, slicing and filament basics.",
      requiresCertificationIds: JSON.stringify(["cert-shop-orientation"]),
    },
  });
  await prisma.machine.create({
    data: {
      id: MACHINE_ID,
      name: "Bambu Lab A1",
      area: "3d_printing",
      requiredCertificationIds: JSON.stringify(CERT_IDS),
      readerKey: "reader-3d-bambu-a1",
      locationLabel: "3D lab",
    },
  });
  await prisma.workstation.create({
    data: {
      id: "ws-pc-1",
      name: "Design PC 1",
      deviceId: KIOSK_DEVICE_ID,
      location: "3D lab",
      billedMachineId: MACHINE_ID,
    },
  });
  await prisma.machineSoftwareMap.create({
    data: {
      id: "map-bambu",
      machineId: MACHINE_ID,
      displayName: "Bambu Studio",
      exeName: "bambu-studio.exe",
      sortOrder: 1,
    },
  });

  for (const member of [KIOSK_MEMBER, KIOSK_TYPO_MEMBER, KIOSK_RESET_MEMBER]) {
    await prisma.user.create({
      data: {
        id: member.id,
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
        displayName: `${member.firstName} ${member.lastName}`,
        role: "member",
        status: "active",
        tier: "maker",
        shopAccess: true,
        profileComplete: true,
        // Only the scrypt hash is stored, as for a real member.
        kioskPinHash: await hashKioskPin(KIOSK_PIN),
      },
    });
    // No expiry date, so the tests do not depend on today's date.
    for (const certificationId of CERT_IDS) {
      await prisma.userCertification.create({
        data: {
          id: `uc-${member.id}-${certificationId}`,
          userId: member.id,
          certificationId,
          status: "certified",
        },
      });
    }
  }

  // Staff only reset a PIN in the tests, so no PIN and no certifications.
  await prisma.user.create({
    data: {
      id: KIOSK_STAFF.id,
      email: KIOSK_STAFF.email,
      firstName: KIOSK_STAFF.firstName,
      lastName: KIOSK_STAFF.lastName,
      displayName: `${KIOSK_STAFF.firstName} ${KIOSK_STAFF.lastName}`,
      role: "staff",
      status: "active",
      shopAccess: true,
      profileComplete: true,
    },
  });
}

async function main() {
  rmSync(localD1, { recursive: true, force: true });
  applyMigrations();

  const proxy = await getPlatformProxy<{ DB: D1Binding }>({
    envFiles: [],
    remoteBindings: false,
  });
  const prisma = new PrismaClient({ adapter: new PrismaD1(proxy.env.DB) });
  try {
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
    await proxy.dispose();
  }
  console.log(
    `\nKiosk test database ready: desk ${KIOSK_DEVICE_ID}, members ${KIOSK_MEMBER.email}, ${KIOSK_TYPO_MEMBER.email} and ${KIOSK_RESET_MEMBER.email}, staff ${KIOSK_STAFF.email}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
