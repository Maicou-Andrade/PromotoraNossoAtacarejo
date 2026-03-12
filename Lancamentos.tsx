import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { maskCPF, maskCPFForLGPD, formatDateBR, getTodayISO, getYesterdayISO } from "@/lib/masks";
import { LOJAS } from "@/lib/constants";
import Autocomplete from "@/components/Autocomplete";
import { Plus, Eye, EyeOff, Trash2, ClipboardList, Users, UserCheck, ChevronDown, ChevronRight } from "lucide-react";

export default function Lancamentos() {
  // Lancamento dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    promotoraId: null as number | null,
    nomeCliente: "",
    cpfCliente: "",
    dataCadastro: getTodayISO(),
    senha: "",
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [validationMessage, setValidationMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Atendimento dialog
  const [isAtendDialogOpen, setIsAtendDialogOpen] = useState(false);
  const [atendForm, setAtendForm] = useState({
    promotoraId: null as number | null,
    data: getTodayISO(),
    quantidade: "",
    senha: "",
  });
  const [atendErrors, setAtendErrors] = useState<Record<string, boolean>>({});
  const [atendValidationMessage, setAtendValidationMessage] = useState("");
  const [showAtendPassword, setShowAtendPassword] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; nomeCliente: string; type: "lancamento" | "atendimento" } | null>(null);
  const [deleteSenha, setDeleteSenha] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  // Filters - default data = ontem
  const [filterData, setFilterData] = useState<string>(getYesterdayISO());
  const [filterPromotora, setFilterPromotora] = useState<number | null>(null);
  const [filterLoja, setFilterLoja] = useState<string | null>(null);
  const [filterCliente, setFilterCliente] = useState<string | null>(null);

  // Collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();

  const { data: promotorasAtivas = [] } = trpc.promotora.list.useQuery({ apenasAtivas: true });
  const { data: todasPromotoras = [] } = trpc.promotora.list.useQuery();
  const { data: distinctClientes = [] } = trpc.lancamento.distinctClientes.useQuery();

  const { data: lancamentosList = [], isLoading } = trpc.lancamento.list.useQuery({
    promotoraId: filterPromotora || undefined,
    loja: filterLoja || undefined,
    dataCadastro: filterData || undefined,
    nomeCliente: filterCliente || undefined,
  });

  const { data: atendimentosList = [], isLoading: atendLoading } = trpc.atendimento.list.useQuery({});

  const createMutation = trpc.lancamento.create.useMutation({
    onSuccess: () => {
      toast.success("Lançamento cadastrado com sucesso!");
      utils.lancamento.list.invalidate();
      utils.lancamento.distinctDates.invalidate();
      utils.lancamento.distinctClientes.invalidate();
      utils.lancamento.stats.invalidate();
      closeDialog();
    },
    onError: (err) => {
      setValidationMessage(err.message || "Erro ao cadastrar lançamento");
    },
  });

  const deleteMutation = trpc.lancamento.delete.useMutation({
    onSuccess: () => {
      toast.success("Lançamento excluído com sucesso!");
      utils.lancamento.list.invalidate();
      utils.lancamento.distinctDates.invalidate();
      utils.lancamento.distinctClientes.invalidate();
      utils.lancamento.stats.invalidate();
      closeDeleteDialog();
    },
    onError: (err) => {
      setDeleteError(err.message || "Erro ao excluir");
    },
  });

  const createAtendMutation = trpc.atendimento.create.useMutation({
    onSuccess: () => {
      toast.success("Atendimento registrado com sucesso!");
      utils.atendimento.list.invalidate();
      utils.lancamento.stats.invalidate();
      closeAtendDialog();
    },
    onError: (err) => {
      setAtendValidationMessage(err.message || "Erro ao registrar atendimento");
    },
  });

  const deleteAtendMutation = trpc.atendimento.delete.useMutation({
    onSuccess: () => {
      toast.success("Atendimento excluído com sucesso!");
      utils.atendimento.list.invalidate();
      utils.lancamento.stats.invalidate();
      closeDeleteDialog();
    },
    onError: (err) => {
      setDeleteError(err.message || "Erro ao excluir");
    },
  });

  const selectedPromotora = promotorasAtivas.find((p: any) => p.id === form.promotoraId);
  const selectedAtendPromotora = promotorasAtivas.find((p: any) => p.id === atendForm.promotoraId);

  // Group lancamentos by promotora
  const groupedLancamentos = useMemo(() => {
    const groups = new Map<string, { promotoraNome: string; loja: string; items: any[] }>();
    lancamentosList.forEach((l: any) => {
      const key = l.promotoraNome || "Sem promotora";
      if (!groups.has(key)) {
        groups.set(key, { promotoraNome: key, loja: l.loja || "", items: [] });
      }
      groups.get(key)!.items.push(l);
    });
    return Array.from(groups.values()).sort((a, b) => b.items.length - a.items.length);
  }, [lancamentosList]);

  // Cards de indicadores por promotora
  const indicadores = useMemo(() => {
    const map = new Map<string, { nome: string; loja: string; quantidade: number }>();
    lancamentosList.forEach((l: any) => {
      const key = l.promotoraNome || "Sem promotora";
      if (!map.has(key)) {
        map.set(key, { nome: key, loja: l.loja || "", quantidade: 0 });
      }
      map.get(key)!.quantidade++;
    });
    return Array.from(map.values()).sort((a, b) => b.quantidade - a.quantidade);
  }, [lancamentosList]);

  const maxIndicador = useMemo(() => Math.max(...indicadores.map((i) => i.quantidade), 1), [indicadores]);

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setForm({ promotoraId: null, nomeCliente: "", cpfCliente: "", dataCadastro: getTodayISO(), senha: "" });
    setErrors({});
    setValidationMessage("");
    setShowPassword(false);
  }

  function openCreate() {
    setForm({ promotoraId: null, nomeCliente: "", cpfCliente: "", dataCadastro: getTodayISO(), senha: "" });
    setErrors({});
    setValidationMessage("");
    setShowPassword(false);
    setIsDialogOpen(true);
  }

  function closeAtendDialog() {
    setIsAtendDialogOpen(false);
    setAtendForm({ promotoraId: null, data: getTodayISO(), quantidade: "", senha: "" });
    setAtendErrors({});
    setAtendValidationMessage("");
    setShowAtendPassword(false);
  }

  function openAtendCreate() {
    setAtendForm({ promotoraId: null, data: getTodayISO(), quantidade: "", senha: "" });
    setAtendErrors({});
    setAtendValidationMessage("");
    setShowAtendPassword(false);
    setIsAtendDialogOpen(true);
  }

  function openDeleteDialog(id: number, nomeCliente: string, type: "lancamento" | "atendimento") {
    setDeleteTarget({ id, nomeCliente, type });
    setDeleteSenha("");
    setDeleteError("");
    setShowDeletePassword(false);
  }

  function closeDeleteDialog() {
    setDeleteTarget(null);
    setDeleteSenha("");
    setDeleteError("");
    setShowDeletePassword(false);
  }

  function handleDelete() {
    if (!deleteSenha.trim()) {
      setDeleteError("Digite a senha de administrador");
      return;
    }
    if (!deleteTarget) return;
    if (deleteTarget.type === "lancamento") {
      deleteMutation.mutate({ id: deleteTarget.id, senha: deleteSenha });
    } else {
      deleteAtendMutation.mutate({ id: deleteTarget.id, senha: deleteSenha });
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, boolean> = {};
    if (!form.promotoraId) newErrors.promotoraId = true;
    if (!form.nomeCliente.trim()) newErrors.nomeCliente = true;
    if (form.cpfCliente.replace(/\D/g, "").length !== 11) newErrors.cpfCliente = true;
    if (!form.dataCadastro) newErrors.dataCadastro = true;
    if (!form.senha.trim()) newErrors.senha = true;
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setValidationMessage("Preencha todos os campos obrigatórios corretamente.");
      return false;
    }
    setValidationMessage("");
    return true;
  }

  function validateAtend(): boolean {
    const newErrors: Record<string, boolean> = {};
    if (!atendForm.promotoraId) newErrors.promotoraId = true;
    if (!atendForm.data) newErrors.data = true;
    if (!atendForm.quantidade || parseInt(atendForm.quantidade) < 1) newErrors.quantidade = true;
    if (!atendForm.senha.trim()) newErrors.senha = true;
    setAtendErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setAtendValidationMessage("Preencha todos os campos obrigatórios corretamente.");
      return false;
    }
    setAtendValidationMessage("");
    return true;
  }

  function handleSave() {
    if (!validate()) return;
    if (!selectedPromotora) return;
    createMutation.mutate({
      promotoraId: form.promotoraId!,
      nomeCliente: form.nomeCliente.trim(),
      cpfCliente: form.cpfCliente,
      dataCadastro: form.dataCadastro,
      loja: selectedPromotora.loja,
      senha: form.senha,
    });
  }

  function handleSaveAtend() {
    if (!validateAtend()) return;
    createAtendMutation.mutate({
      promotoraId: atendForm.promotoraId!,
      data: atendForm.data,
      quantidade: parseInt(atendForm.quantidade),
      senha: atendForm.senha,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent, nextFieldId?: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (nextFieldId) {
        const next = document.getElementById(nextFieldId);
        if (next) next.focus();
      }
    }
  }

  const promotoraOptions = promotorasAtivas.map((p: any) => ({
    label: `${p.nome} - ${p.loja}`,
    value: p.id,
  }));

  const allPromotoraOptions = todasPromotoras.map((p: any) => ({
    label: `${p.nome} - ${p.loja}`,
    value: p.id,
  }));

  const lojaOptions = LOJAS.map((l) => ({ label: l, value: l }));
  const clienteOptions = distinctClientes.map((c: string) => ({ label: c, value: c }));

  const INDICATOR_COLORS = ["#1e40af", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

  return (
    <div className="space-y-4 sm:space-y-6">
      <Tabs defaultValue="lancamentos" className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-auto">
          <TabsTrigger value="lancamentos" className="text-xs sm:text-sm py-2 gap-1 sm:gap-2">
            <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Cadastros APP</span>
          </TabsTrigger>
          <TabsTrigger value="atendimentos" className="text-xs sm:text-sm py-2 gap-1 sm:gap-2">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Atendimentos</span>
          </TabsTrigger>
        </TabsList>

        {/* LANCAMENTOS TAB */}
        <TabsContent value="lancamentos" className="space-y-4 mt-4">
          {/* Header */}
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-foreground">Cadastros no APP</h2>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                Registre os cadastros de clientes realizados pelas promotoras
              </p>
            </div>
            <Button
              onClick={openCreate}
              size="sm"
              className="w-full bg-nosso-blue hover:bg-nosso-blue-dark text-white shadow-md text-xs sm:text-sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Cadastrar
            </Button>
          </div>

          {/* Filtros sempre visíveis */}
          <Card className="shadow-sm border-nosso-blue/20">
            <CardContent className="p-3 sm:p-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Label className="text-[10px] sm:text-xs text-muted-foreground">Data</Label>
                  <Input
                    type="date"
                    value={filterData}
                    onChange={(e) => setFilterData(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] sm:text-xs text-muted-foreground">Promotora</Label>
                  <Autocomplete options={allPromotoraOptions} value={filterPromotora} onChange={(val) => setFilterPromotora(val as number | null)} placeholder="Todas" />
                </div>
                <div>
                  <Label className="text-[10px] sm:text-xs text-muted-foreground">Loja</Label>
                  <Autocomplete options={lojaOptions} value={filterLoja} onChange={(val) => setFilterLoja(val as string | null)} placeholder="Todas" />
                </div>
                <div>
                  <Label className="text-[10px] sm:text-xs text-muted-foreground">Cliente</Label>
                  <Autocomplete options={clienteOptions} value={filterCliente} onChange={(val) => setFilterCliente(val as string | null)} placeholder="Todos" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cards de indicadores por promotora */}
          {indicadores.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              {/* Card total */}
              <Card className="shadow-sm border-l-4 border-l-nosso-blue col-span-2 sm:col-span-1">
                <CardContent className="p-2.5 sm:p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-nosso-blue/10 rounded-lg flex-shrink-0">
                      <UserCheck className="h-4 w-4 text-nosso-blue" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground leading-tight">Total</p>
                      <p className="text-xl font-bold text-nosso-blue">{lancamentosList.length}</p>
                      <p className="text-[10px] text-muted-foreground">{filterData ? formatDateBR(filterData) : "Todos"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card por promotora */}
              {indicadores.map((ind, idx) => (
                <Card key={ind.nome} className="shadow-sm border-l-4" style={{ borderLeftColor: INDICATOR_COLORS[idx % INDICATOR_COLORS.length] }}>
                  <CardContent className="p-2.5 sm:p-3">
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground truncate leading-tight" title={ind.nome}>{ind.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-lg font-bold" style={{ color: INDICATOR_COLORS[idx % INDICATOR_COLORS.length] }}>{ind.quantidade}</p>
                        <Badge variant="outline" className="text-[9px] h-4 px-1">{ind.loja}</Badge>
                      </div>
                      <Progress value={(ind.quantidade / maxIndicador) * 100} className="h-1 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Results count */}
          <div className="text-xs sm:text-sm text-muted-foreground">
            {lancamentosList.length} lançamento(s) encontrado(s)
            {filterData && <span className="ml-1">em {formatDateBR(filterData)}</span>}
          </div>

          {/* Agrupado por promotora - Desktop */}
          <div className="hidden md:block space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : groupedLancamentos.length === 0 ? (
              <Card className="shadow-sm"><CardContent className="p-0"><div className="text-center py-8 text-muted-foreground text-sm">Nenhum lançamento encontrado</div></CardContent></Card>
            ) : (
              groupedLancamentos.map((group, gIdx) => {
                const isCollapsed = collapsedGroups.has(group.promotoraNome);
                return (
                  <Card key={group.promotoraNome} className="shadow-sm border-border/50 overflow-hidden">
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group.promotoraNome)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-nosso-blue/5 to-nosso-blue/[0.02] border-b hover:bg-nosso-blue/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-semibold text-sm text-foreground">{group.promotoraNome}</span>
                        <Badge variant="outline" className="bg-nosso-blue/5 text-nosso-blue border-nosso-blue/20 text-xs">{group.loja}</Badge>
                      </div>
                      <Badge className="bg-nosso-blue text-white text-xs">{group.items.length} cadastro(s)</Badge>
                    </button>

                    {/* Group items */}
                    {!isCollapsed && (
                      <CardContent className="p-0">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-muted/30 border-b">
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Cliente</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">CPF Cliente</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Data</th>
                              <th className="text-center px-4 py-2 text-xs font-semibold text-muted-foreground w-16">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((l: any) => (
                              <tr key={l.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                                <td className="px-4 py-2.5 text-sm">{l.nomeCliente}</td>
                                <td className="px-4 py-2.5 text-sm text-muted-foreground font-mono">{maskCPFForLGPD(l.cpfCliente)}</td>
                                <td className="px-4 py-2.5 text-sm">{formatDateBR(l.dataCadastro)}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(l.id, l.nomeCliente, "lancamento")} className="h-7 w-7 p-0 hover:bg-red-50" title="Excluir">
                                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}
          </div>

          {/* Agrupado por promotora - Mobile */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
            ) : groupedLancamentos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Nenhum lançamento encontrado</div>
            ) : (
              groupedLancamentos.map((group) => {
                const isCollapsed = collapsedGroups.has(group.promotoraNome);
                return (
                  <div key={group.promotoraNome} className="space-y-1.5">
                    {/* Group header mobile */}
                    <button
                      onClick={() => toggleGroup(group.promotoraNome)}
                      className="w-full flex items-center justify-between p-2.5 bg-gradient-to-r from-nosso-blue/10 to-nosso-blue/5 rounded-lg border border-nosso-blue/20"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                        <span className="font-semibold text-xs truncate">{group.promotoraNome}</span>
                        <Badge variant="outline" className="bg-nosso-blue/5 text-nosso-blue border-nosso-blue/20 text-[9px] flex-shrink-0">{group.loja}</Badge>
                      </div>
                      <Badge className="bg-nosso-blue text-white text-[10px] flex-shrink-0">{group.items.length}</Badge>
                    </button>

                    {/* Group items mobile */}
                    {!isCollapsed && (
                      <div className="space-y-1.5 pl-2">
                        {group.items.map((l: any) => (
                          <Card key={l.id} className="shadow-sm">
                            <CardContent className="p-2.5">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0 space-y-0.5">
                                  <p className="text-sm font-medium truncate">{l.nomeCliente}</p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-mono">{maskCPFForLGPD(l.cpfCliente)}</span>
                                    <span>{formatDateBR(l.dataCadastro)}</span>
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(l.id, l.nomeCliente, "lancamento")} className="h-7 w-7 p-0 hover:bg-red-50 flex-shrink-0">
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ATENDIMENTOS TAB */}
        <TabsContent value="atendimentos" className="space-y-4 mt-4">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-foreground">Registro de Atendimentos</h2>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                Registre a quantidade de pessoas atendidas no dia para calcular o Índice de Conversão
              </p>
            </div>
            <Button
              onClick={openAtendCreate}
              size="sm"
              className="w-full sm:w-auto bg-nosso-blue hover:bg-nosso-blue-dark text-white shadow-md text-xs sm:text-sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Registrar Atendimento
            </Button>
          </div>

          <div className="text-xs sm:text-sm text-muted-foreground">
            {atendimentosList.length} registro(s)
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Card className="shadow-sm border-border/50">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-nosso-blue/5 border-b">
                        <th className="text-left px-4 py-3 text-sm font-semibold">Promotora</th>
                        <th className="text-left px-4 py-3 text-sm font-semibold">Data</th>
                        <th className="text-left px-4 py-3 text-sm font-semibold">Loja</th>
                        <th className="text-center px-4 py-3 text-sm font-semibold">Qtd. Atendidos</th>
                        <th className="text-center px-4 py-3 text-sm font-semibold w-16">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atendLoading ? (
                        <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
                      ) : atendimentosList.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum atendimento registrado</td></tr>
                      ) : (
                        atendimentosList.map((a: any) => (
                          <tr key={a.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium">{a.promotoraNome}</td>
                            <td className="px-4 py-3 text-sm">{formatDateBR(a.data)}</td>
                            <td className="px-4 py-3 text-sm">
                              <Badge variant="outline" className="bg-nosso-blue/5 text-nosso-blue border-nosso-blue/20">{a.loja}</Badge>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center justify-center bg-nosso-yellow/20 text-nosso-orange font-bold rounded-full h-8 w-12 text-sm">{a.quantidade}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(a.id, a.promotoraNome, "atendimento")} className="h-8 w-8 p-0 hover:bg-red-50" title="Excluir">
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {atendLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
            ) : atendimentosList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Nenhum atendimento registrado</div>
            ) : (
              atendimentosList.map((a: any) => (
                <Card key={a.id} className="shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{a.promotoraNome}</span>
                          <Badge variant="outline" className="bg-nosso-blue/5 text-nosso-blue border-nosso-blue/20 text-[10px]">{a.loja}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDateBR(a.data)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="inline-flex items-center justify-center bg-nosso-yellow/20 text-nosso-orange font-bold rounded-full h-8 px-3 text-sm">{a.quantidade}</span>
                        <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(a.id, a.promotoraNome, "atendimento")} className="h-8 w-8 p-0 hover:bg-red-50">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Lancamento Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-nosso-blue text-base sm:text-lg">Novo Lançamento</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Registre um novo cadastro de cliente no APP</DialogDescription>
          </DialogHeader>

          {validationMessage && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2.5 sm:p-3 text-xs sm:text-sm text-red-700">{validationMessage}</div>
          )}

          <div className="space-y-3 sm:space-y-4">
            <div>
              <Label className="text-xs sm:text-sm">Promotora *</Label>
              <Autocomplete options={promotoraOptions} value={form.promotoraId} onChange={(val) => setForm({ ...form, promotoraId: val as number | null })} placeholder="Selecione a promotora..." error={errors.promotoraId} />
              {errors.promotoraId && <p className="text-red-500 text-xs mt-1">Selecione uma promotora</p>}
            </div>

            {selectedPromotora && (
              <div className="bg-nosso-blue/5 rounded-md p-2.5 text-xs sm:text-sm">
                <span className="text-muted-foreground">Loja: </span>
                <Badge variant="outline" className="bg-nosso-blue/10 text-nosso-blue border-nosso-blue/20">{selectedPromotora.loja}</Badge>
              </div>
            )}

            <div>
              <Label htmlFor="lanc-cliente" className="text-xs sm:text-sm">Nome do Cliente *</Label>
              <Input id="lanc-cliente" value={form.nomeCliente} onChange={(e) => setForm({ ...form, nomeCliente: e.target.value })} onKeyDown={(e) => handleKeyDown(e, "lanc-cpf")} placeholder="Nome completo do cliente" className={`text-sm ${errors.nomeCliente ? "border-red-500 ring-1 ring-red-500" : ""}`} />
              {errors.nomeCliente && <p className="text-red-500 text-xs mt-1">Nome do cliente é obrigatório</p>}
            </div>

            <div>
              <Label htmlFor="lanc-cpf" className="text-xs sm:text-sm">CPF do Cliente *</Label>
              <Input id="lanc-cpf" value={form.cpfCliente} onChange={(e) => setForm({ ...form, cpfCliente: maskCPF(e.target.value) })} onKeyDown={(e) => handleKeyDown(e, "lanc-data")} placeholder="000.000.000-00" maxLength={14} className={`text-sm ${errors.cpfCliente ? "border-red-500 ring-1 ring-red-500" : ""}`} />
              {errors.cpfCliente && <p className="text-red-500 text-xs mt-1">CPF inválido</p>}
            </div>

            <div>
              <Label htmlFor="lanc-data" className="text-xs sm:text-sm">Data de Cadastro *</Label>
              <Input id="lanc-data" type="date" value={form.dataCadastro} onChange={(e) => setForm({ ...form, dataCadastro: e.target.value })} onKeyDown={(e) => handleKeyDown(e, "lanc-senha")} className={`text-sm ${errors.dataCadastro ? "border-red-500 ring-1 ring-red-500" : ""}`} />
              {errors.dataCadastro && <p className="text-red-500 text-xs mt-1">Data é obrigatória</p>}
            </div>

            <div>
              <Label htmlFor="lanc-senha" className="text-xs sm:text-sm">Senha da Promotora *</Label>
              <div className="relative">
                <Input id="lanc-senha" type={showPassword ? "text" : "password"} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }} placeholder="Digite a senha da promotora" className={`pr-10 text-sm ${errors.senha ? "border-red-500 ring-1 ring-red-500" : ""}`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.senha && <p className="text-red-500 text-xs mt-1">Senha é obrigatória</p>}
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">A senha será validada com a promotora selecionada</p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeDialog} className="w-full sm:w-auto text-sm">Cancelar</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending} className="w-full sm:w-auto bg-nosso-blue hover:bg-nosso-blue-dark text-white text-sm">
              {createMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Atendimento Dialog */}
      <Dialog open={isAtendDialogOpen} onOpenChange={(open) => !open && closeAtendDialog()}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-nosso-blue text-base sm:text-lg">Registrar Atendimento</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Informe a quantidade de pessoas atendidas no dia</DialogDescription>
          </DialogHeader>

          {atendValidationMessage && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2.5 sm:p-3 text-xs sm:text-sm text-red-700">{atendValidationMessage}</div>
          )}

          <div className="space-y-3 sm:space-y-4">
            <div>
              <Label className="text-xs sm:text-sm">Promotora *</Label>
              <Autocomplete options={promotoraOptions} value={atendForm.promotoraId} onChange={(val) => setAtendForm({ ...atendForm, promotoraId: val as number | null })} placeholder="Selecione a promotora..." error={atendErrors.promotoraId} />
              {atendErrors.promotoraId && <p className="text-red-500 text-xs mt-1">Selecione uma promotora</p>}
            </div>

            {selectedAtendPromotora && (
              <div className="bg-nosso-blue/5 rounded-md p-2.5 text-xs sm:text-sm">
                <span className="text-muted-foreground">Loja: </span>
                <Badge variant="outline" className="bg-nosso-blue/10 text-nosso-blue border-nosso-blue/20">{selectedAtendPromotora.loja}</Badge>
              </div>
            )}

            <div>
              <Label htmlFor="atend-data" className="text-xs sm:text-sm">Data *</Label>
              <Input id="atend-data" type="date" value={atendForm.data} onChange={(e) => setAtendForm({ ...atendForm, data: e.target.value })} onKeyDown={(e) => handleKeyDown(e, "atend-qtd")} className={`text-sm ${atendErrors.data ? "border-red-500 ring-1 ring-red-500" : ""}`} />
              {atendErrors.data && <p className="text-red-500 text-xs mt-1">Data é obrigatória</p>}
            </div>

            <div>
              <Label htmlFor="atend-qtd" className="text-xs sm:text-sm">Quantidade de Pessoas Atendidas *</Label>
              <Input id="atend-qtd" type="number" min="1" value={atendForm.quantidade} onChange={(e) => setAtendForm({ ...atendForm, quantidade: e.target.value })} onKeyDown={(e) => handleKeyDown(e, "atend-senha")} placeholder="Ex: 50" className={`text-sm ${atendErrors.quantidade ? "border-red-500 ring-1 ring-red-500" : ""}`} />
              {atendErrors.quantidade && <p className="text-red-500 text-xs mt-1">Quantidade é obrigatória</p>}
            </div>

            <div>
              <Label htmlFor="atend-senha" className="text-xs sm:text-sm">Senha da Promotora *</Label>
              <div className="relative">
                <Input id="atend-senha" type={showAtendPassword ? "text" : "password"} value={atendForm.senha} onChange={(e) => setAtendForm({ ...atendForm, senha: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveAtend(); } }} placeholder="Digite a senha da promotora" className={`pr-10 text-sm ${atendErrors.senha ? "border-red-500 ring-1 ring-red-500" : ""}`} />
                <button type="button" onClick={() => setShowAtendPassword(!showAtendPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showAtendPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {atendErrors.senha && <p className="text-red-500 text-xs mt-1">Senha é obrigatória</p>}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeAtendDialog} className="w-full sm:w-auto text-sm">Cancelar</Button>
            <Button onClick={handleSaveAtend} disabled={createAtendMutation.isPending} className="w-full sm:w-auto bg-nosso-blue hover:bg-nosso-blue-dark text-white text-sm">
              {createAtendMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2 text-base sm:text-lg">
              <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
              Excluir {deleteTarget?.type === "atendimento" ? "Atendimento" : "Lançamento"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Tem certeza que deseja excluir {deleteTarget?.type === "atendimento" ? "o atendimento de" : "o lançamento do cliente"}{" "}
              <strong>{deleteTarget?.nomeCliente}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2.5 sm:p-3 text-xs sm:text-sm text-red-700">{deleteError}</div>
          )}

          <div>
            <Label htmlFor="delete-senha" className="text-xs sm:text-sm">Senha de Administrador *</Label>
            <div className="relative">
              <Input id="delete-senha" type={showDeletePassword ? "text" : "password"} value={deleteSenha} onChange={(e) => { setDeleteSenha(e.target.value); setDeleteError(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleDelete(); } }} placeholder="Digite a senha de administrador" className="pr-10 text-sm" />
              <button type="button" onClick={() => setShowDeletePassword(!showDeletePassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">A exclusão requer a senha de administrador</p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeDeleteDialog} className="w-full sm:w-auto text-sm">Cancelar</Button>
            <Button onClick={handleDelete} disabled={deleteMutation.isPending || deleteAtendMutation.isPending} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white text-sm">
              {(deleteMutation.isPending || deleteAtendMutation.isPending) ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
