-- Uploaded pictures (inventory photos, gallery pictures) are kept in the
-- database: a Worker has no disk to write uploads to.
CREATE TABLE IF NOT EXISTS "StoredFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mimeType" TEXT NOT NULL,
    "bytes" BLOB NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'temp',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "StoredFile_folder_createdAt_idx" ON "StoredFile"("folder", "createdAt");
