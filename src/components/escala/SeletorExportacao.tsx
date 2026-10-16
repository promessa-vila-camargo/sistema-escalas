"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
import { fmtDataExtenso, labelFuncao, nomeDiaSemanaLongo, nomeMes, nomeMesAbrev, tipoCulto } from "@/lib/datas";
import type { CultoExportavel } from "@/lib/exportacao";
import type { CategoriaDTO } from "@/components/EscalaBoard";

export type AcaoExportacao = "baixar" | "visualizar" | "whatsapp";

/** Atalhos de seleção — cada um SUBSTITUI a seleção por aquele conjunto (ajustes finos ficam nos checkboxes). */
const ATALHOS: { rotulo: string; dias: number[]; cor?: number }[] = [
  { rotulo: "Fins de semana", dias: [6, 0] },
  { rotulo: "Sábados", dias: [6], cor: 6 },
  { rotulo: "Domingos", dias: [0], cor: 0 },
  { rotulo: "Quartas", dias: [3], cor: 3 },
];

/** Cor de identificação do tipo de culto — a mesma usada no card e no PDF. */
export function corDoCulto(diaSemana: number) {
  if (diaSemana === 0) return "bg-orange-500";
  if (diaSemana === 6) return "bg-brand-700";
  return "bg-ink-700";
}

function CheckboxTri({
  checked,
  indeterminate,
  onChange,
  label,
  forte,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
  forte?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-3 rounded-[8px] px-2 select-none hover:bg-ink-100/60">
      <input ref={ref} type="checkbox" className="checkbox" checked={checked} onChange={onChange} />
      <span className={"text-[13.5px] " + (forte ? "font-semibold text-ink-900" : "text-ink-700")}>{label}</span>
    </label>
  );
}

/**
 * Escolha do que vai no PDF ou na mensagem: quais cultos (um, alguns, por
 * tipo ou o mês inteiro) e, opcionalmente, quais funções. A seleção é
 * controlada pelo quadro (fica guardada enquanto a tela está aberta), então
 * dá pra gerar o PDF e em seguida mandar no WhatsApp sem marcar tudo de novo.
 */
