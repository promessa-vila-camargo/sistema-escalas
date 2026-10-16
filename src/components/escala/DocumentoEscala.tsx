/* eslint-disable @next/next/no-img-element -- no PDF a logo precisa ser <img> simples pra sair na impressão */
import {
  agruparDatas,
  cabecalhoDocumento,
  funcoesDoDia,
  notasDoDia,
  type ConteudoExportacao,
  type DadosEscala,
} from "@/lib/exportacao";
import { diaSemanaDe, nomeDiaSemanaLongo, nomeMes, parseIsoDate, tipoCulto } from "@/lib/datas";

/** Faixa de cada culto no PDF: domingo laranja, sábado azul institucional, quarta azul-tinta. */
function corFaixa(diaSemana: number) {
  if (diaSemana === 0) return "#e18800";
  if (diaSemana === 6) return "#004b83";
  return "#243449";
}

/** Escala tipográfica do documento — "grande" quando o arquivo tem um único bloco (um culto ou um fim de semana). */
const TAMANHOS = {
  normal: { numero: "text-[26px]", dia: "text-[12px]", sub: "text-[8.5px]", cat: "text-[7.5px]", rotulo: "text-[9.5px]", nome: "text-[11px]", linha: "py-[3px]", corpo: "px-4 pt-2.5 pb-3", faixa: "px-4 py-2.5", notas: "text-[9px]" },
  grande: { numero: "text-[34px]", dia: "text-[15px]", sub: "text-[10px]", cat: "text-[9px]", rotulo: "text-[12px]", nome: "text-[14px]", linha: "py-[6px]", corpo: "px-6 pt-4 pb-5", faixa: "px-6 py-3.5", notas: "text-[11.5px]" },
};

