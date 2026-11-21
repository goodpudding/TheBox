-- Photo bytes kept in the database: a Worker has no disk to write uploads to.
-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mimeType" TEXT NOT NULL,
    "bytes" BLOB NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'temp',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "StoredFile_folder_createdAt_idx" ON "StoredFile"("folder", "createdAt");

