"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { airportByCode, searchAirports, type AirportRecord } from "../lib/airports";

export function AirportField({
  name,
  value,
  onChange,
  required = false,
  placeholder = "Cidade ou código",
}: {
  name: string;
  value: string;
  onChange: (iata: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const listId = useId();
  const selected = airportByCode(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const matches = useMemo(() => (open ? searchAirports(query, 8) : []), [open, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function pick(airport: AirportRecord) {
    onChange(airport.iata);
    setQuery("");
    setOpen(false);
  }

  function commit(raw: string) {
    const code = raw.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
    const exact = code.length === 3 ? airportByCode(code) : null;
    if (exact) onChange(exact.iata);
    setOpen(false);
  }

  const shown = open ? query : selected ? `${selected.city} (${selected.iata})` : "";

  return (
    <div className="airport-field">
      <input type="hidden" name={name} value={value} />
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        required={required && !value}
        placeholder={placeholder}
        value={shown}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onBlur={() => {
          window.setTimeout(() => commit(query), 120);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (!event.target.value.trim()) onChange("");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && open && matches[active]) {
            event.preventDefault();
            pick(matches[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && matches.length > 0 ? (
        <ul id={listId} role="listbox" className="airport-menu">
          {matches.map((airport, index) => (
            <li key={airport.iata}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                className={index === active ? "is-active" : undefined}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(airport);
                }}
              >
                <strong>{airport.iata}</strong>
                <span>
                  {airport.city}, {airport.country}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim().length >= 2 && matches.length === 0 ? <p className="airport-empty">Nenhum aeroporto comercial com esse nome ou código.</p> : null}
    </div>
  );
}
