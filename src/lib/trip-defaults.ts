import { shiftDate } from "../domain/dates";
import { minorToInput } from "../domain/money";

export type TripDefaults = {
  origin: string;
  originAlt1: string;
  originAlt2: string;
  destination: string;
  destinationAlt1: string;
  destinationAlt2: string;
  departDate: string;
  returnDate: string;
  flexDays: number;
  adults: number;
  childAges: string;
  cabin: string;
  bags: string;
  currency: string;
  market: string;
  maxStops: number;
  maxDurationHours: number;
  name: string;
  monitorUntil: string;
  targetAmount: string;
  budgetScope: string;
  percentDrop: string;
  minSavings: string;
  newLow: boolean;
  extraBagAmount: string;
  groundCosts: Record<string, { transfer: string; lodging: string; fees: string; minutes: string }>;
  monitorId?: string;
};

export function blankTrip(input: { currency: string; market: string; today: string }): TripDefaults {
  return {
    origin: "GYN",
    originAlt1: "",
    originAlt2: "",
    destination: "LIS",
    destinationAlt1: "",
    destinationAlt2: "",
    departDate: shiftDate(input.today, 40),
    returnDate: shiftDate(input.today, 52),
    flexDays: 0,
    adults: 1,
    childAges: "",
    cabin: "ECONOMY",
    bags: "1",
    currency: input.currency || "BRL",
    market: input.market || "BR",
    maxStops: 1,
    maxDurationHours: 20,
    name: "GYN → LIS",
    monitorUntil: shiftDate(input.today, 90),
    targetAmount: "8000,00",
    budgetScope: "TOTAL",
    percentDrop: "",
    minSavings: "",
    newLow: true,
    extraBagAmount: "",
    groundCosts: {},
  };
}

export function moneyInput(amountMinor: number, currency: string): string {
  return minorToInput(amountMinor, currency);
}
