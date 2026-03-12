import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/masks";
import { Plus, Pencil, Trash2, Target, Calendar, Users, Calculator, Eye, EyeOff, Lock } from "lucide-react";

interface MetaPromoForm {
  promotoraId: number;
  nome: string;
  metaIndividual: number;
}

interface MetaForm {
  nome: string;
  metaMensal: number;
  dataInicio: string;
  dataFim: string;
  promotoras: MetaPromoForm[];
}

const emptyForm: MetaForm = { nome: "", metaMensal: 0, dataInicio: "", dataFim: "", promotoras: [] };

function calcDiasUteis(dataInicio: string, dataFim: string): number {
  if (!dataInicio || !dataFim) return 0;
  const start = new Date(dataInicio + "T00:00:00");
  const end = new Date(dataFim + "T00:00:00");
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export default function Metas() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MetaForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [validationMessage, setValidationMessage] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [senhaError, setSenhaError] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; nome: string } | null>(null);
  const [deleteSenha, setDeleteSenha] = useState("");
  const [deleteShowPw, setDeleteShowPw] = useState(false);
  const [deleteSenhaError, setDeleteSenhaError] = useState(false);

  const utils = trpc.useUtils();
  const { data: metasList = [], isLoading } = trpc.meta.list.useQuery();
  const { data: promotorasAtivas = [] } = trpc.promotora.list.useQuery({ apenasAtivas: true });

  const createMutation = trpc.meta.create.useMutation({
    onSuccess: () => {
      toast.success("Meta cadastrada com sucesso!");
      utils.meta.list.invalidate();
      utils.meta.current.invalidate();
      closeDialog();
    },
    onError: (err) => {
      if (err.message?.includes("Senha")) { setSenhaError(true); setValidationMessage("Senha de administrador incorreta."); }
      else setValidationMessage(err.message || "Erro ao cadastrar meta");
    },
  });

  const updateMutation = trpc.meta.update.useMutation({
    onSuccess: () => {
      toast.success("Meta atualizada com sucesso!");
      utils.meta.list.invalidate();
      utils.meta.current.invalidate();
      closeDialog();
    },
    onError: (err) => {
      if (err.message?.includes("Senha")) { setSenhaError(true); setValidationMessage("Senha de administrador incorreta."); }
      else setValidationMessage(err.message || "Erro ao atualizar meta");
    },
  });

  const deleteMutation = trpc.meta.delete.useMutation({
    onSuccess: () => {
      toast.success("Meta excluída com sucesso!");
      utils.meta.list.invalidate();
      utils.meta.current.invalidate();
      setDeleteTarget(null);
      setDeleteSenha("");
      setDeleteSenhaError(false);
    },
    onError: (err) => {
      if (err.message?.includes("Senha")) setDeleteSenhaError(true);
      else toast.error(err.message || "Erro ao excluir meta");
    },
  });

  function closeDialog() {
    setIsDialogOpen(false); setEditingId(null); setForm(emptyForm); setErrors({});
    setValidationMessage(""); setSenha(""); setShowPassword(false); setSenhaError(false);
  }

  function openCreate() {
    const promos: MetaPromoForm[] = promotorasAtivas.map((p: any) => ({ promotoraId: p.id, nome: p.nome, metaIndividual: 0 }));
    setForm({ ...emptyForm, promotoras: promos });
    setEditingId(null); setErrors({}); setValidationMessage(""); setSenha(""); setShowPassword(false); setSenhaError(false);
    setIsDialogOpen(true);
  }

  function openEdit(m: any) {
    const existingMap = new Map(m.promotoras.map((p: any) => [p.promotoraId, p.metaIndividual]));
    const promos: MetaPromoForm[] = promotorasAtivas.map((p: any) => ({
      promotoraId: p.id, nome: p.nome, metaIndividual: Number(existingMap.get(p.id)) || 0,
    }));
    m.promotoras.forEach((mp: any) => {
      if (!promos.find((p: MetaPromoForm) => p.promotoraId === mp.promotoraId)) {
        promos.push({ promotoraId: mp.promotoraId, nome: mp.nome, metaIndividual: Number(mp.metaIndividual) || 0 });
      }
    });
    setForm({ nome: m.nome, metaMensal: m.metaMensal, dataInicio: m.dataInicio, dataFim: m.dataFim, promotoras: promos });
    setEditingId(m.id); setErrors({}); setValidationMessage(""); setSenha(""); setShowPassword(false); setSenhaError(false);
    setIsDialogOpen(true);
  }

  function validate(): boolean {
    const newErrors: Record<string, boolean> = {};
    if (!form.nome.trim()) newErrors.nome = true;
    if (!form.metaMensal || form.metaMensal <= 0) newErrors.metaMensal = true;
    if (!form.dataInicio) newErrors.dataInicio = true;
    if (!form.dataFim) newErrors.dataFim = true;
    if (form.dataInicio && form.dataFim && form.dataInicio > form.dataFim) newErrors.dataFim = true;
    if (!senha.trim()) { setSenhaError(true); }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0 || !senha.trim()) {
      setValidationMessage("Preencha todos os campos obrigatórios e a senha de administrador.");
      return false;
    }
    setValidationMessage(""); return true;
  }

  function handleSave() {
    if (!validate()) return;
    const data = {
      nome: form.nome.trim(),
      metaMensal: form.metaMensal,
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      senha,
      promotoras: form.promotoras
        .filter((p) => p.metaIndividual > 0)
        .map((p) => ({ promotoraId: p.promotoraId, metaIndividual: p.metaIndividual })),
    };
    if (editingId) { updateMutation.mutate({ id: editingId, ...data }); }
    else { createMutation.mutate(data); }
  }

  function handleDelete() {
    if (!deleteSenha.trim()) { setDeleteSenhaError(true); return; }
    if (deleteTarget) { deleteMutation.mutate({ id: deleteTarget.id, senha: deleteSenha }); }
  }

  function distribuirMetaIgual() {
    if (form.promotoras.length === 0 || form.metaMensal <= 0) return;
    const metaPorPromotora = Math.ceil(form.metaMensal / form.promotoras.length);
    setForm({ ...form, promotoras: form.promotoras.map((p) => ({ ...p, metaIndividual: metaPorPromotora })) });
  }

  const diasUteis = useMemo(() => calcDiasUteis(form.dataInicio, form.dataFim), [form.dataInicio, form.dataFim]);
  const metaDiaria = useMemo(
    () => (diasUteis > 0 && form.metaMensal > 0 ? Math.round((form.metaMensal / diasUteis) * 100) / 100 : 0),
    [diasUteis, form.metaMensal]
  );

  function isMetaAtiva(m: any): boolean {
    const today = new Date().toISOString().split("T")[0];
    return m.dataInicio <= today && m.dataFim >= today;
  }

  // Calculate meta diária individual for each promotora
  function getMetaDiariaIndividual(metaIndividual: number, dUteis: number): number {
    if (dUteis <= 0 || metaIndividual <= 0) return 0;
    return Math.round((metaIndividual / dUteis) * 100) / 100;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-foreground">Gestão de Metas</h2>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Defina metas mensais com período e valores individuais por promotora</p>
        </div>
        <Button onClick={openCreate} size="sm" className="w-full sm:w-auto bg-nosso-blue hover:bg-nosso-blue-dark text-white shadow-md text-xs sm:text-sm">
          <Plus className="h-3.5 w-3.5 mr-1.5" />Nova Meta
        </Button>
      </div>

      {/* Metas List */}
      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Carregando...</div>
      ) : metasList.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Nenhuma meta cadastrada. Clique em "Nova Meta" para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(metasList as any[]).map((m: any) => (
            <Card key={m.id} className={`shadow-sm border-l-4 ${isMetaAtiva(m) ? "border-l-green-500" : "border-l-gray-300"}`}>
              <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                <div className="flex items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-sm sm:text-base">{m.nome}</CardTitle>
                    {isMetaAtiva(m) && (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] sm:text-xs">Vigente</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(m)} className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-nosso-blue/10">
                      <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-nosso-blue" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setDeleteTarget({ id: m.id, nome: m.nome }); setDeleteSenha(""); setDeleteShowPw(false); setDeleteSenhaError(false); }} className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-nosso-orange flex-shrink-0" />
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Meta Mensal</p>
                      <p className="font-bold text-xs sm:text-sm">{m.metaMensal}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calculator className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-nosso-blue flex-shrink-0" />
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Meta Diária</p>
                      <p className="font-bold text-xs sm:text-sm">{m.metaDiaria}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Período</p>
                      <p className="font-bold text-[10px] sm:text-sm">{formatDateBR(m.dataInicio)} - {formatDateBR(m.dataFim)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Dias Úteis</p>
                      <p className="font-bold text-xs sm:text-sm">{m.diasUteis}</p>
                    </div>
                  </div>
                </div>

                {m.promotoras && m.promotoras.length > 0 && (
                  <div>
                    <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Metas por Promotora</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {m.promotoras.map((mp: any) => {
                        const metaDiariaInd = getMetaDiariaIndividual(mp.metaIndividual, m.diasUteis);
                        return (
                          <div key={mp.promotoraId} className="flex items-center justify-between bg-muted/30 rounded-md px-2 sm:px-3 py-1.5 sm:py-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-xs sm:text-sm font-medium truncate block">{mp.nome}</span>
                              <span className="text-[10px] text-muted-foreground">{mp.loja}</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Badge variant="outline" className="bg-nosso-yellow/10 text-nosso-orange border-nosso-yellow/30 text-[10px] sm:text-xs">
                                {mp.metaIndividual}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">({metaDiariaInd}/dia)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-nosso-blue text-base sm:text-lg">{editingId ? "Editar Meta" : "Nova Meta"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">{editingId ? "Altere os dados da meta" : "Defina a meta mensal, período e valores por promotora"}</DialogDescription>
          </DialogHeader>

          {validationMessage && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2.5 sm:p-3 text-xs sm:text-sm text-red-700">{validationMessage}</div>
          )}

          <div className="space-y-3 sm:space-y-4">
            <div>
              <Label htmlFor="meta-nome" className="text-xs sm:text-sm">Nome da Meta *</Label>
              <Input id="meta-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Meta Fevereiro 2026" className={`text-sm ${errors.nome ? "border-red-500 ring-1 ring-red-500" : ""}`} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="meta-mensal" className="text-xs sm:text-sm">Meta Mensal (total) *</Label>
                <Input id="meta-mensal" type="number" value={form.metaMensal || ""} onChange={(e) => setForm({ ...form, metaMensal: parseInt(e.target.value) || 0 })} placeholder="80" className={`text-sm ${errors.metaMensal ? "border-red-500 ring-1 ring-red-500" : ""}`} />
              </div>
              <div>
                <Label htmlFor="meta-inicio" className="text-xs sm:text-sm">Data Início *</Label>
                <Input id="meta-inicio" type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} className={`text-sm ${errors.dataInicio ? "border-red-500 ring-1 ring-red-500" : ""}`} />
              </div>
              <div>
                <Label htmlFor="meta-fim" className="text-xs sm:text-sm">Data Fim *</Label>
                <Input id="meta-fim" type="date" value={form.dataFim} onChange={(e) => setForm({ ...form, dataFim: e.target.value })} className={`text-sm ${errors.dataFim ? "border-red-500 ring-1 ring-red-500" : ""}`} />
              </div>
            </div>

            {/* Calculated info */}
            {form.dataInicio && form.dataFim && form.metaMensal > 0 && (
              <div className="bg-nosso-blue/5 rounded-lg p-3 flex flex-wrap gap-4 sm:gap-6">
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Dias Úteis</p>
                  <p className="font-bold text-sm text-nosso-blue">{diasUteis}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Meta Diária (geral)</p>
                  <p className="font-bold text-sm text-nosso-blue">{metaDiaria}</p>
                </div>
              </div>
            )}

            {/* Promotoras meta assignment */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs sm:text-sm font-semibold">Meta por Promotora</Label>
                <Button type="button" variant="outline" size="sm" onClick={distribuirMetaIgual} disabled={form.metaMensal <= 0 || form.promotoras.length === 0} className="text-[10px] sm:text-xs h-7 sm:h-8">
                  <Calculator className="h-3 w-3 mr-1" />Distribuir Igualmente
                </Button>
              </div>
              <div className="space-y-2 max-h-48 sm:max-h-60 overflow-y-auto">
                {form.promotoras.map((p, idx) => {
                  const metaDiariaInd = getMetaDiariaIndividual(p.metaIndividual, diasUteis);
                  return (
                    <div key={p.promotoraId} className="flex items-center gap-2 sm:gap-3 bg-muted/20 rounded-md px-2 sm:px-3 py-1.5 sm:py-2">
                      <span className="flex-1 text-xs sm:text-sm font-medium truncate">{p.nome}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{metaDiariaInd}/dia</span>
                      <Input
                        type="number"
                        value={p.metaIndividual || ""}
                        onChange={(e) => {
                          const newPromos = [...form.promotoras];
                          newPromos[idx] = { ...newPromos[idx], metaIndividual: parseInt(e.target.value) || 0 };
                          setForm({ ...form, promotoras: newPromos });
                        }}
                        className="w-16 sm:w-24 text-center h-7 sm:h-8 text-sm"
                        placeholder="0"
                        min={0}
                      />
                    </div>
                  );
                })}
              </div>
              {form.promotoras.length > 0 && (
                <div className="mt-2 text-[10px] sm:text-xs text-muted-foreground text-right">
                  Total individual: {form.promotoras.reduce((sum, p) => sum + p.metaIndividual, 0)} | Meta mensal: {form.metaMensal}
                </div>
              )}
            </div>

            {/* Admin password */}
            <div className="border-t pt-3">
              <Label htmlFor="meta-senha" className="text-xs sm:text-sm flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-nosso-orange" />Senha de Administrador *
              </Label>
              <div className="relative mt-1">
                <Input
                  id="meta-senha"
                  type={showPassword ? "text" : "password"}
                  value={senha}
                  onChange={(e) => { setSenha(e.target.value); setSenhaError(false); }}
                  placeholder="Informe a senha de administrador"
                  className={`pr-10 text-sm ${senhaError ? "border-red-500 ring-1 ring-red-500" : ""}`}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {senhaError && <p className="text-red-500 text-xs mt-1">Senha é obrigatória</p>}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeDialog} className="w-full sm:w-auto text-sm">Cancelar</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="w-full sm:w-auto bg-nosso-blue hover:bg-nosso-blue-dark text-white text-sm">
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog with Password */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteSenha(""); setDeleteSenhaError(false); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 text-base sm:text-lg flex items-center gap-2">
              <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />Excluir Meta
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Tem certeza que deseja excluir a meta <strong>{deleteTarget?.nome}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="delete-meta-senha" className="text-xs sm:text-sm flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-red-500" />Senha de Administrador *
              </Label>
              <div className="relative mt-1">
                <Input
                  id="delete-meta-senha"
                  type={deleteShowPw ? "text" : "password"}
                  value={deleteSenha}
                  onChange={(e) => { setDeleteSenha(e.target.value); setDeleteSenhaError(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleDelete(); }}
                  placeholder="Informe a senha para confirmar"
                  className={`pr-10 text-sm ${deleteSenhaError ? "border-red-500 ring-1 ring-red-500" : ""}`}
                />
                <button type="button" onClick={() => setDeleteShowPw(!deleteShowPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {deleteShowPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {deleteSenhaError && <p className="text-red-500 text-xs mt-1">Senha incorreta ou não informada</p>}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteSenha(""); setDeleteSenhaError(false); }} className="w-full sm:w-auto text-sm">Cancelar</Button>
            <Button onClick={handleDelete} disabled={deleteMutation.isPending} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white text-sm">
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
