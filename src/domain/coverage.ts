export type RunStatus = "PENDING" | "SUCCESS" | "FAILED" | "PARTIAL" | "NO_OFFERS";

export function isTerminalStatus(status: RunStatus): boolean {
  return status === "SUCCESS" || status === "PARTIAL" || status === "NO_OFFERS";
}

export function coverageMessage(input: {
  status: RunStatus;
  combinationsPlanned: number;
  combinationsQueried: number;
  hadProviderFailure?: boolean;
  stoppedByBudget?: boolean;
  datesPassed?: boolean;
}): string {
  if (input.datesPassed) {
    return "As datas de ida já passaram. O monitoramento foi encerrado.";
  }
  if (input.status === "FAILED") {
    return "A consulta falhou. Isso não significa que não há voos.";
  }
  if (input.status === "NO_OFFERS") {
    return "Nenhuma oferta encontrada nesta consulta.";
  }
  if (input.status === "PARTIAL") {
    const parts = [
      "Menor preço entre as opções consultadas.",
      "Parte das combinações ficou sem consulta.",
      `(${input.combinationsQueried} de ${input.combinationsPlanned} combinações nesta rodada.)`,
    ];
    if (input.hadProviderFailure) {
      parts.push("Houve falha em parte das consultas. Falha não significa ausência de voos.");
    }
    if (input.stoppedByBudget) {
      parts.push("A cobertura foi reduzida: o teto diário do fornecedor foi atingido.");
    }
    return parts.join(" ");
  }
  if (input.status === "PENDING") return "Consulta em andamento.";
  return "Todas as combinações previstas nesta rodada foram consultadas.";
}
