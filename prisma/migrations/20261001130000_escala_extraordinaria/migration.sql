-- Remove leftover "evento noite" rows before dropping the turno column,
-- otherwise recreating the (data, funcaoId) unique index below would fail
-- on any duplicate left behind by the feature being replaced here.
DELETE FROM "Atribuicao" WHERE "turno" = 'NOITE';

-- DropIndex
DROP INDEX "Atribuicao_data_funcaoId_turno_key";

-- AlterTable
ALTER TABLE "Atribuicao" DROP COLUMN "turno";

-- AlterTable
ALTER TABLE "CultoNota" DROP COLUMN "temEventoNoite";

-- CreateTable
CREATE TABLE "EventoExtra" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "horario" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoExtraAtribuicao" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "funcaoId" TEXT NOT NULL,
    "nomeEscalado" TEXT,

    CONSTRAINT "EventoExtraAtribuicao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventoExtraAtribuicao_eventoId_funcaoId_key" ON "EventoExtraAtribuicao"("eventoId", "funcaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Atribuicao_data_funcaoId_key" ON "Atribuicao"("data", "funcaoId");

-- AddForeignKey
ALTER TABLE "EventoExtraAtribuicao" ADD CONSTRAINT "EventoExtraAtribuicao_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoExtra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoExtraAtribuicao" ADD CONSTRAINT "EventoExtraAtribuicao_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "Funcao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