export default function SeletorExportacao({
  ano,
  mes,
  modo,
  cultos,
  progresso,
  datas,
  onDatasChange,
  categorias,
  funcoesExcluidas,
  onFuncoesExcluidasChange,
  incluirAtividades,
  onIncluirAtividadesChange,
  onCancelar,
  onConfirmar,
}: {
  ano: number;
  mes: number;
  modo: "pdf" | "whatsapp";
  cultos: CultoExportavel[];
  progresso: Record<string, { preenchidas: number; total: number }>;
  datas: string[];
  onDatasChange: (datas: string[]) => void;
  categorias: CategoriaDTO[];
  funcoesExcluidas: Set<string>;
  onFuncoesExcluidasChange: (s: Set<string>) => void;
  incluirAtividades: boolean;
  onIncluirAtividadesChange: (v: boolean) => void;
  onCancelar: () => void;
  onConfirmar: (acao: AcaoExportacao) => void;
}) {
  const [conteudoAberto, setConteudoAberto] = useState(funcoesExcluidas.size > 0);
  const selecionadas = new Set(datas);
  const total = cultos.length;
  const qtd = cultos.filter((c) => selecionadas.has(c.data)).length;
  const todasFuncoes = categorias.flatMap((c) => c.funcoes.map((f) => f.id));
  const funcoesIncluidas = todasFuncoes.filter((id) => !funcoesExcluidas.has(id)).length;
  const semFuncoes = todasFuncoes.length > 0 && funcoesIncluidas === 0;
  const podeConfirmar = qtd > 0 && !semFuncoes;

  function definir(novas: Set<string>) {
    onDatasChange(cultos.filter((c) => novas.has(c.data)).map((c) => c.data));
  }

  function alternarData(data: string) {
    const novas = new Set(selecionadas);
    if (novas.has(data)) novas.delete(data);
    else novas.add(data);
    definir(novas);
  }

  /** Datas de um atalho (ex.: todos os domingos do mês). */
  function datasDoAtalho(dias: number[]) {
    return cultos.filter((c) => dias.includes(c.diaSemana)).map((c) => c.data);
  }

  /** O atalho fica "ativo" quando a seleção é exatamente aquele conjunto. */
  function atalhoAtivo(datasAtalho: string[]) {
    return datasAtalho.length > 0 && datasAtalho.length === qtd && datasAtalho.every((d) => selecionadas.has(d));
  }

  function alternarFuncao(id: string) {
    const novo = new Set(funcoesExcluidas);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    onFuncoesExcluidasChange(novo);
  }

  function alternarCategoria(cat: CategoriaDTO) {
    const todasMarcadas = cat.funcoes.every((f) => !funcoesExcluidas.has(f.id));
    const novo = new Set(funcoesExcluidas);
    for (const f of cat.funcoes) {
      if (todasMarcadas) novo.add(f.id);
      else novo.delete(f.id);
    }
    onFuncoesExcluidasChange(novo);
  }

  const resumoConteudo =
    (funcoesExcluidas.size === 0 ? "Todas as funções" : `${funcoesIncluidas} de ${todasFuncoes.length} funções`) +
    (incluirAtividades ? " · com atividades do dia" : " · sem atividades do dia");

  const chip = (ativo: boolean) =>
    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors " +
    (ativo
      ? "border-brand-700 bg-brand-700 text-white"
      : "border-line-strong bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-100/50");

  const botoes: { acao: AcaoExportacao; rotulo: string; curto: string; icone: "download" | "eye" | "message" }[] = [
    { acao: "baixar", rotulo: "Baixar PDF", curto: "PDF", icone: "download" },
    { acao: "visualizar", rotulo: "Visualizar", curto: "Visualizar", icone: "eye" },
    { acao: "whatsapp", rotulo: "Enviar no WhatsApp", curto: "WhatsApp", icone: "message" },
  ];
  const principal = modo === "whatsapp" ? "whatsapp" : "baixar";
  const secundarios = botoes.filter((b) => b.acao !== principal);
  const botaoPrincipal = botoes.find((b) => b.acao === principal)!;

  return (
    <Modal
      largura="lg"
      onClose={onCancelar}
      titulo={modo === "whatsapp" ? "Compartilhar escala" : "Exportar escala"}
      descricao={
        <>
          <b className="font-semibold text-ink-800">
            {nomeMes(mes)} de {ano}
          </b>{" "}
          · escolha os cultos que vão {modo === "whatsapp" ? "na mensagem" : "no PDF"}. Só o que estiver marcado é
          incluído.
        </>
      }
      rodape={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="text-[12.5px] sm:mr-auto" aria-live="polite">
            {qtd === 0 ? (
              <span className="flex items-center gap-1.5 font-medium text-red-600">
                <Icon name="alert" size={15} /> Selecione pelo menos um culto.
              </span>
            ) : semFuncoes ? (
              <span className="flex items-center gap-1.5 font-medium text-red-600">
                <Icon name="alert" size={15} /> Inclua pelo menos uma função.
              </span>
            ) : (
              <span className="text-ink-600">
                <b className="font-semibold text-ink-900 tabular-nums">{qtd}</b>{" "}
                {qtd === 1 ? "culto selecionado" : "cultos selecionados"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
            <button
              type="button"
              className="btn-primary order-first col-span-3 sm:order-last"
              disabled={!podeConfirmar}
              onClick={() => onConfirmar(botaoPrincipal.acao)}
            >
              <Icon name={botaoPrincipal.icone} size={17} />
              {botaoPrincipal.rotulo}
            </button>
            <button type="button" className="btn-ghost h-10 sm:order-first" onClick={onCancelar}>
              Cancelar
            </button>
            {secundarios.map((b) => (
              <button
                key={b.acao}
                type="button"
                className="btn-secondary px-3"
                disabled={!podeConfirmar}
                onClick={() => onConfirmar(b.acao)}
              >
                <Icon name={b.icone} size={16} className="text-ink-500" />
                <span className="sm:hidden">{b.curto}</span>
                <span className="hidden sm:inline">{b.rotulo}</span>
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-line bg-white/95 px-5 py-3 backdrop-blur sm:px-6">
        <button
          type="button"
          className={chip(qtd === total)}
          onClick={() => definir(new Set(cultos.map((c) => c.data)))}
          aria-pressed={qtd === total}
        >
          Mês inteiro
        </button>
        {ATALHOS.map((a) => {
          const datasAtalho = datasDoAtalho(a.dias);
          if (datasAtalho.length === 0) return null;
          const ativo = atalhoAtivo(datasAtalho);
          return (
            <button
              key={a.rotulo}
              type="button"
              className={chip(ativo)}
              onClick={() => definir(new Set(datasAtalho))}
              aria-pressed={ativo}
              title={`Selecionar só: ${a.rotulo.toLowerCase()}`}
            >
              {a.cor !== undefined && (
                <span className={"h-1.5 w-1.5 rounded-full " + (ativo ? "bg-white" : corDoCulto(a.cor))} />
              )}
              {a.rotulo}
            </button>
          );
        })}
        <button
          type="button"
          className="ml-auto h-8 rounded-full px-2.5 text-[12.5px] font-semibold text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 disabled:opacity-40"
          onClick={() => definir(new Set())}
          disabled={qtd === 0}
        >
          Limpar seleção
        </button>
      </div>

      <ul className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-2 sm:px-6">
        {cultos.map((c) => {
          const marcado = selecionadas.has(c.data);
          const p = progresso[c.data];
          const completa = p && p.total > 0 && p.preenchidas === p.total;
          return (
            <li key={c.data}>
              <label
                className={
                  "flex min-h-[60px] cursor-pointer items-center gap-3 rounded-[12px] border px-3 py-2.5 transition-colors select-none " +
                  (marcado
                    ? "border-brand-600 bg-brand-50/60 shadow-[inset_0_0_0_1px_var(--color-brand-600)]"
                    : "border-line bg-white hover:border-line-strong")
                }
              >
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={marcado}
                  onChange={() => alternarData(c.data)}
                  aria-label={`${nomeDiaSemanaLongo(c.diaSemana)}, ${fmtDataExtenso(c.data)}`}
                />
                <span className="flex w-9 flex-none flex-col items-center leading-none">
                  <span className="font-heading text-[19px] font-bold text-ink-900 tabular-nums">
                    {String(c.dia).padStart(2, "0")}
                  </span>
                  <span className="mt-1 text-[9.5px] font-bold tracking-[0.12em] text-ink-400">
                    {nomeMesAbrev(c.mes)}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-ink-900">
                    {nomeDiaSemanaLongo(c.diaSemana)}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-500">
                    <span className={"h-1.5 w-1.5 flex-none rounded-full " + corDoCulto(c.diaSemana)} />
                    <span className="truncate">
                      {c.vizinho ? `${nomeMes(c.mes)} · fim de semana da virada` : tipoCulto(c.diaSemana)}
                    </span>
                  </span>
                </span>
                {p && p.total > 0 && (
                  <span
                    className={
                      "flex-none text-[11.5px] font-semibold tabular-nums " +
                      (completa ? "text-green-600" : "text-ink-400")
                    }
                    title={`${p.preenchidas} de ${p.total} funções preenchidas`}
                  >
                    {completa ? <Icon name="check" size={16} /> : `${p.preenchidas}/${p.total}`}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      {todasFuncoes.length > 0 && (
        <div className="mx-5 mb-5 rounded-[12px] border border-line sm:mx-6">
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
            aria-expanded={conteudoAberto}
            onClick={() => setConteudoAberto((v) => !v)}
          >
            <Icon name="sliders" size={18} className="text-ink-500" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-ink-900">Conteúdo</span>
              <span className="block truncate text-[12px] text-ink-500">{resumoConteudo}</span>
            </span>
            <Icon
              name="chevronDown"
              size={18}
              className={"text-ink-400 transition-transform duration-200 " + (conteudoAberto ? "rotate-180" : "")}
            />
          </button>
          {conteudoAberto && (
            <div className="border-t border-line px-2 py-2">
              <CheckboxTri
                checked={incluirAtividades}
                onChange={() => onIncluirAtividadesChange(!incluirAtividades)}
                label="Incluir atividades do dia"
                forte
              />
              <div className="mx-2 my-2 h-px bg-line" />
              <div className="flex items-center justify-between px-2 pb-1">
                <span className="eyebrow !text-[10.5px]">Funções</span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => onFuncoesExcluidasChange(new Set())}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => onFuncoesExcluidasChange(new Set(todasFuncoes))}
                  >
                    Nenhuma
                  </button>
                </span>
              </div>
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                {categorias.map((cat) => {
                  if (cat.funcoes.length === 0) return null;
                  const marcadas = cat.funcoes.filter((f) => !funcoesExcluidas.has(f.id)).length;
                  return (
                    <div key={cat.id} className="py-1">
                      <CheckboxTri
                        checked={marcadas === cat.funcoes.length}
                        indeterminate={marcadas > 0 && marcadas < cat.funcoes.length}
                        onChange={() => alternarCategoria(cat)}
                        label={cat.nome}
                        forte
                      />
                      <div className="ml-7">
                        {cat.funcoes.map((f) => (
                          <CheckboxTri
                            key={f.id}
                            checked={!funcoesExcluidas.has(f.id)}
                            onChange={() => alternarFuncao(f.id)}
                            label={
                              labelFuncao(f.nome, 3) !== f.nome
                                ? `${f.nome} (${labelFuncao(f.nome, 3)} na quarta)`
                                : f.nome
                            }
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
