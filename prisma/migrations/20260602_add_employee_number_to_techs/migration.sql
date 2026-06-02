ALTER TABLE "techs"
ADD COLUMN "employeeNumber" TEXT;

CREATE UNIQUE INDEX "techs_employeeNumber_key"
ON "techs"("employeeNumber");
