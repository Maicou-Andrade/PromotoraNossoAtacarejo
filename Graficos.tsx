import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LOJAS } from "@/lib/constants";
import { formatDateBR } from "@/lib/masks";
import Autocomplete from "@/components/Autocomplete";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell, LabelList,
} from "recharts";
import {
  Trophy, TrendingUp, Target, Calendar, Users, Award, Medal,
  Calculator, Filter, Store, Percent, BarChart3, Database, GitCompare, X,
} from "lucide-react";

const MONTH_NAMES: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

const DOW_COLORS = ["#1e40af", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#f59e0b", "#d97706"];
const LOJA_COLORS = ["#1e40af", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"];

function formatWeekLabel(semana: string): string {
  const parts = semana.split("-");
  if (parts.length < 3) return semana;
  return `${MONTH_NAMES[parts[1]] || parts[1]}/${parts[0].slice(2)} - ${parts[2]}`;
}

function formatMonthLabel(mes: string): string {
  const parts = mes.split("-");
  if (parts.length < 2) return mes;
  return `${MONTH_NAMES[parts[1]] || parts[1]}/${parts[0].slice(2)}`;
}

function formatDayLabel(data: string): string {
  const parts = data.split("-");
  if (parts.length < 3) return data;
  return `${parts[2]}/${parts[1]}`;
}

function getTodayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getMonthStartISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

// Custom label for bar charts
const renderBarLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value || value === 0) return null;
  return (
    <text x={x + width / 2} y={y - 5} fill="#374151" textAnchor="middle" fontSize={10} fontWeight={600}>
      {value}
    </text>
  );
};

