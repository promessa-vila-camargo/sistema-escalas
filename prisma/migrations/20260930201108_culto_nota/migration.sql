-- CreateTable
CREATE TABLE "CultoNota" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "texto" TEXT NOT NULL,

    CONSTRAINT "CultoNota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CultoNota_data_key" ON "CultoNota"("data");
