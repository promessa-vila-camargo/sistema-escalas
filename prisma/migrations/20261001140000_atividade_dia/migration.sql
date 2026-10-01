-- CreateTable
CREATE TABLE "AtividadeDia" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "titulo" TEXT NOT NULL,
    "horario" TEXT,
    "ministerio" TEXT,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtividadeDia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AtividadeDia_data_idx" ON "AtividadeDia"("data");
