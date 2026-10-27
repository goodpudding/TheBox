-- The reserve list was filled with the seeded demo shop (ids m-*).
-- Remove those machines so the live shop starts empty and real equipment
-- is added from Admin → Machines. Portal-created machines use other ids.

DELETE FROM "CreditLedgerEntry"
WHERE "equipmentJobId" IN (SELECT "id" FROM "EquipmentJob" WHERE "machineId" LIKE 'm-%')
   OR "usageSessionId" IN (SELECT "id" FROM "UsageSession" WHERE "machineId" LIKE 'm-%')
   OR "workstationSessionId" IN (
        SELECT "id" FROM "WorkstationSession"
        WHERE "billedMachineId" LIKE 'm-%'
           OR "workstationId" IN (SELECT "id" FROM "Workstation" WHERE "billedMachineId" LIKE 'm-%')
      );

DELETE FROM "WorkstationLaunch"
WHERE "machineId" LIKE 'm-%'
   OR "workstationId" IN (SELECT "id" FROM "Workstation" WHERE "billedMachineId" LIKE 'm-%');

DELETE FROM "EquipmentJob"
WHERE "machineId" LIKE 'm-%'
   OR "workstationId" IN (SELECT "id" FROM "Workstation" WHERE "billedMachineId" LIKE 'm-%');

DELETE FROM "WorkstationLoginChallenge"
WHERE "workstationId" IN (SELECT "id" FROM "Workstation" WHERE "billedMachineId" LIKE 'm-%');

DELETE FROM "MachineSoftwareMap"
WHERE "machineId" LIKE 'm-%'
   OR "workstationId" IN (SELECT "id" FROM "Workstation" WHERE "billedMachineId" LIKE 'm-%');

DELETE FROM "WorkstationSession"
WHERE "billedMachineId" LIKE 'm-%'
   OR "workstationId" IN (SELECT "id" FROM "Workstation" WHERE "billedMachineId" LIKE 'm-%');

DELETE FROM "Workstation" WHERE "billedMachineId" LIKE 'm-%';

DELETE FROM "AccessLog" WHERE "machineId" LIKE 'm-%';
DELETE FROM "UsageSession" WHERE "machineId" LIKE 'm-%';
DELETE FROM "MaintenanceBlock" WHERE "machineId" LIKE 'm-%';
DELETE FROM "Reservation" WHERE "machineId" LIKE 'm-%';

DELETE FROM "Machine" WHERE "id" LIKE 'm-%';
