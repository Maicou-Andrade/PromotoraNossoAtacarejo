import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ChevronDown, X } from "lucide-react";

interface AutocompleteOption {
  label: string;
  value: string | number;
}

interface AutocompleteProps {
  options: AutocompleteOption[];
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
}

export default function Autocomplete({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  disabled = false,
  className = "",
  error = false,
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex items-center border rounded-md bg-background transition-colors ${
          error ? "border-red-500 ring-1 ring-red-500" : "border-input"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${
          isOpen ? "ring-2 ring-ring" : ""
        }`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        {isOpen ? (
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9"
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length > 0) {
                e.preventDefault();
                onChange(filtered[0].value);
                setIsOpen(false);
                setSearch("");
              }
              if (e.key === "Escape") {
                setIsOpen(false);
                setSearch("");
              }
            }}
          />
        ) : (
          <span
            className={`flex-1 px-3 py-2 text-sm truncate ${
              selectedOption ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        )}
        <div className="flex items-center pr-2 gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                setSearch("");
              }}
              className="p-0.5 rounded hover:bg-muted"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Nenhum resultado encontrado
            </div>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors ${
                  option.value === value
                    ? "bg-primary/10 text-primary font-medium"
                    : ""
                }`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                  setSearch("");
                }}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
