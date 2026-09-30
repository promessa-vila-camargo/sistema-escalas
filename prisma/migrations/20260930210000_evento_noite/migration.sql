-- DropIndex
DROP INDEX "Atribuicao_data_funcaoId_key";

-- AlterTable
ALTER TABLE "Atribuicao" ADD COLUMN     "turno" TEXT NOT NULL DEFAULT 'DIA';

-- AlterTable
ALTER TABLE "CultoNota" ADD COLUMN     "temEventoNoite" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "texto" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Atribuicao_data_funcaoId_turno_key" ON "Atribuicao"("data", "funcaoId", "turno");
