import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FDS = [0, 6];

/**
 * Divide a taxonomia atual (3 ministérios) em 6, mais granular, pra bater
 * com a identidade visual do PDF: Direção (só Diretor(a)), Palavra e
 * Pregação, Mídia (só Mídia), Datashow (próprio), Transmissão (própria,
 * agora sem quarta) e Som. Idempotente — rodar de novo não duplica.
 */
async function main() {
  const direcao = await prisma.categoria.findFirst({ where: { nome: "Direção" } });
  const midia = await prisma.categoria.findFirst({ where: { nome: "Mídia" } });

  if (!direcao || !midia) {
    console.log("Categorias base não encontradas (talvez já divididas). Nada a fazer.");
    return;
  }

  // Palavra e Pregação: nova categoria, recebe Palavra Pastoral + Pregador de Direção.
  const jaExistePalavra = await prisma.categoria.findFirst({ where: { nome: "Palavra e Pregação" } });
  if (!jaExistePalavra) {
    const palavra = await prisma.categoria.create({ data: { nome: "Palavra e Pregação", ordem: 2 } });
    const moverPalavra = await prisma.funcao.findMany({
      where: { categoriaId: direcao.id, nome: { in: ["Palavra Pastoral", "Pregador"] } },
    });
    for (const [i, f] of moverPalavra.entries()) {
      await prisma.funcao.update({ where: { id: f.id }, data: { categoriaId: palavra.id, ordem: i + 1 } });
    }
    console.log(`Criada "Palavra e Pregação" com ${moverPalavra.length} função(ões).`);
  }

  // Datashow: nova categoria própria, recebe a função Datashow de Mídia.
  const jaExisteDatashow = await prisma.categoria.findFirst({ where: { nome: "Datashow" } });
  if (!jaExisteDatashow) {
    const datashowCat = await prisma.categoria.create({ data: { nome: "Datashow", ordem: 4 } });
    const funcaoDatashow = await prisma.funcao.findFirst({ where: { categoriaId: midia.id, nome: "Datashow" } });
    if (funcaoDatashow) {
      await prisma.funcao.update({ where: { id: funcaoDatashow.id }, data: { categoriaId: datashowCat.id, ordem: 1, diasSemana: FDS } });
      console.log('Movida "Datashow" para categoria própria.');
    }
  }

  // Transmissão: nova categoria própria, recebe Operador/Câmeras de Mídia, sem quarta.
  const jaExisteTransmissao = await prisma.categoria.findFirst({ where: { nome: "Transmissão" } });
  if (!jaExisteTransmissao) {
    const transmissaoCat = await prisma.categoria.create({ data: { nome: "Transmissão", ordem: 5 } });
    const funcoesTransmissao = await prisma.funcao.findMany({
      where: { categoriaId: midia.id, nome: { in: ["Operador de Transmissão", "Câmera Fixa", "Câmera Móvel 1", "Câmera Móvel 2"] } },
      orderBy: { ordem: "asc" },
    });
    for (const [i, f] of funcoesTransmissao.entries()) {
      await prisma.funcao.update({ where: { id: f.id }, data: { categoriaId: transmissaoCat.id, ordem: i + 1, diasSemana: FDS } });
    }
    console.log(`Criada "Transmissão" com ${funcoesTransmissao.length} função(ões), sem quarta-feira.`);
  }

  // Reordena as categorias finais: Direção, Palavra e Pregação, Mídia, Datashow, Transmissão, Som.
  const ordemFinal = ["Direção", "Palavra e Pregação", "Mídia", "Datashow", "Transmissão", "Som"];
  for (const [i, nome] of ordemFinal.entries()) {
    await prisma.categoria.updateMany({ where: { nome }, data: { ordem: i + 1 } });
  }

  console.log("Concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
