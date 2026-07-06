// Forced rebuild trigger
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listarConstrutoras,
  excluirConstrutora,
  listarTodasAtividadesConstrutoras,
  atualizarAtividadeConstrutora,
  type Construtora,
} from "@/services/construtorasService";
import { listarObras, atualizarObra, type Obra } from "@/services/obrasService";
import {
  listarPessoas,
  atualizarPessoa,
  excluirPessoa,
  listarTodasAtividadesPessoas,
  atualizarAtividadePessoa,
  type Pessoa,
} from "@/services/pessoasService";
import { listarTodasAtividades, atualizarAtividade } from "@/services/atividadesService";
import { strongNorm, onlyDigits, nomesCompativeis } from "@/lib/normalize";
import { Building, Users, GitMerge, AlertTriangle, Check, Loader2 } from "lucide-react";

const getCtGroupKey = (group: Construtora[]) => {
  return group
    .map((c) => c.codigo || "")
    .filter(Boolean)
    .sort()
    .join("|");
};

const getPesGroupKey = (group: Pessoa[]) => {
  return group
    .map((p) => p.codigoPessoa || "")
    .filter(Boolean)
    .sort()
    .join("|");
};

export default function Duplicatas() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);

  // Data states
  const [construtoras, setConstrutoras] = useState<Construtora[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);

  // Duplicate groups states
  const [duplicateConstrutoras, setDuplicateConstrutoras] = useState<Construtora[][]>([]);
  const [duplicatePessoas, setDuplicatePessoas] = useState<Pessoa[][]>([]);

  // Selected principals state
  // Key: index of group, Value: selected code
  const [selectedPrincipalsCt, setSelectedPrincipalsCt] = useState<Record<number, string>>({});
  const [selectedPrincipalsPes, setSelectedPrincipalsPes] = useState<Record<number, string>>({});

  // Confirmation state
  const [confirmCtMerge, setConfirmCtMerge] = useState<{
    groupIndex: number;
    principal: Construtora;
    duplicates: Construtora[];
    totalObras: number;
    totalContatos: number;
  } | null>(null);

  const [confirmPesMerge, setConfirmPesMerge] = useState<{
    groupIndex: number;
    principal: Pessoa;
    duplicates: Pessoa[];
  } | null>(null);

  // Load ignored groups from localStorage
  const [ignoredCtKeys, setIgnoredCtKeys] = useState<string[]>([]);
  const [ignoredPesKeys, setIgnoredPesKeys] = useState<string[]>([]);

  useEffect(() => {
    const ignoredCts = localStorage.getItem("crm_ignored_ct_groups");
    const ignoredPes = localStorage.getItem("crm_ignored_pes_groups");
    const parsedCts = ignoredCts ? JSON.parse(ignoredCts) : [];
    const parsedPes = ignoredPes ? JSON.parse(ignoredPes) : [];
    setIgnoredCtKeys(parsedCts);
    setIgnoredPesKeys(parsedPes);
    
    fetchData(parsedCts, parsedPes);
  }, []);

  async function fetchData(ignoredCtsRaw?: string[], ignoredPesRaw?: string[]) {
    setLoading(true);
    try {
      const [cts, obrs, pes] = await Promise.all([
        listarConstrutoras(),
        listarObras(),
        listarPessoas().catch(() => [] as Pessoa[]),
      ]);
      setConstrutoras(cts);
      setObras(obrs);
      setPessoas(pes);

      const ignoredCts = ignoredCtsRaw || JSON.parse(localStorage.getItem("crm_ignored_ct_groups") || "[]");
      const ignoredPes = ignoredPesRaw || JSON.parse(localStorage.getItem("crm_ignored_pes_groups") || "[]");

      // Group duplicates
      findDuplicates(cts, obrs, pes, ignoredCts, ignoredPes);
    } catch (err) {
      toast({
        title: "Erro ao carregar dados",
        description: err instanceof Error ? err.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function findDuplicates(
    cts: Construtora[],
    obrs: Obra[],
    pes: Pessoa[],
    ignoredCts: string[],
    ignoredPes: string[]
  ) {
    // 1) Group Construtoras
    const ctGroups: Construtora[][] = [];
    for (const c of cts) {
      let added = false;
      for (const group of ctGroups) {
        const match = group.some((item) => {
          const cCnpj = onlyDigits(c.cnpj);
          const itemCnpj = onlyDigits(item.cnpj);
          if (cCnpj && itemCnpj && cCnpj === itemCnpj) {
            return true;
          }
          return strongNorm(c.nome) === strongNorm(item.nome) || nomesCompativeis(c.nome, item.nome);
        });
        if (match) {
          group.push(c);
          added = true;
          break;
        }
      }
      if (!added) {
        ctGroups.push([c]);
      }
    }
    const dupCts = ctGroups
      .filter((g) => g.length >= 2)
      .filter((g) => !ignoredCts.includes(getCtGroupKey(g)));
    setDuplicateConstrutoras(dupCts);

    // Initialize default principals for Construtoras
    const initialPrincipalsCt: Record<number, string> = {};
    dupCts.forEach((group, idx) => {
      // Prioritize the one with most Obras / Contatos
      const sorted = [...group].sort((a, b) => {
        const aObras = obrs.filter((o) => o.codigoConstrutora === a.codigo).length;
        const bObras = obrs.filter((o) => o.codigoConstrutora === b.codigo).length;
        return bObras - aObras;
      });
      initialPrincipalsCt[idx] = sorted[0].codigo || "";
    });
    setSelectedPrincipalsCt(initialPrincipalsCt);

    // 2) Group Pessoas
    const pesGroups: Pessoa[][] = [];
    for (const p of pes) {
      let added = false;
      for (const group of pesGroups) {
        const match = group.some((item) => {
          const pEmail = (p.email || "").toLowerCase().replace(/\s+/g, "");
          const itemEmail = (item.email || "").toLowerCase().replace(/\s+/g, "");
          if (pEmail && itemEmail && pEmail === itemEmail) {
            return true;
          }
          const pName = strongNorm(p.nome);
          const itemName = strongNorm(item.nome);
          const pTel = onlyDigits(p.whatsapp || "");
          const itemTel = onlyDigits(item.whatsapp || "");
          if (pName && itemName && pName === itemName && pTel && itemTel && pTel === itemTel) {
            return true;
          }
          if (pName && itemName && nomesCompativeis(p.nome, item.nome)) {
            const hasPhoneConflict = pTel && itemTel && pTel !== itemTel;
            const hasEmailConflict = pEmail && itemEmail && pEmail !== itemEmail;
            if (!hasPhoneConflict && !hasEmailConflict) {
              return true;
            }
          }
          return false;
        });
        if (match) {
          group.push(p);
          added = true;
          break;
        }
      }
      if (!added) {
        pesGroups.push([p]);
      }
    }
    const dupPes = pesGroups
      .filter((g) => g.length >= 2)
      .filter((g) => !ignoredPes.includes(getPesGroupKey(g)));
    setDuplicatePessoas(dupPes);

    // Initialize default principals for Pessoas
    const initialPrincipalsPes: Record<number, string> = {};
    dupPes.forEach((group, idx) => {
      // Prioritize the one that has an Obra or Construtora linked
      const sorted = [...group].sort((a, b) => {
        const aPoints = (a.codigoObraAtual ? 2 : 0) + (a.codigoConstrutora ? 1 : 0);
        const bPoints = (b.codigoObraAtual ? 2 : 0) + (b.codigoConstrutora ? 1 : 0);
        return bPoints - aPoints;
      });
      initialPrincipalsPes[idx] = sorted[0].codigoPessoa || "";
    });
    setSelectedPrincipalsPes(initialPrincipalsPes);
  }

  function ignoreCtGroup(group: Construtora[]) {
    const key = getCtGroupKey(group);
    const next = [...ignoredCtKeys, key];
    setIgnoredCtKeys(next);
    localStorage.setItem("crm_ignored_ct_groups", JSON.stringify(next));
    setDuplicateConstrutoras((prev) => prev.filter((g) => getCtGroupKey(g) !== key));
    toast({
      title: "Grupo ignorado",
      description: "Esta sugestão não será mostrada novamente.",
    });
  }

  function ignorePesGroup(group: Pessoa[]) {
    const key = getPesGroupKey(group);
    const next = [...ignoredPesKeys, key];
    setIgnoredPesKeys(next);
    localStorage.setItem("crm_ignored_pes_groups", JSON.stringify(next));
    setDuplicatePessoas((prev) => prev.filter((g) => getPesGroupKey(g) !== key));
    toast({
      title: "Grupo ignorado",
      description: "Esta sugestão não será mostrada novamente.",
    });
  }

  function clearIgnored() {
    setIgnoredCtKeys([]);
    setIgnoredPesKeys([]);
    localStorage.removeItem("crm_ignored_ct_groups");
    localStorage.removeItem("crm_ignored_pes_groups");
    fetchData([], []);
    toast({
      title: "Ignorados limpos",
      description: "Todas as sugestões foram reescaneadas.",
    });
  }

  // Merging Logic for Construtoras
  async function mergeConstrutoras(
    groupIndex: number,
    principal: Construtora,
    duplicates: Construtora[]
  ) {
    setMerging(true);
    try {
      const duplicateCodes = duplicates.map((d) => d.codigo).filter(Boolean) as string[];

      // 1) Religar Obras (codigoConstrutora = principal.codigo; construtora = principal.nome)
      const obrasToMigrate = obras.filter(
        (o) => o.codigoConstrutora && duplicateCodes.includes(o.codigoConstrutora)
      );

      for (const obra of obrasToMigrate) {
        if (!obra.codigoObra) continue;
        await atualizarObra(obra.codigoObra, {
          ...obra,
          codigoConstrutora: principal.codigo,
          construtora: principal.nome,
        });
      }

      // 2) Religar Contatos (codigoConstrutora = principal.codigo)
      const contatosToMigrate = pessoas.filter(
        (p) => p.codigoConstrutora && duplicateCodes.includes(p.codigoConstrutora)
      );

      for (const contato of contatosToMigrate) {
        if (!contato.codigoPessoa) continue;
        await atualizarPessoa(contato.codigoPessoa, {
          codigoConstrutora: principal.codigo!,
        });
      }

      // 3) Religar Atividades das Construtoras Duplicadas
      let atvMovidas = 0;
      const [atvCt, atvObra, atvPes] = await Promise.all([
        listarTodasAtividadesConstrutoras().catch(() => []),
        listarTodasAtividades().catch(() => []),
        listarTodasAtividadesPessoas().catch(() => [])
      ]);

      for (const dup of duplicates) {
        if (!dup.codigo) continue;
        // 3.1) atividades NATIVAS da construtora duplicada -> principal
        for (const a of atvCt.filter((x) => x.codigoConstrutora === dup.codigo)) {
          if (a.idAtividade) {
            await atualizarAtividadeConstrutora(a.idAtividade, { codigoConstrutora: principal.codigo });
            atvMovidas++;
          }
        }
        // 3.2) vínculos codigoConstrutora em atividades de OBRA -> principal
        for (const a of atvObra.filter((x) => x.codigoConstrutora === dup.codigo)) {
          if (a.idAtividade) {
            await atualizarAtividade(a.idAtividade, { codigoConstrutora: principal.codigo });
            atvMovidas++;
          }
        }
        // 3.3) vínculos codigoConstrutora em atividades de PESSOA -> principal
        for (const a of atvPes.filter((x) => x.codigoConstrutora === dup.codigo)) {
          if (a.idAtividade) {
            await atualizarAtividadePessoa(a.idAtividade, { codigoConstrutora: principal.codigo });
            atvMovidas++;
          }
        }
      }

      // 4) Excluir Construtoras Duplicadas (após sucesso de todos os updates anteriores)
      for (const dup of duplicates) {
        if (!dup.codigo) continue;
        await excluirConstrutora(dup.codigo);
      }

      const summaryText = `${obrasToMigrate.length} ${obrasToMigrate.length === 1 ? "obra" : "obras"}, ` +
        `${contatosToMigrate.length} ${contatosToMigrate.length === 1 ? "contato" : "contatos"} e ` +
        `${atvMovidas} ${atvMovidas === 1 ? "atividade" : "atividades"} movidos para "${principal.nome}".`;

      toast({
        title: "Construtoras mescladas",
        description: summaryText,
      });

      // Fetch fresh data and reload duplicate lists
      await fetchData();
    } catch (err) {
      toast({
        title: "Erro ao mesclar",
        description: err instanceof Error ? err.message : "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setMerging(false);
      setConfirmCtMerge(null);
    }
  }

  // Merging Logic for Pessoas
  async function mergePessoas(groupIndex: number, principal: Pessoa, duplicates: Pessoa[]) {
    setMerging(true);
    try {
      // Step 1: Unificar vínculos de obra/construtora no contato principal
      const patch: Partial<Pessoa> = {};
      let localObra = principal.codigoObraAtual;
      let localCt = principal.codigoConstrutora;
      let localWhatsapp = principal.whatsapp;
      let localEmail = principal.email;
      let localCargo = principal.cargo;
      let localObs = principal.observacoes;

      for (const dup of duplicates) {
        if (!localObra && dup.codigoObraAtual) {
          patch.codigoObraAtual = dup.codigoObraAtual;
          localObra = dup.codigoObraAtual;
        }
        if (!localCt && dup.codigoConstrutora) {
          patch.codigoConstrutora = dup.codigoConstrutora;
          localCt = dup.codigoConstrutora;
        }
        if (!localWhatsapp && dup.whatsapp) {
          patch.whatsapp = dup.whatsapp;
          localWhatsapp = dup.whatsapp;
        }
        if (!localEmail && dup.email) {
          patch.email = dup.email;
          localEmail = dup.email;
        }
        if ((!localCargo || localCargo === "Não Informado") && dup.cargo && dup.cargo !== "Não Informado") {
          patch.cargo = dup.cargo;
          localCargo = dup.cargo;
        }
        if (!localObs && dup.observacoes) {
          patch.observacoes = dup.observacoes;
          localObs = dup.observacoes;
        } else if (localObs && dup.observacoes && !localObs.includes(dup.observacoes)) {
          patch.observacoes = `${localObs} | ${dup.observacoes}`;
          localObs = patch.observacoes;
        }
      }

      if (Object.keys(patch).length > 0 && principal.codigoPessoa) {
        await atualizarPessoa(principal.codigoPessoa, patch);
      }

      // Step 1.5: Religar Atividades das Pessoas Duplicadas
      let atvMovidas = 0;
      const [atvPes, atvObra, atvCt] = await Promise.all([
        listarTodasAtividadesPessoas().catch(() => []),
        listarTodasAtividades().catch(() => []),
        listarTodasAtividadesConstrutoras().catch(() => [])
      ]);

      for (const dup of duplicates) {
        if (!dup.codigoPessoa) continue;
        // 1) atividades NATIVAS da pessoa duplicada -> principal
        for (const a of atvPes.filter((x) => x.codigoPessoa === dup.codigoPessoa)) {
          if (a.idAtividade) {
            await atualizarAtividadePessoa(a.idAtividade, { codigoPessoa: principal.codigoPessoa });
            atvMovidas++;
          }
        }
        // 2) vínculos codigoPessoa em atividades de OBRA -> principal
        for (const a of atvObra.filter((x) => x.codigoPessoa === dup.codigoPessoa)) {
          if (a.idAtividade) {
            await atualizarAtividade(a.idAtividade, { codigoPessoa: principal.codigoPessoa });
            atvMovidas++;
          }
        }
        // 3) vínculos codigoPessoa em atividades de CONSTRUTORA -> principal
        for (const a of atvCt.filter((x) => x.codigoPessoa === dup.codigoPessoa)) {
          if (a.idAtividade) {
            await atualizarAtividadeConstrutora(a.idAtividade, { codigoPessoa: principal.codigoPessoa });
            atvMovidas++;
          }
        }
      }

      // Step 2: Excluir contatos duplicados
      for (const dup of duplicates) {
        if (!dup.codigoPessoa) continue;
        await excluirPessoa(dup.codigoPessoa);
      }

      const summaryText = `${atvMovidas} ${atvMovidas === 1 ? "atividade" : "atividades"} movidas. ` +
        `Os contatos duplicados foram removidos e seus vínculos unificados em "${principal.nome}".`;

      toast({
        title: "Contatos mesclados",
        description: summaryText,
      });

      await fetchData();
    } catch (err) {
      toast({
        title: "Erro ao mesclar",
        description: err instanceof Error ? err.message : "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setMerging(false);
      setConfirmPesMerge(null);
    }
  }

  function handleCtPreMerge(groupIndex: number, group: Construtora[]) {
    const principalCode = selectedPrincipalsCt[groupIndex];
    const principal = group.find((c) => c.codigo === principalCode);
    if (!principal) return;

    const duplicates = group.filter((c) => c.codigo !== principalCode);
    const duplicateCodes = duplicates.map((d) => d.codigo);

    // Calculate total Obras & Contatos affected
    const totalObras = obras.filter(
      (o) => o.codigoConstrutora && duplicateCodes.includes(o.codigoConstrutora)
    ).length;
    const totalContatos = pessoas.filter(
      (p) => p.codigoConstrutora && duplicateCodes.includes(p.codigoConstrutora)
    ).length;

    setConfirmCtMerge({
      groupIndex,
      principal,
      duplicates,
      totalObras,
      totalContatos,
    });
  }

  function handlePesPreMerge(groupIndex: number, group: Pessoa[]) {
    const principalId = selectedPrincipalsPes[groupIndex];
    const principal = group.find((p) => p.codigoPessoa === principalId);
    if (!principal) return;

    const duplicates = group.filter((p) => p.codigoPessoa !== principalId);

    setConfirmPesMerge({
      groupIndex,
      principal,
      duplicates,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-foreground flex items-center gap-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <GitMerge className="h-6 w-6 text-primary animate-pulse" />
            Limpar Duplicatas
          </h1>
          <p className="text-muted-foreground mt-1">
            Detecte registros duplicados de Construtoras e Contatos para unificar seus históricos e vínculos.
          </p>
        </div>
        {(ignoredCtKeys.length > 0 || ignoredPesKeys.length > 0) && (
          <Button variant="outline" size="sm" onClick={clearIgnored}>
            Restaurar Sugestões Ignoradas ({ignoredCtKeys.length + ignoredPesKeys.length})
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Procurando duplicatas no banco de dados...</p>
        </div>
      ) : (
        <Tabs defaultValue="construtoras" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6">
            <TabsTrigger value="construtoras" className="flex gap-2">
              <Building className="h-4 w-4" />
              Construtoras ({duplicateConstrutoras.length})
            </TabsTrigger>
            <TabsTrigger value="contatos" className="flex gap-2">
              <Users className="h-4 w-4" />
              Contatos ({duplicatePessoas.length})
            </TabsTrigger>
          </TabsList>

          {/* ============ TABA CONSTRUTORAS ============ */}
          <TabsContent value="construtoras" className="space-y-6">
            {duplicateConstrutoras.length === 0 ? (
              <Card className="border-dashed py-12 flex flex-col items-center justify-center text-center">
                <CardHeader>
                  <CardTitle className="text-lg">Tudo limpo!</CardTitle>
                  <CardDescription>
                    Nenhuma construtora duplicada encontrada por CNPJ ou nome normalizado.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-accent/20 p-3 rounded-lg border border-accent">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span>
                    Foram identificados <strong>{duplicateConstrutoras.length} grupos</strong> de construtoras com nomes normalizados iguais ou mesmo CNPJ.
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {duplicateConstrutoras.map((group, groupIdx) => {
                    const selectedId = selectedPrincipalsCt[groupIdx];

                    return (
                      <Card
                        key={groupIdx}
                        className="overflow-hidden border border-border shadow-sm hover:shadow transition-all duration-300"
                      >
                        <CardHeader className="bg-muted/30 border-b border-border/50 py-3 px-4">
                          <CardTitle className="text-sm font-semibold flex items-center justify-between">
                            <span>Grupo de Duplicidade #{groupIdx + 1}</span>
                            <Badge variant="outline" className="text-xs">
                              {group.length} duplicatas encontradas
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {group.map((ct) => {
                              const isPrincipal = selectedId === ct.codigo;
                              const numObras = obras.filter((o) => o.codigoConstrutora === ct.codigo).length;
                              const numContatos = pessoas.filter((p) => p.codigoConstrutora === ct.codigo).length;

                              return (
                                <div
                                  key={ct.codigo}
                                  onClick={() =>
                                    setSelectedPrincipalsCt((prev) => ({
                                      ...prev,
                                      [groupIdx]: ct.codigo || "",
                                    }))
                                  }
                                  className={`relative border rounded-xl p-4 cursor-pointer transition-all duration-300 ${
                                    isPrincipal
                                      ? "border-primary bg-primary/5 shadow-inner ring-1 ring-primary"
                                      : "border-border hover:border-muted-foreground/30 bg-card"
                                  }`}
                                >
                                  {isPrincipal && (
                                    <div className="absolute top-3 right-3 bg-primary text-primary-foreground rounded-full p-1 animate-scale-in">
                                      <Check className="h-3 w-3" />
                                    </div>
                                  )}
                                  <div className="space-y-2">
                                    <div className="pr-6">
                                      <p className="font-bold text-foreground text-sm tracking-tight leading-tight">
                                        {ct.nome}
                                      </p>
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-1">
                                      <p className="font-mono">Código: {ct.codigo}</p>
                                      <p>CNPJ: {ct.cnpj || "(não informado)"}</p>
                                      {ct.produto && <p>Produtos: {ct.produto}</p>}
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                      <Badge variant="secondary" className="text-[10px] py-0 px-2 font-medium">
                                        {numObras} {numObras === 1 ? "obra" : "obras"}
                                      </Badge>
                                      <Badge variant="secondary" className="text-[10px] py-0 px-2 font-medium">
                                        {numContatos} {numContatos === 1 ? "contato" : "contatos"}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-border/50">
                            <span className="text-xs text-muted-foreground">
                              Clique no card acima para escolher qual construtora será a <strong>Principal</strong> (a que será mantida).
                            </span>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => ignoreCtGroup(group)}
                                variant="outline"
                                size="sm"
                              >
                                Não são duplicadas
                              </Button>
                              <Button
                                onClick={() => handleCtPreMerge(groupIdx, group)}
                                disabled={merging}
                                size="sm"
                                className="shadow-sm"
                              >
                                <GitMerge className="h-4 w-4 mr-1.5" />
                                Mesclar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ============ TABA CONTATOS ============ */}
          <TabsContent value="contatos" className="space-y-6">
            {duplicatePessoas.length === 0 ? (
              <Card className="border-dashed py-12 flex flex-col items-center justify-center text-center">
                <CardHeader>
                  <CardTitle className="text-lg">Tudo limpo!</CardTitle>
                  <CardDescription>
                    Nenhum contato duplicado encontrado por e-mail ou nome + telefone idênticos.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-accent/20 p-3 rounded-lg border border-accent">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span>
                    Foram identificados <strong>{duplicatePessoas.length} grupos</strong> de contatos repetidos.
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {duplicatePessoas.map((group, groupIdx) => {
                    const selectedId = selectedPrincipalsPes[groupIdx];

                    return (
                      <Card
                        key={groupIdx}
                        className="overflow-hidden border border-border shadow-sm hover:shadow transition-all duration-300"
                      >
                        <CardHeader className="bg-muted/30 border-b border-border/50 py-3 px-4">
                          <CardTitle className="text-sm font-semibold flex items-center justify-between">
                            <span>Grupo de Duplicidade Contato #{groupIdx + 1}</span>
                            <Badge variant="outline" className="text-xs">
                              {group.length} duplicados encontrados
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {group.map((pesItem) => {
                              const isPrincipal = selectedId === pesItem.codigoPessoa;
                              const ctName = construtoras.find((c) => c.codigo === pesItem.codigoConstrutora)?.nome;
                              const obraName = obras.find((o) => o.codigoObra === pesItem.codigoObraAtual)?.nome;

                              return (
                                <div
                                  key={pesItem.codigoPessoa}
                                  onClick={() =>
                                    setSelectedPrincipalsPes((prev) => ({
                                      ...prev,
                                      [groupIdx]: pesItem.codigoPessoa || "",
                                    }))
                                  }
                                  className={`relative border rounded-xl p-4 cursor-pointer transition-all duration-300 ${
                                    isPrincipal
                                      ? "border-primary bg-primary/5 shadow-inner ring-1 ring-primary"
                                      : "border-border hover:border-muted-foreground/30 bg-card"
                                  }`}
                                >
                                  {isPrincipal && (
                                    <div className="absolute top-3 right-3 bg-primary text-primary-foreground rounded-full p-1 animate-scale-in">
                                      <Check className="h-3 w-3" />
                                    </div>
                                  )}
                                  <div className="space-y-2 text-sm">
                                    <div className="pr-6">
                                      <p className="font-bold text-foreground text-sm tracking-tight leading-tight">
                                        {pesItem.nome}
                                      </p>
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-1">
                                      <p className="font-mono">Código: {pesItem.codigoPessoa}</p>
                                      <p>Cargo: {pesItem.cargo}</p>
                                      <p>Telefone: {pesItem.whatsapp || "(não informado)"}</p>
                                      <p>Email: {pesItem.email || "(não informado)"}</p>
                                    </div>
                                    <div className="space-y-1 pt-1 text-xs">
                                      {ctName && (
                                        <p className="text-muted-foreground truncate">
                                          <strong>Construtora:</strong> {ctName}
                                        </p>
                                      )}
                                      {obraName && (
                                        <p className="text-muted-foreground truncate">
                                          <strong>Obra:</strong> {obraName}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-border/50">
                            <span className="text-xs text-muted-foreground">
                              Escolha o contato <strong>Principal</strong> (que guardará as informações corretas e os vínculos).
                            </span>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => ignorePesGroup(group)}
                                variant="outline"
                                size="sm"
                              >
                                Não são duplicados
                              </Button>
                              <Button
                                onClick={() => handlePesPreMerge(groupIdx, group)}
                                disabled={merging}
                                size="sm"
                                className="shadow-sm"
                              >
                                <GitMerge className="h-4 w-4 mr-1.5" />
                                Mesclar Contatos
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* ============ ALERT DIALOG CONSTRUTORAS ============ */}
      {confirmCtMerge && (
        <AlertDialog open={!!confirmCtMerge} onOpenChange={(o) => !o && setConfirmCtMerge(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Confirmar mesclagem de Construtoras?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3 pt-2">
                <p>
                  Você escolheu manter <strong>"{confirmCtMerge.principal.nome}"</strong> ({confirmCtMerge.principal.codigo}) como o registro principal.
                </p>
                <div className="bg-muted p-3 rounded-lg text-xs space-y-1 text-foreground">
                  <p>As seguintes construtoras serão mescladas e <strong>excluídas</strong>:</p>
                  <ul className="list-disc list-inside pl-1 text-muted-foreground font-medium">
                    {confirmCtMerge.duplicates.map((d) => (
                      <li key={d.codigo}>
                        {d.nome} ({d.codigo})
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg text-xs text-primary font-medium">
                  Este procedimento irá migrar automaticamente:
                  <ul className="list-disc list-inside mt-1">
                    <li>{confirmCtMerge.totalObras} {confirmCtMerge.totalObras === 1 ? "obra" : "obras"}</li>
                    <li>{confirmCtMerge.totalContatos} {confirmCtMerge.totalContatos === 1 ? "contato" : "contatos"}</li>
                  </ul>
                </div>
                <p className="text-xs text-destructive font-semibold">
                  A reatribuição de obras e contatos ocorre primeiro. Os registros duplicados só serão excluídos se todas as transferências forem concluídas com sucesso. Esta ação não poderá ser desfeita.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={merging}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={merging}
                onClick={(e) => {
                  e.preventDefault();
                  mergeConstrutoras(
                    confirmCtMerge.groupIndex,
                    confirmCtMerge.principal,
                    confirmCtMerge.duplicates
                  );
                }}
                className="bg-primary hover:bg-primary/95 text-primary-foreground"
              >
                {merging ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Mesclando...
                  </>
                ) : (
                  "Confirmar Mesclagem"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* ============ ALERT DIALOG PESSOAS ============ */}
      {confirmPesMerge && (
        <AlertDialog open={!!confirmPesMerge} onOpenChange={(o) => !o && setConfirmPesMerge(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Confirmar mesclagem de Contatos?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3 pt-2">
                <p>
                  Você escolheu manter <strong>"{confirmPesMerge.principal.nome}"</strong> ({confirmPesMerge.principal.codigoPessoa}) como o contato principal.
                </p>
                <div className="bg-muted p-3 rounded-lg text-xs space-y-1 text-foreground">
                  <p>Os seguintes contatos duplicados serão <strong>excluídos</strong>:</p>
                  <ul className="list-disc list-inside pl-1 text-muted-foreground font-medium">
                    {confirmPesMerge.duplicates.map((d) => (
                      <li key={d.codigoPessoa}>
                        {d.nome} ({d.codigoPessoa})
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-primary font-medium">
                  Os vínculos de construtoras e obras que existirem nos contatos deletados serão unificados no contato principal. Esta ação não poderá ser desfeita.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={merging}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={merging}
                onClick={(e) => {
                  e.preventDefault();
                  mergePessoas(
                    confirmPesMerge.groupIndex,
                    confirmPesMerge.principal,
                    confirmPesMerge.duplicates
                  );
                }}
                className="bg-primary hover:bg-primary/95 text-primary-foreground"
              >
                {merging ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Mesclando...
                  </>
                ) : (
                  "Confirmar Mesclagem"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
