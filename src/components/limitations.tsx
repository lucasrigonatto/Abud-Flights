import { providerSettings } from "../providers/settings";

export function Limitations() {
  const live = providerSettings().live;
  return (
    <aside className="limitations">
      <h2>Cobertura e limitações</h2>
      <ul>
        <li>
          {live
            ? "Preços consultados via SerpApi. A integração inicial aceita 1 adulto, sem crianças, e não confirma bagagem despachada."
            : "Os preços do simulador são de demonstração. Eles não são tarifas ao vivo."}
        </li>
        {live ? (
          <li>
            O plano Free é verificado antes de cada consulta. Cada rodada
            analisa uma combinação e, em ida e volta, seleciona uma saída para
            consultar os retornos. A cota é compartilhada por todos os usos da
            chave.
          </li>
        ) : null}
        <li>
          A busca aceita aeroportos comerciais do mundo inteiro. O mapa mostra
          só os aeroportos escolhidos.
        </li>
        <li>
          Cada monitoramento consulta de novo a cada 12 horas. Promoções mais
          curtas podem passar sem alerta.
        </li>
        <li>
          Quando a rodada não cobre todas as combinações, o menor preço vale só
          entre as opções consultadas.
        </li>
        <li>
          Bagagem desconhecida aparece como “não informado” e nunca como
          incluída.
        </li>
        <li>
          A tabela de rotas mostra a tarifa. Transfer, hospedagem e taxas não
          entram nessa conta.
        </li>
        <li>
          Filtros diferentes não entram no mesmo histórico. Sem amostra
          suficiente, a leitura é “Histórico insuficiente.”
        </li>
        <li>
          A Abud Flights não emite passagem, não cobra pagamento e não altera
          reserva. O botão abre o Google Voos. Confira o preço e a
          disponibilidade antes de comprar. Dados antigos do simulador continuam
          identificados como demonstração.
        </li>
      </ul>
    </aside>
  );
}
