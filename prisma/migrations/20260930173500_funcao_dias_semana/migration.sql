-- AlterTable
ALTER TABLE "Funcao" ADD COLUMN     "diasSemana" INTEGER[] DEFAULT ARRAY[0, 3, 6]::INTEGER[];