export default function Graficos() {
  const [filterLoja, setFilterLoja] = useState<string | null>(null);
  const [filterPromotora, setFilterPromotora] = useState<number | null>(null);
  const [dataInicio, setDataInicio] = useState(getMonthStartISO());
  const [dataFim, setDataFim] = useState(getTodayISO());
  const [datesInitialized, setDatesInitialized] = useState(false);
  const [modalCadastroGeral, setModalCadastroGeral] = useState(false);

  const { data: promotorasAtivas = [] } = trpc.promotora.list.useQuery({ apenasAtivas: true });
  const { data: metaVigente } = trpc.meta.current.useQuery();

  useEffect(() => {
    if (metaVigente && !datesInitialized) {
      setDataInicio(metaVigente.dataInicio);
      setDataFim(metaVigente.dataFim);
      setDatesInitialized(true);
    } else if (metaVigente === null && !datesInitialized) {
      setDatesInitialized(true);
    }
  }, [metaVigente, datesInitialized]);

  const { data: stats, isLoading } = trpc.lancamento.stats.useQuery({
    loja: filterLoja || undefined,
    promotoraId: filterPromotora || undefined,
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
  });

  const { data: mercafacilTotal } = trpc.mercafacil.totalGeral.useQuery({
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
  });
  const { data: cruzamento } = trpc.mercafacil.cruzamento.useQuery({
    loja: filterLoja || undefined,
    promotoraId: filterPromotora || undefined,
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
  });
  const { data: syncStatus } = trpc.mercafacil.syncStatus.useQuery();
  const { data: cadastroGeralPorDia, isLoading: loadingCadastroGeral } = trpc.mercafacil.cadastroGeralPorDia.useQuery({
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    loja: filterLoja || undefined,
    promotoraId: filterPromotora || undefined,
  }, { enabled: modalCadastroGeral });

  const lojaOptions = LOJAS.map((l) => ({ label: l, value: l }));
  const promotoraOptions = promotorasAtivas.map((p: any) => ({ label: `${p.nome} - ${p.loja}`, value: p.id }));

  const porDiaData = useMemo(() => {
    if (!stats) return [];
    return stats.porDia.slice(-30).map((d: any) => ({ ...d, label: formatDayLabel(d.data) }));
  }, [stats]);

  const porSemanaData = useMemo(() => {
    if (!stats) return [];
    return stats.porSemana.map((s: any) => ({ ...s, label: formatWeekLabel(s.semana) }));
  }, [stats]);

  const porMesData = useMemo(() => {
    if (!stats) return [];
    return stats.porMes.map((m: any) => ({ ...m, label: formatMonthLabel(m.mes) }));
  }, [stats]);

  const porDiaSemanaData = useMemo(() => stats?.porDiaSemana || [], [stats]);

  const metaInfo = stats?.meta;
  const metaMensal = metaInfo?.metaMensal || 0;
  const metaDiaria = metaInfo?.metaDiaria || 0;
  const totalCadastros = stats?.total || 0;
  const totalAtendimentos = stats?.totalAtendimentos || 0;
  const taxaConversao = stats?.taxaConversao || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground text-sm">Carregando dados...</div>
      </div>
    );
  }

  if (!stats) return null;

  const percentualTotal = metaMensal > 0 ? Math.round((totalCadastros / metaMensal) * 100) : 0;

  const getRankIcon = (i: number) => {
    if (i === 0) return <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />;
    if (i === 1) return <Award className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />;
    if (i === 2) return <Medal className="h-4 w-4 sm:h-5 sm:w-5 text-amber-700" />;
    return <span className="h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center text-xs font-bold text-muted-foreground">{i + 1}</span>;
  };

  const getRankBg = (i: number) => {
    if (i === 0) return "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200";
    if (i === 1) return "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200";
    if (i === 2) return "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200";
    return "bg-white border-border/50";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-2xl font-bold text-foreground">Dashboard & Ranking</h2>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">Acompanhe o desempenho das promotoras, metas e resultados</p>
      </div>

      {/* Filters */}
      <Card className="shadow-sm border-ms-dark/20">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-ms-dark" />
            <span className="text-xs sm:text-sm font-semibold text-ms-dark">Filtros</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-[10px] sm:text-xs text-muted-foreground">Loja</Label>
              <Autocomplete options={lojaOptions} value={filterLoja} onChange={(val) => setFilterLoja(val as string | null)} placeholder="Todas" />
            </div>
            <div>
              <Label className="text-[10px] sm:text-xs text-muted-foreground">Promotora</Label>
              <Autocomplete options={promotoraOptions} value={filterPromotora} onChange={(val) => setFilterPromotora(val as number | null)} placeholder="Todas" />
            </div>
            <div>
              <Label className="text-[10px] sm:text-xs text-muted-foreground">Data Início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-[10px] sm:text-xs text-muted-foreground">Data Fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mercafacil - Total Cadastro Geral */}
      {(mercafacilTotal || cruzamento) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card
            className="shadow-sm border-l-4 border-l-indigo-500 cursor-pointer hover:shadow-md hover:border-l-indigo-600 transition-all group"
            onClick={() => setModalCadastroGeral(true)}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-indigo-100 rounded-lg flex-shrink-0 group-hover:bg-indigo-200 transition-colors">
                  <Database className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Total Cadastro Geral</p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{mercafacilTotal?.total || 0}</p>
                  <p className="text-[10px] sm:text-xs text-indigo-500 font-medium group-hover:underline">Ver dia a dia →</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-emerald-500">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-emerald-100 rounded-lg flex-shrink-0">
                  <GitCompare className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Via Promotoras (CRM)</p>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-600">{cruzamento?.cadastradosViaPromotoras || 0}</p>
                  <p className="text-[10px] sm:text-xs text-emerald-600 font-medium">{cruzamento?.percentualCRM || 0}% do total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-orange-500">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg flex-shrink-0">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Por Fora (Sem CRM)</p>
                  <p className="text-xl sm:text-2xl font-bold text-orange-600">{cruzamento?.cadastradosPorFora || 0}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Cadastros sem promotora</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-rose-500">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-rose-100 rounded-lg flex-shrink-0">
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Não Encontrados</p>
                  <p className="text-xl sm:text-2xl font-bold text-rose-600">{cruzamento?.naoEncontradosNaBase || 0}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Lançados mas não na base</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ======= MODAL: CADASTRO GERAL DIA A DIA ======= */}
      {modalCadastroGeral && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalCadastroGeral(false); }}
        >
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-border/50">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Database className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground">Cadastros Geral — Dia a Dia</h2>
                  <p className="text-xs text-muted-foreground">
                    Base Mercafacil × Lançamentos CRM
                    {dataInicio && dataFim && ` · ${formatDateBR(dataInicio)} até ${formatDateBR(dataFim)}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalCadastroGeral(false)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">
              {loadingCadastroGeral ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-muted-foreground text-sm">Carregando dados...</div>
                </div>
              ) : !cadastroGeralPorDia || cadastroGeralPorDia.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-muted-foreground text-sm">Nenhum dado encontrado no período selecionado.</div>
                </div>
              ) : (
                <>
                  {/* Totalizadores do período */}
                  {(() => {
                    const totalGeral = cadastroGeralPorDia.reduce((s: number, d: any) => s + d.total, 0);
                    const totalCRM = cadastroGeralPorDia.reduce((s: number, d: any) => s + d.viaCRM, 0);
                    const totalSemCRM = cadastroGeralPorDia.reduce((s: number, d: any) => s + d.semCRM, 0);
                    const pctCRM = totalGeral > 0 ? Math.round((totalCRM / totalGeral) * 100) : 0;
                    return (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border bg-indigo-50 border-indigo-200 p-3 text-center">
                          <p className="text-[10px] sm:text-xs text-indigo-600 font-medium mb-1">Total Geral</p>
                          <p className="text-xl sm:text-2xl font-bold text-indigo-700">{totalGeral}</p>
                          <p className="text-[10px] text-indigo-500">{cadastroGeralPorDia.length} dias</p>
                        </div>
                        <div className="rounded-xl border bg-emerald-50 border-emerald-200 p-3 text-center">
                          <p className="text-[10px] sm:text-xs text-emerald-600 font-medium mb-1">Via CRM</p>
                          <p className="text-xl sm:text-2xl font-bold text-emerald-700">{totalCRM}</p>
                          <p className="text-[10px] text-emerald-500">{pctCRM}% do total</p>
                        </div>
                        <div className="rounded-xl border bg-orange-50 border-orange-200 p-3 text-center">
                          <p className="text-[10px] sm:text-xs text-orange-600 font-medium mb-1">Sem CRM</p>
                          <p className="text-xl sm:text-2xl font-bold text-orange-700">{totalSemCRM}</p>
                          <p className="text-[10px] text-orange-500">{100 - pctCRM}% do total</p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Gráfico empilhado */}
                  <div className="rounded-xl border bg-card p-3 sm:p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Visão Gráfica</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={cadastroGeralPorDia.map((d: any) => ({
                          ...d,
                          label: `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`,
                        }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={45} />
                        <YAxis tick={{ fontSize: 10 }} width={28} />
                        <Tooltip
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                          formatter={(value: number, name: string) => {
                            const label = name === "viaCRM" ? "Via CRM" : name === "semCRM" ? "Sem CRM" : "Total";
                            return [value, label];
                          }}
                        />
                        <Legend formatter={(v) => v === "viaCRM" ? "Via CRM" : "Sem CRM"} />
                        <Bar dataKey="viaCRM" stackId="a" fill="#10b981" name="viaCRM" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="semCRM" stackId="a" fill="#f97316" name="semCRM" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Tabela dia a dia */}
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/60 border-b">
                          <th className="text-left px-3 sm:px-4 py-2.5 text-xs font-semibold text-muted-foreground">Data</th>
                          <th className="text-right px-3 sm:px-4 py-2.5 text-xs font-semibold text-indigo-600">Total</th>
                          <th className="text-right px-3 sm:px-4 py-2.5 text-xs font-semibold text-emerald-600">Via CRM</th>
                          <th className="text-right px-3 sm:px-4 py-2.5 text-xs font-semibold text-orange-600">Sem CRM</th>
                          <th className="text-right px-3 sm:px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">% CRM</th>
                          <th className="px-3 sm:px-4 py-2.5 hidden sm:table-cell w-28"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...cadastroGeralPorDia].reverse().map((d: any, i: number) => {
                          const pct = d.total > 0 ? Math.round((d.viaCRM / d.total) * 100) : 0;
                          const [ano, mes, dia] = d.data.split("-");
                          return (
                            <tr key={d.data} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                              <td className="px-3 sm:px-4 py-2.5 font-medium text-xs sm:text-sm">{`${dia}/${mes}/${ano}`}</td>
                              <td className="px-3 sm:px-4 py-2.5 text-right font-bold text-indigo-700 text-xs sm:text-sm">{d.total}</td>
                              <td className="px-3 sm:px-4 py-2.5 text-right text-emerald-600 font-semibold text-xs sm:text-sm">{d.viaCRM}</td>
                              <td className="px-3 sm:px-4 py-2.5 text-right text-orange-600 font-semibold text-xs sm:text-sm">{d.semCRM}</td>
                              <td className="px-3 sm:px-4 py-2.5 text-right text-xs text-muted-foreground hidden sm:table-cell">{pct}%</td>
                              <td className="px-3 sm:px-4 py-2.5 hidden sm:table-cell">
                                <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-200">
                                  <div className="bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                                  <div className="bg-orange-400 transition-all flex-1" style={{ width: `${100 - pct}%` }} />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="shadow-sm border-l-4 border-l-ms-dark">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-ms-dark/10 rounded-lg flex-shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-ms-dark" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Total Cadastros</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{totalCadastros}</p>
                {metaMensal > 0 && <p className="text-[10px] sm:text-xs text-ms-dark font-medium">{percentualTotal}% da meta</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-ms-teal-light">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-ms-teal-light/20 rounded-lg flex-shrink-0">
                <Target className="h-4 w-4 sm:h-5 sm:w-5 text-ms-teal" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Meta Mensal</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{metaMensal || "N/D"}</p>
                {metaInfo && <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{formatDateBR(metaInfo.dataInicio)} - {formatDateBR(metaInfo.dataFim)}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-green-500">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
                <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Meta Diária</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{metaDiaria || "N/D"}</p>
                {metaInfo && <p className="text-[10px] sm:text-xs text-muted-foreground">{metaInfo.diasUteis} dias úteis</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-purple-500">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg flex-shrink-0">
                <Percent className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Índice de Conversão</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{taxaConversao}%</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{totalAtendimentos} atendidos → {totalCadastros} cadastros</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      {metaMensal > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-semibold">Progresso Geral da Meta</span>
              <span className="text-xs sm:text-sm font-bold text-ms-dark">{totalCadastros}/{metaMensal} ({percentualTotal}%)</span>
            </div>
            <Progress value={Math.min(percentualTotal, 100)} className="h-2.5 sm:h-3" />
          </CardContent>
        </Card>
      )}

      {/* ======= DESEMPENHO POR LOJA ======= */}
      {stats.porLoja && stats.porLoja.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-ms-dark" />
              Desempenho por Loja
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.porLoja.map((l: any, i: number) => (
                <div key={l.loja} className="flex items-center gap-3 p-3 rounded-lg border bg-gradient-to-r from-white to-gray-50">
                  <div className="w-2 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: LOJA_COLORS[i % LOJA_COLORS.length] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold truncate">{l.loja}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-lg sm:text-xl font-bold">{l.quantidade}</span>
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] bg-ms-dark/5 text-ms-dark border-ms-dark/20">{l.percentualTotal}% total</Badge>
                        {metaMensal > 0 && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">{l.percentualMeta}% meta</Badge>}
                      </div>
                    </div>
                    {metaMensal > 0 && (
                      <Progress value={Math.min(l.percentualMeta, 100)} className="h-1.5 mt-1.5" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Gráfico de barras por loja */}
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.porLoja} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="loja" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={30} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                    formatter={(value: number, name: string) => {
                      return [`${value} cadastros`, "Quantidade"];
                    }}
                  />
                  <Bar dataKey="quantidade" radius={[4, 4, 0, 0]} name="Cadastros">
                    <LabelList dataKey="quantidade" position="top" fontSize={11} fontWeight={600} fill="#374151" />
                    {stats.porLoja.map((_: any, idx: number) => (
                      <Cell key={idx} fill={LOJA_COLORS[idx % LOJA_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ======= DISTRIBUIÇÃO POR DIA DA SEMANA ======= */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-purple-600" />
            Distribuição por Dia da Semana
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          {porDiaSemanaData.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-xs sm:text-sm">Nenhum dado disponível</div>
          ) : (
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {porDiaSemanaData.map((d: any, i: number) => {
                const maxQtd = Math.max(...porDiaSemanaData.map((x: any) => x.quantidade), 1);
                const heightPct = (d.quantidade / maxQtd) * 100;
                const pctTotal = totalCadastros > 0 ? Math.round((d.quantidade / totalCadastros) * 100) : 0;
                const pctMeta = metaMensal > 0 ? Math.round((d.quantidade / metaMensal) * 100) : 0;
                return (
                  <div key={d.dia} className="flex flex-col items-center">
                    <div className="w-full bg-gray-100 rounded-t-md relative" style={{ height: "80px" }}>
                      <div
                        className="absolute bottom-0 w-full rounded-t-md transition-all duration-500"
                        style={{ height: `${Math.max(heightPct, 4)}%`, backgroundColor: DOW_COLORS[i % DOW_COLORS.length] }}
                      />
                      {/* Valor no topo da barra */}
                      <div className="absolute w-full text-center" style={{ bottom: `${Math.max(heightPct, 4)}%`, transform: "translateY(-2px)" }}>
                        <span className="text-[10px] sm:text-xs font-bold text-gray-700">{d.quantidade}</span>
                      </div>
                    </div>
                    <div className="text-center mt-1.5">
                      <p className="text-[10px] sm:text-xs font-bold">{d.dia}</p>
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground">{pctTotal}% total</p>
                      {metaMensal > 0 && <p className="text-[9px] sm:text-[10px] text-ms-dark">{pctMeta}% meta</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ======= CADASTROS POR DIA + POR SEMANA ======= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-ms-dark" />
              Cadastros por Dia
            </CardTitle>
          </CardHeader>
          <CardContent className="px-1 sm:px-6 pb-3 sm:pb-6">
            {porDiaData.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs sm:text-sm">Nenhum dado disponível</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={porDiaData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} width={30} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                    formatter={(value: number) => {
                      const pctMeta = metaDiaria > 0 ? `${Math.round((value / metaDiaria) * 100)}% meta diária` : "";
                      const pctTotal = totalCadastros > 0 ? `${Math.round((value / totalCadastros) * 100)}% do total` : "";
                      return [`${value} (${[pctMeta, pctTotal].filter(Boolean).join(" | ")})`, "Cadastros"];
                    }}
                  />
                  <Bar dataKey="quantidade" fill="oklch(0.42 0.14 260)" radius={[3, 3, 0, 0]} name="Cadastros">
                    <LabelList dataKey="quantidade" position="top" fontSize={10} fontWeight={600} fill="#374151" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-ms-teal" />
              Cadastros por Semana
            </CardTitle>
          </CardHeader>
          <CardContent className="px-1 sm:px-6 pb-3 sm:pb-6">
            {porSemanaData.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs sm:text-sm">Nenhum dado disponível</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={porSemanaData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} width={30} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                    formatter={(value: number) => {
                      const pctMeta = metaMensal > 0 ? `${Math.round((value / metaMensal) * 100)}% meta` : "";
                      const pctTotal = totalCadastros > 0 ? `${Math.round((value / totalCadastros) * 100)}% total` : "";
                      return [`${value} (${[pctMeta, pctTotal].filter(Boolean).join(" | ")})`, "Cadastros"];
                    }}
                  />
                  <Bar dataKey="quantidade" fill="oklch(0.72 0.18 65)" radius={[3, 3, 0, 0]} name="Cadastros">
                    <LabelList dataKey="quantidade" position="top" fontSize={10} fontWeight={600} fill="#374151" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ======= CADASTROS MÊS A MÊS ======= */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Cadastros Mês a Mês
          </CardTitle>
        </CardHeader>
        <CardContent className="px-1 sm:px-6 pb-3 sm:pb-6">
          {porMesData.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs sm:text-sm">Nenhum dado disponível</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={porMesData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={35} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  formatter={(value: number) => {
                    const pctMeta = metaMensal > 0 ? `${Math.round((value / metaMensal) * 100)}% meta` : "";
                    return [`${value} ${pctMeta ? `(${pctMeta})` : ""}`, "Cadastros"];
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="quantidade" stroke="oklch(0.42 0.14 260)" strokeWidth={3} dot={{ fill: "oklch(0.42 0.14 260)", r: 4 }} name="Cadastros">
                  <LabelList dataKey="quantidade" position="top" fontSize={11} fontWeight={600} fill="#374151" />
                </Line>
                {metaMensal > 0 && (
                  <Line type="monotone" dataKey={() => metaMensal} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Meta" />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ======= VISÃO DETALHADA POR LOJA ======= */}
      {stats.porLoja && stats.porLoja.length > 1 && !filterLoja && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-ms-teal" />
              Visão Detalhada por Loja
            </CardTitle>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Ranking, cadastros e conversão de cada loja individualmente</p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="space-y-4">
              {stats.porLoja.map((lojaData: any, lojaIdx: number) => {
                // Filter ranking for this loja
                const lojaRanking = stats.ranking.filter((r: any) => r.loja === lojaData.loja);
                // Get promotoras for this loja from acompanhamento
                const lojaAcomp = stats.acompanhamento?.filter((a: any) => a.loja === lojaData.loja) || [];
                const lojaColor = LOJA_COLORS[lojaIdx % LOJA_COLORS.length];

                return (
                  <div key={lojaData.loja} className="border rounded-xl overflow-hidden">
                    {/* Loja header */}
                    <div className="p-3 sm:p-4 flex items-center justify-between" style={{ backgroundColor: `${lojaColor}10`, borderBottom: `2px solid ${lojaColor}30` }}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lojaColor }} />
                        <h3 className="text-sm sm:text-base font-bold">{lojaData.loja}</h3>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Badge className="text-white text-[10px] sm:text-xs" style={{ backgroundColor: lojaColor }}>
                          {lojaData.quantidade} cadastros
                        </Badge>
                        <Badge variant="outline" className="text-[10px] sm:text-xs">{lojaData.percentualTotal}% total</Badge>
                        {metaMensal > 0 && (
                          <Badge variant="outline" className="text-[10px] sm:text-xs bg-green-50 text-green-700 border-green-200">{lojaData.percentualMeta}% meta</Badge>
                        )}
                      </div>
                    </div>

                    {/* Loja content */}
                    <div className="p-3 sm:p-4 space-y-3">
                      {/* Ranking da loja */}
                      {lojaRanking.length > 0 && (
                        <div>
                          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Ranking da Loja</p>
                          <div className="space-y-1.5">
                            {lojaRanking.map((r: any, rIdx: number) => {
                              const pctTotal = lojaData.quantidade > 0 ? Math.round((r.quantidade / lojaData.quantidade) * 100) : 0;
                              return (
                                <div key={r.promotoraId} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50/80 border border-gray-100">
                                  <div className="flex-shrink-0 w-5 flex justify-center">{getRankIcon(rIdx)}</div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs sm:text-sm font-medium truncate">{r.nome}</span>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span className="text-sm sm:text-base font-bold">{r.quantidade}</span>
                                        <span className="text-[9px] sm:text-[10px] text-muted-foreground">({pctTotal}% loja)</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <Progress value={Math.min(r.percentualMeta, 100)} className="h-1 flex-1" />
                                      <span className={`text-[9px] sm:text-[10px] font-medium ${r.percentualMeta >= 100 ? "text-green-600" : r.percentualMeta >= 50 ? "text-ms-teal" : "text-red-500"}`}>
                                        {r.percentualMeta}% meta
                                      </span>
                                      {r.atendimentos > 0 && (
                                        <span className="text-[9px] sm:text-[10px] text-purple-600">Conv: {r.taxaConversao}%</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Acompanhamento da loja */}
                      {lojaAcomp.length > 0 && (
                        <div>
                          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Acompanhamento Diário</p>
                          <div className="space-y-1.5">
                            {lojaAcomp.map((a: any) => {
                              const pctAtingido = a.diasPassados > 0 ? Math.round((a.diasAtingidos / a.diasPassados) * 100) : 0;
                              return (
                                <div key={a.promotoraId} className="flex items-center gap-2 text-[10px] sm:text-xs p-1.5 rounded bg-gray-50/50">
                                  <span className="font-medium truncate flex-shrink-0 w-24 sm:w-32">{a.nome}</span>
                                  <div className="flex-1 flex items-center gap-1">
                                    <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${pctAtingido}%` }} />
                                    <div className="h-1.5 rounded-full bg-red-300 flex-1" />
                                  </div>
                                  <span className="text-green-600 flex-shrink-0">{a.diasAtingidos}✓</span>
                                  <span className="text-red-500 flex-shrink-0">{a.diasNaoAtingidos}✗</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ======= ACOMPANHAMENTO DE METAS POR PROMOTORA ======= */}
      {stats.acompanhamento && stats.acompanhamento.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-red-500" />
              Acompanhamento Diário por Promotora
            </CardTitle>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Dias úteis atingidos vs não atingidos (meta diária individual)</p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="space-y-2 sm:space-y-3">
              {stats.acompanhamento.map((a: any) => {
                const pctAtingido = a.diasPassados > 0 ? Math.round((a.diasAtingidos / a.diasPassados) * 100) : 0;
                const isGood = pctAtingido >= 70;
                const isWarning = pctAtingido >= 40 && pctAtingido < 70;
                return (
                  <div key={a.promotoraId} className={`p-2.5 sm:p-3 rounded-lg border ${isGood ? 'border-green-200 bg-green-50/50' : isWarning ? 'border-yellow-200 bg-yellow-50/50' : 'border-red-200 bg-red-50/50'}`}>
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-semibold">{a.nome}</span>
                        <Badge variant="outline" className="text-[9px] sm:text-[10px]">{a.loja}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] sm:text-xs text-muted-foreground">Meta: {a.metaIndividual} ({a.metaDiariaIndividual}/dia)</span>
                        <Badge className={`text-[9px] sm:text-[10px] ${a.percentualMeta >= 100 ? 'bg-green-600' : a.percentualMeta >= 50 ? 'bg-ms-teal' : 'bg-red-500'} text-white`}>
                          {a.percentualMeta}%
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-1 mb-1">
                          <div className="h-1.5 sm:h-2 rounded-full bg-green-500 transition-all" style={{ width: `${pctAtingido}%` }} />
                          <div className="h-1.5 sm:h-2 rounded-full bg-red-400 transition-all flex-1" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-[10px] sm:text-xs">
                        <span className="text-green-600 font-medium">{a.diasAtingidos} atingidos</span>
                        <span className="text-red-500 font-medium">{a.diasNaoAtingidos} não atingidos</span>
                        <span className="text-muted-foreground">de {a.diasPassados} dias</span>
                      </div>
                    </div>
                    <div className="mt-1 text-[10px] sm:text-xs text-muted-foreground">
                      Realizado: <strong>{a.totalRealizados}</strong> de {a.metaIndividual}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ======= RANKING ======= */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2 flex-wrap">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Ranking de Promotoras
            {metaMensal > 0 && (
              <Badge variant="outline" className="bg-ms-teal-light/10 text-ms-teal border-ms-teal-light/30 text-[10px] sm:text-xs">
                Meta: {metaMensal}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          {stats.ranking.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs sm:text-sm">Nenhum dado disponível</div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {stats.ranking.map((r: any, index: number) => {
                const pctTotal = totalCadastros > 0 ? Math.round((r.quantidade / totalCadastros) * 100) : 0;
                return (
                  <div key={r.promotoraId} className={`flex items-center gap-2 sm:gap-4 p-2.5 sm:p-4 rounded-lg border transition-all hover:shadow-sm ${getRankBg(index)}`}>
                    <div className="flex-shrink-0 w-6 sm:w-8 flex justify-center">{getRankIcon(index)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-xs sm:text-sm truncate">{r.nome}</span>
                        <Badge variant="outline" className="text-[9px] sm:text-xs bg-ms-dark/5 text-ms-dark border-ms-dark/20 flex-shrink-0">{r.loja}</Badge>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Progress value={Math.min(r.percentualMeta, 100)} className="h-1.5 sm:h-2 flex-1" />
                        <span className={`text-[10px] sm:text-xs font-medium whitespace-nowrap ${r.percentualMeta >= 100 ? "text-green-600" : r.percentualMeta >= 50 ? "text-ms-teal" : "text-red-500"}`}>
                          {r.percentualMeta}% meta
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground">{pctTotal}% do total</span>
                        {r.atendimentos > 0 && (
                          <span className="text-[9px] sm:text-[10px] text-purple-600">Conversão: {r.taxaConversao}% ({r.atendimentos} atend.)</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base sm:text-lg font-bold text-foreground">{r.quantidade}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">de {r.meta > 0 ? r.meta : "N/D"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
