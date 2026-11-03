# Abud Flights

Primeira versão do monitor de passagens. A interface está em português. O único fornecedor é um simulador: todo preço gravado e mostrado é um preço de demonstração, distinto de uma tarifa ao vivo.

A busca é global: qualquer aeroporto comercial na origem e no destino, ida e volta ou somente ida, datas fixas ou flexibilidade de ±1, ±3 ou ±5 dias, e até cinco aeroportos alternativos de cada lado, escolhidos manualmente. O monitoramento roda a cada 12 horas num processo worker separado. O estado fica no PostgreSQL, então fechar o navegador ou reiniciar o servidor não apaga os monitoramentos.

## Rodar com Docker Compose

```bash
docker compose up --build
```

Abra http://localhost:3000 e crie uma conta. O Compose sobe três serviços:

- `postgres` — banco
- `web` — Next.js na porta 3000, aplica as migrations e carrega os aeroportos
- `worker` — processo separado que busca monitoramentos vencidos e executa a rodada

Os dados permanecem no volume `abud_pg`. `docker compose restart` não apaga monitoramentos.

A senha do Postgres no Compose (`abud` / `abud`) é só para uso local.

## O que esta versão faz

- Conta com isolamento: cada pessoa vê só os próprios monitoramentos, buscas e alertas.
- Histórico append-only. Repetir a mesma rodada não duplica observação nem alerta.
- Falha do fornecedor fica registrada como falha, não como ausência de voos.
- Busca parcial diz que parte das combinações ficou sem consulta e que o menor preço é só entre as opções consultadas.
- Bagagem desconhecida aparece como “não informado”.
- A moeda e o valor originais da oferta são preservados.
- O preço de dois passageiros é o total da oferta para dois passageiros.
- Alertas de preço-alvo, queda percentual, novo menor preço, economia líquida em aeroporto alternativo, horário de silêncio e resumo diário. No site e na caixa de saída. Sem servidor de e-mail, a cópia fica registrada e não é enviada.
- Painel de consumo com chamadas, cache, falhas, repetições e custo de demonstração.
- Mapa da rota com OpenStreetMap. Começa vazio e desenha só a origem, o destino e as alternativas escolhidas. A conexão aparece quando a oferta selecionada tem escala.
- Amostra pequena mostra “Histórico insuficiente.”
- O simulador não tem URL da companhia. O encaminhamento fica marcado como link de demonstração e não abre uma página de compra.

## Fora desta versão

Emissão de passagem, pagamento, alteração de reserva, provedor real, inteligência artificial e recomendações do tipo “comprar agora ou esperar”.
