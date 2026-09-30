import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_USERNAME = process.env.ADMIN_SEED_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? "escalas2026admin";

const TODOS_OS_DIAS = [0, 3, 6]; // domingo, quarta, sábado
const SO_FIM_DE_SEMANA = [0, 6]; // domingo, sábado

type FuncaoSeed = { nome: string; diasSemana?: number[] };

const CATEGORIAS: { nome: string; ordem: number; funcoes: FuncaoSeed[] }[] = [
  { nome: "Direção", ordem: 1, funcoes: [{ nome: "Diretor(a)" }] },
  {
    nome: "Palavra e Pregação",
    ordem: 2,
    funcoes: [{ nome: "Palavra Pastoral" }, { nome: "Pregador" }],
  },
  { nome: "Mídia", ordem: 3, funcoes: [{ nome: "Mídia" }] },
  { nome: "Datashow", ordem: 4, funcoes: [{ nome: "Datashow", diasSemana: SO_FIM_DE_SEMANA }] },
  {
    nome: "Transmissão",
    ordem: 5,
    funcoes: [
      { nome: "Operador de Transmissão", diasSemana: SO_FIM_DE_SEMANA },
      { nome: "Câmera Fixa", diasSemana: SO_FIM_DE_SEMANA },
      { nome: "Câmera Móvel 1", diasSemana: SO_FIM_DE_SEMANA },
      { nome: "Câmera Móvel 2", diasSemana: SO_FIM_DE_SEMANA },
    ],
  },
  {
    nome: "Som",
    ordem: 6,
    funcoes: [{ nome: "Mesa de Som" }, { nome: "Som da Transmissão" }],
  },
];

/**
 * Só cria o primeiro admin (upsert por username) e a taxonomia padrão de
 * categorias/funções, se ainda não existir nenhuma categoria — assim rodar o
 * seed de novo depois de o admin já ter editado tudo não reseta nada.
 */
async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: {},
    create: { username: ADMIN_USERNAME, nome: "Administrador", passwordHash, role: "ADMIN" },
  });

  const existentes = await prisma.categoria.count();
  if (existentes === 0) {
    for (const cat of CATEGORIAS) {
      await prisma.categoria.create({
        data: {
          nome: cat.nome,
          ordem: cat.ordem,
          funcoes: {
            create: cat.funcoes.map((f, i) => ({ nome: f.nome, ordem: i + 1, diasSemana: f.diasSemana ?? TODOS_OS_DIAS })),
          },
        },
      });
    }
  }

  console.log("Seed concluído.");
  console.log(`Login admin: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  console.log("Troque essa senha em /conta assim que logar, e cadastre os voluntários em /admin/pessoas.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