function DiaDocumento({
  dados,
  data,
  conteudo,
  largo,
  mesDocumento,
  tamanho,
}: {
  dados: DadosEscala;
  data: string;
  conteudo: ConteudoExportacao;
  /** Culto sozinho na linha — as funções se distribuem em duas colunas. */
  largo: boolean;
  mesDocumento: number;
  tamanho: keyof typeof TAMANHOS;
}) {
  const t = TAMANHOS[tamanho];
  const diaSemana = diaSemanaDe(data);
  const { y, m, d } = parseIsoDate(data);
  // Função sem ninguém escalado não entra no documento — só no aviso antes de gerar.
  const grupos = funcoesDoDia(dados, data, conteudo)
    .map((g) => ({ ...g, funcoes: g.funcoes.filter((f) => f.valor) }))
    .filter((g) => g.funcoes.length > 0);
  const notas = notasDoDia(dados, data, conteudo);

  return (
    <section className="flex break-inside-avoid flex-col overflow-hidden rounded-[10px] border border-[#dfe3e9] bg-white">
      <div className={"flex items-center gap-3 text-white " + t.faixa} style={{ backgroundColor: corFaixa(diaSemana) }}>
        <span className={"font-heading leading-none font-bold tabular-nums " + t.numero}>{String(d).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className={"font-heading font-bold tracking-[0.1em] uppercase " + t.dia}>
            {nomeDiaSemanaLongo(diaSemana)}
          </div>
          <div className={"font-semibold tracking-[0.12em] uppercase opacity-85 " + t.sub}>
            {/* O mês só aparece quando difere do documento (fim de semana da virada). */}
            {m !== mesDocumento ? `${nomeMes(m)} ${y} · ` : ""}
            {tipoCulto(diaSemana)}
          </div>
        </div>
      </div>

      {notas.ministerio && (
        <div
          className={
            "flex items-baseline gap-2 border-b border-[#eef0f3] bg-[#f6f5f1] " +
            (tamanho === "grande" ? "px-6 py-2" : "px-4 py-1.5")
          }
        >
          <span className={"flex-none font-bold tracking-[0.16em] text-[#6f7d90] uppercase " + t.cat}>Responsável</span>
          <span className={"font-bold tracking-[0.04em] text-[#142235] uppercase " + t.rotulo}>{notas.ministerio}</span>
        </div>
      )}

      <div className={"flex-1 " + t.corpo + (largo ? " columns-2 gap-7" : "")}>
        {grupos.length === 0 ? (
          <p className="py-2 text-[10px] text-[#94a0b0] italic">Escala ainda não definida.</p>
        ) : (
          grupos.map((g) => (
            <div key={g.categoria} className="mb-2 break-inside-avoid last:mb-0">
              <div className={"mb-0.5 font-bold tracking-[0.16em] text-[#6f7d90] uppercase " + t.cat}>
                {g.categoria}
              </div>
              {g.funcoes.map((f) => (
                <div
                  key={f.id}
                  className={"flex items-baseline justify-between gap-3 border-b border-[#eef0f3] last:border-b-0 " + t.linha}
                >
                  <span className={"flex-none text-[#56657a] " + t.rotulo}>{f.label}</span>
                  <span className={"text-right leading-tight font-bold tracking-[0.01em] text-[#142235] uppercase " + t.nome}>
                    {f.valor}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {(notas.observacao || notas.atividades.length > 0) && (
        <div className={"border-t border-[#e7e4dd] bg-[#f6f5f1] py-2 leading-snug text-[#3a4a5f] " + t.notas + (tamanho === "grande" ? " px-6" : " px-4")}>
          {notas.observacao && <p className="italic">{notas.observacao}</p>}
          {notas.atividades.length > 0 && (
            <div className={notas.observacao ? "mt-1" : ""}>
              <span className="mr-1.5 text-[7.5px] font-bold tracking-[0.14em] text-[#a96600] uppercase">
                Atividades do dia
              </span>
              {notas.atividades.join("  ·  ")}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * O documento da escala (PDF) — usado igual na pré-visualização e na
 * impressão, então o que se vê em "Visualizar" é exatamente o que sai no
 * arquivo. Só entram as datas recebidas, em ordem cronológica.
 */
export default function DocumentoEscala({
  dados,
  datas,
  conteudo,
  ano,
  mes,
}: {
  dados: DadosEscala;
  datas: string[];
  conteudo: ConteudoExportacao;
  ano: number;
  mes: number;
}) {
  const blocos = agruparDatas(datas);
  const cab = cabecalhoDocumento(datas, ano, mes);
  const tamanho = blocos.length === 1 ? "grande" : "normal";
  const props = { dados, conteudo, mesDocumento: mes, tamanho } as const;

  return (
    <div className="bg-white font-sans text-[#142235]">
      <header className="mb-5 flex items-end justify-between gap-6 border-b-[1.5px] border-[#004b83] pb-3.5">
        <img src="/logo.png" alt="Promessa Vila Camargo" className="h-[34px] w-auto" />
        <div className="text-right">
          <div className="text-[8.5px] font-bold tracking-[0.22em] text-[#e18800] uppercase">{cab.rotulo}</div>
          <div className="font-heading text-[20px] leading-tight font-bold text-[#004b83]">{cab.titulo}</div>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {blocos.map((b) =>
          b.tipo === "fds" ? (
            <div key={b.sab} className="grid break-inside-avoid grid-cols-2 gap-3">
              <DiaDocumento {...props} data={b.sab} largo={false} />
              <DiaDocumento {...props} data={b.dom} largo={false} />
            </div>
          ) : (
            <DiaDocumento key={b.data} {...props} data={b.data} largo />
          )
        )}
      </div>

      <footer className="mt-5 flex justify-between border-t border-[#e7e4dd] pt-2 text-[8px] tracking-[0.06em] text-[#949fae] uppercase">
        <span>Promessa Vila Camargo · Escala de cultos</span>
        <span>Gerado em {new Date().toLocaleDateString("pt-BR")}</span>
      </footer>
    </div>
  );
}
