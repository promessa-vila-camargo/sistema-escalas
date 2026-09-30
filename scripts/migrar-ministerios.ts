import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Reestrutura a taxonomia existente pra bater com o pedido: 3 ministérios
 * (Direção, Mídia, Som), com as funções de transmissão movidas pra dentro
 * de Mídia em vez de uma categoria própria. Roda uma vez só, é idempotente
 * (rodar de novo não duplica nem quebra nada).
 */
async function main() {
  const midia = await prisma.categoria.findFirst({ where: { nome: "Mídia" } });
  const transmissao = await prisma.categoria.findFirst({ where: { nome: "Transmissão" } });
  const direcao = await prisma.categoria.findFirst({ where: { nome: "Direção e Palavra" } });

  if (direcao) {
    await prisma.categoria.update({ where: { id: direcao.id }, data: { nome: "Direção" } });
    console.log("Renomeado: Direção e Palavra -> Direção");
  }

  if (midia && transmissao) {
    const maxOrdem = await prisma.funcao.aggregate({ _max: { ordem: true }, where: { categoriaId: midia.id } });
    let ordem = (maxOrdem._max.ordem ?? 0) + 1;
    const funcoesTransmissao = await prisma.funcao.findMany({ where: { categoriaId: transmissao.id }, orderBy: { ordem: "asc" } });
    for (const f of funcoesTransmissao) {
      await prisma.funcao.update({ where: { id: f.id }, data: { categoriaId: midia.id, ordem: ordem++ } });
    }
    await prisma.categoria.delete({ where: { id: transmissao.id } });
    console.log(`Movidas ${funcoesTransmissao.length} função(ões) de Transmissão para Mídia; categoria Transmissão removida.`);
  }

  const renomeios: Record<string, string> = {
    "Câmera fixa": "Câmera Fixa",
    "Câmera móvel 1": "Câmera Móvel 1",
    "Câmera móvel 2": "Câmera Móvel 2",
    "Mesa de som": "Mesa de Som",
    "Som transmissão": "Som da Transmissão",
    "Operador de transmissão": "Operador de Transmissão",
  };
  for (const [antigo, novo] of Object.entries(renomeios)) {
    const r = await prisma.funcao.updateMany({ where: { nome: antigo }, data: { nome: novo } });
    if (r.count > 0) console.log(`Renomeado: "${antigo}" -> "${novo}" (${r.count})`);
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
