export type AirportRecord = {
  iata: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export const AIRPORTS: AirportRecord[] = [
  { iata: "GYN", name: "Santa Genoveva", city: "Goiânia", country: "Brasil", latitude: -16.632, longitude: -49.2206, timezone: "America/Sao_Paulo" },
  { iata: "BSB", name: "Presidente Juscelino Kubitschek", city: "Brasília", country: "Brasil", latitude: -15.8697, longitude: -47.9172, timezone: "America/Sao_Paulo" },
  { iata: "GRU", name: "Guarulhos", city: "São Paulo", country: "Brasil", latitude: -23.4356, longitude: -46.4731, timezone: "America/Sao_Paulo" },
  { iata: "CGH", name: "Congonhas", city: "São Paulo", country: "Brasil", latitude: -23.6261, longitude: -46.6564, timezone: "America/Sao_Paulo" },
  { iata: "VCP", name: "Viracopos", city: "Campinas", country: "Brasil", latitude: -23.0074, longitude: -47.1345, timezone: "America/Sao_Paulo" },
  { iata: "GIG", name: "Galeão", city: "Rio de Janeiro", country: "Brasil", latitude: -22.809, longitude: -43.2506, timezone: "America/Sao_Paulo" },
  { iata: "SDU", name: "Santos Dumont", city: "Rio de Janeiro", country: "Brasil", latitude: -22.9105, longitude: -43.1631, timezone: "America/Sao_Paulo" },
  { iata: "CNF", name: "Confins", city: "Belo Horizonte", country: "Brasil", latitude: -19.6244, longitude: -43.9719, timezone: "America/Sao_Paulo" },
  { iata: "SSA", name: "Deputado Luís Eduardo Magalhães", city: "Salvador", country: "Brasil", latitude: -12.9086, longitude: -38.3225, timezone: "America/Bahia" },
  { iata: "REC", name: "Guararapes", city: "Recife", country: "Brasil", latitude: -8.1265, longitude: -34.9236, timezone: "America/Recife" },
  { iata: "FOR", name: "Pinto Martins", city: "Fortaleza", country: "Brasil", latitude: -3.7763, longitude: -38.5326, timezone: "America/Fortaleza" },
  { iata: "BEL", name: "Val-de-Cans", city: "Belém", country: "Brasil", latitude: -1.3792, longitude: -48.4763, timezone: "America/Belem" },
  { iata: "MAO", name: "Eduardo Gomes", city: "Manaus", country: "Brasil", latitude: -3.0386, longitude: -60.0497, timezone: "America/Manaus" },
  { iata: "POA", name: "Salgado Filho", city: "Porto Alegre", country: "Brasil", latitude: -29.9944, longitude: -51.1714, timezone: "America/Sao_Paulo" },
  { iata: "CWB", name: "Afonso Pena", city: "Curitiba", country: "Brasil", latitude: -25.5285, longitude: -49.1758, timezone: "America/Sao_Paulo" },
  { iata: "FLN", name: "Hercílio Luz", city: "Florianópolis", country: "Brasil", latitude: -27.6703, longitude: -48.5525, timezone: "America/Sao_Paulo" },
  { iata: "NAT", name: "Aluízio Alves", city: "Natal", country: "Brasil", latitude: -5.9111, longitude: -35.2478, timezone: "America/Fortaleza" },
  { iata: "CGB", name: "Marechal Rondon", city: "Cuiabá", country: "Brasil", latitude: -15.6529, longitude: -56.1168, timezone: "America/Cuiaba" },
  { iata: "IGU", name: "Cataratas", city: "Foz do Iguaçu", country: "Brasil", latitude: -25.6003, longitude: -54.485, timezone: "America/Sao_Paulo" },
  { iata: "BPS", name: "Porto Seguro", city: "Porto Seguro", country: "Brasil", latitude: -16.4386, longitude: -39.0809, timezone: "America/Bahia" },
  { iata: "LIS", name: "Humberto Delgado", city: "Lisboa", country: "Portugal", latitude: 38.7742, longitude: -9.1342, timezone: "Europe/Lisbon" },
  { iata: "OPO", name: "Francisco Sá Carneiro", city: "Porto", country: "Portugal", latitude: 41.2481, longitude: -8.6814, timezone: "Europe/Lisbon" },
  { iata: "FAO", name: "Faro", city: "Faro", country: "Portugal", latitude: 37.0144, longitude: -7.9659, timezone: "Europe/Lisbon" },
  { iata: "MAD", name: "Adolfo Suárez Madrid-Barajas", city: "Madrid", country: "Espanha", latitude: 40.4983, longitude: -3.5676, timezone: "Europe/Madrid" },
  { iata: "BCN", name: "El Prat", city: "Barcelona", country: "Espanha", latitude: 41.2971, longitude: 2.0785, timezone: "Europe/Madrid" },
  { iata: "CDG", name: "Charles de Gaulle", city: "Paris", country: "França", latitude: 49.0097, longitude: 2.5479, timezone: "Europe/Paris" },
  { iata: "ORY", name: "Orly", city: "Paris", country: "França", latitude: 48.7233, longitude: 2.3794, timezone: "Europe/Paris" },
  { iata: "FCO", name: "Fiumicino", city: "Roma", country: "Itália", latitude: 41.8003, longitude: 12.2389, timezone: "Europe/Rome" },
  { iata: "MXP", name: "Malpensa", city: "Milão", country: "Itália", latitude: 45.6306, longitude: 8.7281, timezone: "Europe/Rome" },
  { iata: "LHR", name: "Heathrow", city: "Londres", country: "Reino Unido", latitude: 51.47, longitude: -0.4543, timezone: "Europe/London" },
  { iata: "LGW", name: "Gatwick", city: "Londres", country: "Reino Unido", latitude: 51.1537, longitude: -0.1821, timezone: "Europe/London" },
  { iata: "AMS", name: "Schiphol", city: "Amsterdã", country: "Países Baixos", latitude: 52.3105, longitude: 4.7683, timezone: "Europe/Amsterdam" },
  { iata: "FRA", name: "Frankfurt", city: "Frankfurt", country: "Alemanha", latitude: 50.0379, longitude: 8.5622, timezone: "Europe/Berlin" },
  { iata: "MUC", name: "Munique", city: "Munique", country: "Alemanha", latitude: 48.3538, longitude: 11.7861, timezone: "Europe/Berlin" },
  { iata: "EZE", name: "Ezeiza", city: "Buenos Aires", country: "Argentina", latitude: -34.8222, longitude: -58.5358, timezone: "America/Argentina/Buenos_Aires" },
  { iata: "SCL", name: "Arturo Merino Benítez", city: "Santiago", country: "Chile", latitude: -33.393, longitude: -70.7858, timezone: "America/Santiago" },
  { iata: "BOG", name: "El Dorado", city: "Bogotá", country: "Colômbia", latitude: 4.7016, longitude: -74.1469, timezone: "America/Bogota" },
  { iata: "MIA", name: "Miami", city: "Miami", country: "Estados Unidos", latitude: 25.7959, longitude: -80.287, timezone: "America/New_York" },
  { iata: "JFK", name: "John F. Kennedy", city: "Nova York", country: "Estados Unidos", latitude: 40.6413, longitude: -73.7781, timezone: "America/New_York" },
];

export function airportLabel(airport: Pick<AirportRecord, "iata" | "city" | "name">): string {
  return `${airport.iata} — ${airport.city}, ${airport.name}`;
}
