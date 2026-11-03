export function Limitations() {
  return (
    <aside className="limitations">
      <h2>Cobertura e limitações</h2>
      <ul>
        <li>Os preços do simulador são de demonstração. Eles não são tarifas ao vivo.</li>
        <li>A busca aceita aeroportos comerciais do mundo inteiro. O mapa mostra só os aeroportos escolhidos.</li>
        <li>Cada monitoramento consulta de novo a cada 12 horas. Promoções mais curtas podem passar sem alerta.</li>
        <li>Quando a rodada não cobre todas as combinações, o menor preço vale só entre as opções consultadas.</li>
        <li>Bagagem desconhecida aparece como “não informado” e nunca como incluída.</li>
        <li>A tabela de rotas mostra a tarifa. Transfer, hospedagem e taxas não entram nessa conta.</li>
        <li>Filtros diferentes não entram no mesmo histórico. Sem amostra suficiente, a leitura é “Histórico insuficiente.”</li>
        <li>A Abud Flights não emite passagem, não cobra pagamento e não altera reserva. O botão abre o Google Voos com a rota e as datas. O preço nesta tela continua de demonstração enquanto a fonte for o simulador.</li>
      </ul>
    </aside>
  );
}
