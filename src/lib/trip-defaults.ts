import { shiftDate } from "../domain/dates";
import { minorToInput } from "../domain/money";
import type { TripType } from "../domain/provider";

export type TripDefaults = {
  tripType: TripType;
  origin: string;
  originAlts: string[];
  destination: string;
  destinationAlts: string[];
  departDate: string;
  returnDate: string;
  flexDays: number;
  adults: number;
  hasChildren: boolean;
  cabin: string;
  bags: string;
  currency: string;
  market: string;
  maxStops: number | null;
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
    tripType: "ROUND_TRIP",
    origin: "",
    originAlts: [],
    destination: "",
    destinationAlts: [],
    departDate: shiftDate(input.today, 40),
    returnDate: shiftDate(input.today, 52),
    flexDays: 0,
    adults: 1,
    hasChildren: false,
    cabin: "ECONOMY",
    bags: "1",
    currency: input.currency || "BRL",
    market: input.market || "BR",
    maxStops: null,
    name: "",
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
