/**
 * Testes das regras de seleção de datas da exportação/compartilhamento.
 * Rodar com: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agruparDatas,
  cabecalhoDocumento,
  cultosExportaveis,
  mensagemWhatsapp,
  pendenciasDoDia,
  CONTEUDO_COMPLETO,
  type DadosEscala,
} from "../src/lib/exportacao";

// Outubro/2026: quartas 7,14,21,28 · sábados 3,10,17,24,31 · domingos 4,11,18,25 (+ domingo 01/11 vizinho)
const dados: DadosEscala = {
  categorias: [
    { id: "c1", nome: "Direção", funcoes: [{ id: "dir", nome: "Diretor(a)", diasSemana: [0, 3, 6] }] },
    { id: "c2", nome: "Palavra e Pregação", funcoes: [{ id: "pp", nome: "Palavra Pastoral", diasSemana: [0, 3, 6] }] },
    { id: "c3", nome: "Datashow", funcoes: [{ id: "ds", nome: "Datashow", diasSemana: [0, 6] }] },
  ],
  atribuicoes: {
    "2026-10-17": { dir: "ANA", pp: "BRUNO", ds: "CAIO" },
    "2026-10-18": { dir: "DANI", pp: "EDU", ds: "CAIO" },
    "2026-10-21": { dir: "FABI", pp: "GIL" },
    "2026-11-01": { dir: "HUGO" },
  },
  observacoes: { "2026-10-18": "Santa ceia" },
  ministerios: { "2026-10-18": "LITURGIA" },
  atividades: { "2026-10-18": [{ titulo: "Café", horario: "08:00", ministerio: null }] },
};

test("lista do mês inclui todos os cultos e o domingo vizinho da virada", () => {
  const lista = cultosExportaveis(2026, 9);
  assert.equal(lista.length, 14);
  assert.deepEqual(
    lista.filter((c) => c.vizinho).map((c) => c.data),
    ["2026-11-01"]
  );
  assert.deepEqual(
    lista.map((c) => c.data),
    [...lista.map((c) => c.data)].sort()
  );
});

test("um domingo selecionado gera só aquele domingo", () => {
  assert.deepEqual(agruparDatas(["2026-10-18"]), [{ tipo: "unico", data: "2026-10-18" }]);
  const msg = mensagemWhatsapp(dados, ["2026-10-18"], CONTEUDO_COMPLETO, 2026, 9);
  assert.match(msg, /Domingo, 18\/10\/2026/);
  assert.match(msg, /DANI/);
  assert.doesNotMatch(msg, /ANA|FABI|HUGO/);
  assert.equal(cabecalhoDocumento(["2026-10-18"], 2026, 9).titulo, "Domingo, 18 de outubro de 2026");
});

test("um sábado selecionado NÃO puxa o domingo junto", () => {
  assert.deepEqual(agruparDatas(["2026-10-17"]), [{ tipo: "unico", data: "2026-10-17" }]);
  const msg = mensagemWhatsapp(dados, ["2026-10-17"], CONTEUDO_COMPLETO, 2026, 9);
  assert.match(msg, /Sábado, 17\/10\/2026/);
  assert.match(msg, /ANA/);
  assert.doesNotMatch(msg, /DANI|EDU/);
});

test("sábado + domingo selecionados ficam lado a lado como fim de semana", () => {
  assert.deepEqual(agruparDatas(["2026-10-18", "2026-10-17"]), [
    { tipo: "fds", sab: "2026-10-17", dom: "2026-10-18" },
  ]);
  assert.equal(cabecalhoDocumento(["2026-10-17", "2026-10-18"], 2026, 9).titulo, "17 e 18 de outubro de 2026");
});

test("datas não consecutivas saem só elas, em ordem cronológica", () => {
  const sel = ["2026-10-28", "2026-10-04", "2026-10-17"];
  assert.deepEqual(agruparDatas(sel), [
    { tipo: "unico", data: "2026-10-04" },
    { tipo: "unico", data: "2026-10-17" },
    { tipo: "unico", data: "2026-10-28" },
  ]);
  const msg = mensagemWhatsapp(dados, sel, CONTEUDO_COMPLETO, 2026, 9);
  const dias = [...msg.matchAll(/\*(Domingo|Sábado|Quarta-feira) · (\d\d\/\d\d)\*/g)].map((m) => m[2]);
  assert.deepEqual(dias, ["04/10", "17/10", "28/10"]);
  assert.equal(cabecalhoDocumento(sel, 2026, 9).rotulo, "Escala · 3 cultos selecionados");
});

test("mês inteiro funciona como a exportação mensal (fins de semana pareados, inclusive na virada)", () => {
  const todas = cultosExportaveis(2026, 9).map((c) => c.data);
  const blocos = agruparDatas(todas);
  assert.equal(blocos.filter((b) => b.tipo === "fds").length, 5);
  assert.deepEqual(blocos.at(-1), { tipo: "fds", sab: "2026-10-31", dom: "2026-11-01" });
  assert.equal(cabecalhoDocumento(todas, 2026, 9).titulo, "Outubro de 2026");
  assert.equal(cabecalhoDocumento(todas, 2026, 9).rotulo, "Escala do mês");
});

test("datas duplicadas não duplicam o conteúdo", () => {
  assert.equal(agruparDatas(["2026-10-18", "2026-10-18"]).length, 1);
});

test("quarta usa o rótulo Apoio no lugar de Palavra Pastoral", () => {
  const msg = mensagemWhatsapp(dados, ["2026-10-21"], CONTEUDO_COMPLETO, 2026, 9);
  assert.match(msg, /Apoio: GIL/);
  assert.doesNotMatch(msg, /Palavra Pastoral/);
  assert.doesNotMatch(msg, /Datashow/); // Datashow não vale na quarta
});

test("conteúdo filtrado: só as funções escolhidas entram e contam como pendência", () => {
  const conteudo = { funcoes: new Set(["ds"]), incluirAtividades: false };
  const msg = mensagemWhatsapp(dados, ["2026-10-18"], conteudo, 2026, 9);
  assert.match(msg, /Datashow: CAIO/);
  assert.doesNotMatch(msg, /DANI|Café/);
  assert.deepEqual(pendenciasDoDia(dados, "2026-10-04", conteudo), ["Datashow"]);
});

test("ministério, observação e atividades aparecem no culto certo", () => {
  const msg = mensagemWhatsapp(dados, ["2026-10-18"], CONTEUDO_COMPLETO, 2026, 9);
  assert.match(msg, /LITURGIA/);
  assert.match(msg, /Santa ceia/);
  assert.match(msg, /08:00 — Café/);
});
