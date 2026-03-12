import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { maskCPF, maskPhone } from "@/lib/masks";
import { LOJAS } from "@/lib/constants";
import { Plus, Pencil, UserX, UserCheck, Search, Eye, EyeOff } from "lucide-react";

interface PromotoraForm {
  nome: string;
  cpf: string;
  telefone: string;
  loja: string;
  senha: string;
}

const emptyForm: PromotoraForm = { nome: "", cpf: "", telefone: "", loja: "", senha: "" };

export default function Promotoras() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PromotoraForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmToggle, setConfirmToggle] = useState<{ id: number; nome: string; ativa: number } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");

  const utils = trpc.useUtils();
  const { data: promotorasList = [], isLoading } = trpc.promotora.list.useQuery();

  const createMutation = trpc.promotora.create.useMutation({
    onSuccess: () => { toast.success("Promotora cadastrada com sucesso!"); utils.promotora.list.invalidate(); closeDialog(); },
    onError: (err) => { setValidationMessage(err.message || "Erro ao cadastrar promotora"); },
  });

  const updateMutation = trpc.promotora.update.useMutation({
    onSuccess: () => { toast.success("Promotora atualizada com sucesso!"); utils.promotora.list.invalidate(); closeDialog(); },
    onError: (err) => { setValidationMessage(err.message || "Erro ao atualizar promotora"); },
  });

  const toggleMutation = trpc.promotora.toggleStatus.useMutation({
    onSuccess: (data) => { toast.success(data.ativa === 1 ? "Promotora ativada!" : "Promotora inativada!"); utils.promotora.list.invalidate(); setConfirmToggle(null); },
    onError: (err) => { toast.error(err.message || "Erro ao alterar status"); },
  });

  function closeDialog() {
    setIsDialogOpen(false); setEditingId(null); setForm(emptyForm); setErrors({}); setShowPassword(false); setValidationMessage("");
  }

  function openCreate() {
    setForm(emptyForm); setEditingId(null); setErrors({}); setShowPassword(false); setValidationMessage(""); setIsDialogOpen(true);
  }

  function openEdit(p: any) {
    setForm({ nome: p.nome, cpf: p.cpf, telefone: p.telefone, loja: p.loja, senha: p.senha });
    setEditingId(p.id); setErrors({}); setShowPassword(false); setValidationMessage(""); setIsDialogOpen(true);
  }

  function validate(): boolean {
    const newErrors: Record<string, boolean> = {};
    if (!form.nome.trim()) newErrors.nome = true;
    if (form.cpf.replace(/\D/g, "").length !== 11) newErrors.cpf = true;
    if (!form.telefone.trim()) newErrors.telefone = true;
    if (!form.loja) newErrors.loja = true;
    if (!form.senha.trim()) newErrors.senha = true;
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) { setValidationMessage("Preencha todos os campos obrigatórios corretamente."); return false; }
    setValidationMessage(""); return true;
  }

  function handleSave() {
    if (!validate()) return;
    const data = { nome: form.nome.trim(), cpf: form.cpf, telefone: form.telefone, loja: form.loja as any, senha: form.senha };
    if (editingId) { updateMutation.mutate({ id: editingId, ...data }); } else { createMutation.mutate(data); }
  }

  function handleKeyDown(e: React.KeyboardEvent, nextFieldId?: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (nextFieldId) { const next = document.getElementById(nextFieldId); if (next) next.focus(); } else { handleSave(); }
    }
  }

  const filtered = promotorasList.filter((p: any) =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cpf.includes(searchTerm) ||
    p.loja.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-foreground">Cadastro de Promotoras</h2>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Gerencie as promotoras cadastradas no sistema</p>
        </div>
        <Button onClick={openCreate} size="sm" className="w-full sm:w-auto bg-nosso-blue hover:bg-nosso-blue-dark text-white shadow-md text-xs sm:text-sm">
          <Plus className="h-3.5 w-3.5 mr-1.5" />Nova Promotora
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, CPF ou loja..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-nosso-blue/5 border-b">
                    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Nome</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">CPF</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Telefone</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Loja</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Status</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma promotora encontrada</td></tr>
                  ) : (
                    filtered.map((p: any) => (
                      <tr key={p.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium">{p.nome}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{p.cpf}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{p.telefone}</td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant="outline" className="bg-nosso-blue/5 text-nosso-blue border-nosso-blue/20">{p.loja}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant={p.ativa === 1 ? "default" : "secondary"} className={p.ativa === 1 ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}>
                            {p.ativa === 1 ? "Ativa" : "Inativa"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(p)} className="h-8 w-8 p-0 hover:bg-nosso-blue/10">
                              <Pencil className="h-4 w-4 text-nosso-blue" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setConfirmToggle({ id: p.id, nome: p.nome, ativa: p.ativa })} className={`h-8 w-8 p-0 ${p.ativa === 1 ? "hover:bg-red-50" : "hover:bg-green-50"}`}>
                              {p.ativa === 1 ? <UserX className="h-4 w-4 text-red-500" /> : <UserCheck className="h-4 w-4 text-green-500" />}
                            </Button>
                          </div>
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

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma promotora encontrada</div>
        ) : (
          filtered.map((p: any) => (
            <Card key={p.id} className={`shadow-sm ${p.ativa !== 1 ? "opacity-60" : ""}`}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{p.nome}</span>
                      <Badge variant={p.ativa === 1 ? "default" : "secondary"} className={`text-[10px] ${p.ativa === 1 ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}`}>
                        {p.ativa === 1 ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="bg-nosso-blue/5 text-nosso-blue border-nosso-blue/20 text-[10px]">{p.loja}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{p.cpf}</span>
                      <span>{p.telefone}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)} className="h-8 w-8 p-0 hover:bg-nosso-blue/10">
                      <Pencil className="h-4 w-4 text-nosso-blue" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmToggle({ id: p.id, nome: p.nome, ativa: p.ativa })} className={`h-8 w-8 p-0 ${p.ativa === 1 ? "hover:bg-red-50" : "hover:bg-green-50"}`}>
                      {p.ativa === 1 ? <UserX className="h-4 w-4 text-red-500" /> : <UserCheck className="h-4 w-4 text-green-500" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-nosso-blue text-base sm:text-lg">{editingId ? "Editar Promotora" : "Nova Promotora"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">{editingId ? "Altere os dados da promotora" : "Preencha os dados para cadastrar uma nova promotora"}</DialogDescription>
          </DialogHeader>

          {validationMessage && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2.5 sm:p-3 text-xs sm:text-sm text-red-700">{validationMessage}</div>
          )}

          <div className="space-y-3 sm:space-y-4">
            <div>
              <Label htmlFor="prom-nome" className="text-xs sm:text-sm">Nome *</Label>
              <Input id="prom-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} onKeyDown={(e) => handleKeyDown(e, "prom-cpf")} placeholder="Nome completo" className={`text-sm ${errors.nome ? "border-red-500 ring-1 ring-red-500" : ""}`} />
              {errors.nome && <p className="text-red-500 text-xs mt-1">Nome é obrigatório</p>}
            </div>

            <div>
              <Label htmlFor="prom-cpf" className="text-xs sm:text-sm">CPF *</Label>
              <Input id="prom-cpf" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })} onKeyDown={(e) => handleKeyDown(e, "prom-telefone")} placeholder="000.000.000-00" maxLength={14} className={`text-sm ${errors.cpf ? "border-red-500 ring-1 ring-red-500" : ""}`} />
              {errors.cpf && <p className="text-red-500 text-xs mt-1">CPF inválido</p>}
            </div>

            <div>
              <Label htmlFor="prom-telefone" className="text-xs sm:text-sm">Telefone *</Label>
              <Input id="prom-telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })} onKeyDown={(e) => handleKeyDown(e, "prom-loja")} placeholder="(00) 00000-0000" maxLength={15} className={`text-sm ${errors.telefone ? "border-red-500 ring-1 ring-red-500" : ""}`} />
              {errors.telefone && <p className="text-red-500 text-xs mt-1">Telefone é obrigatório</p>}
            </div>

            <div>
              <Label htmlFor="prom-loja" className="text-xs sm:text-sm">Loja *</Label>
              <Select value={form.loja} onValueChange={(val) => setForm({ ...form, loja: val })}>
                <SelectTrigger id="prom-loja" className={`text-sm ${errors.loja ? "border-red-500 ring-1 ring-red-500" : ""}`}>
                  <SelectValue placeholder="Selecione a loja" />
                </SelectTrigger>
                <SelectContent>
                  {LOJAS.map((loja) => (<SelectItem key={loja} value={loja}>{loja}</SelectItem>))}
                </SelectContent>
              </Select>
              {errors.loja && <p className="text-red-500 text-xs mt-1">Loja é obrigatória</p>}
            </div>

            <div>
              <Label htmlFor="prom-senha" className="text-xs sm:text-sm">Senha *</Label>
              <div className="relative">
                <Input id="prom-senha" type={showPassword ? "text" : "password"} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} onKeyDown={(e) => handleKeyDown(e)} placeholder="Senha para lançamentos" className={`pr-10 text-sm ${errors.senha ? "border-red-500 ring-1 ring-red-500" : ""}`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.senha && <p className="text-red-500 text-xs mt-1">Senha é obrigatória</p>}
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

      {/* Confirm Toggle Dialog */}
      <AlertDialog open={!!confirmToggle} onOpenChange={(open) => !open && setConfirmToggle(null)}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">{confirmToggle?.ativa === 1 ? "Inativar Promotora" : "Ativar Promotora"}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              Tem certeza que deseja {confirmToggle?.ativa === 1 ? "inativar" : "ativar"} a promotora <strong>{confirmToggle?.nome}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto text-sm">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmToggle) toggleMutation.mutate({ id: confirmToggle.id }); }} className={`w-full sm:w-auto text-sm ${confirmToggle?.ativa === 1 ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}>
              {confirmToggle?.ativa === 1 ? "Inativar" : "Ativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
