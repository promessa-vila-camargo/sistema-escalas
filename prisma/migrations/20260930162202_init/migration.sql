-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VOLUNTARIO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VOLUNTARIO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funcao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "categoriaId" TEXT NOT NULL,

    CONSTRAINT "Funcao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFuncao" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "funcaoId" TEXT NOT NULL,

    CONSTRAINT "UserFuncao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atribuicao" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "funcaoId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Atribuicao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "UserFuncao_userId_funcaoId_key" ON "UserFuncao"("userId", "funcaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Atribuicao_data_funcaoId_key" ON "Atribuicao"("data", "funcaoId");

-- AddForeignKey
ALTER TABLE "Funcao" ADD CONSTRAINT "Funcao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFuncao" ADD CONSTRAINT "UserFuncao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFuncao" ADD CONSTRAINT "UserFuncao_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "Funcao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atribuicao" ADD CONSTRAINT "Atribuicao_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "Funcao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atribuicao" ADD CONSTRAINT "Atribuicao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
