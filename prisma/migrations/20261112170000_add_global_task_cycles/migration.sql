ALTER TABLE "TaskProgress" ADD COLUMN "cycleStart" TIMESTAMP(3);

UPDATE "TaskProgress"
SET "cycleStart" = (
  date_trunc('day', "startedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
);

ALTER TABLE "TaskProgress" ALTER COLUMN "cycleStart" SET NOT NULL;

DROP INDEX "TaskProgress_taskId_userId_key";

CREATE UNIQUE INDEX "TaskProgress_taskId_userId_cycleStart_key"
ON "TaskProgress"("taskId", "userId", "cycleStart");

CREATE INDEX "TaskProgress_userId_cycleStart_idx"
ON "TaskProgress"("userId", "cycleStart");