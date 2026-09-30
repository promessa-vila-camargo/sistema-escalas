import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_USERNAME = process.env.ADMIN_SEED_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? "escalas2026admin";

const CATEGORIAS = [
  {
    nome: "Direção e Palavra",
    ordem: 1,
    funcoes: ["Diretor(a)", "Palavra Pastoral", "Pregador"],
  },
  {
    nome: "Mídia",
    ordem: 2,
    funcoes: ["Mídia", "Datashow"],
  },
  {
    nome: "Transmissão",
    ordem: 3,
    funcoes: ["Operador de transmissão", "Câmera fixa", "Câmera móvel 1", "Câmera móvel 2"],
  },
  {
    nome: "Som",
    ordem: 4,
    funcoes: ["Mesa de som", "Som transmissão"],
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
            create: cat.funcoes.map((nome, i) => ({ nome, ordem: i + 1 })),
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
