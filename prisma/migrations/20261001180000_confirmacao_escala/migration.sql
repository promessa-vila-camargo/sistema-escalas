-- CreateEnum
CREATE TYPE "StatusConfirmacao" AS ENUM ('AGUARDANDO', 'CONFIRMADO', 'TROCA_SOLICITADA');

-- AlterTable
ALTER TABLE "Atribuicao"
  ADD COLUMN "status" "StatusConfirmacao" NOT NULL DEFAULT 'AGUARDANDO',
  ADD COLUMN "confirmadoEm" TIMESTAMP(3),
  ADD COLUMN "trocaObservacao" TEXT,
  ADD COLUMN "trocaSolicitadaEm" TIMESTAMP(3);
