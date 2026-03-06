import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { type NerisValueOption } from "./nerisMetadata";

function normalizeNerisEnumValue(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, "_").replace(/\//g, "_").toUpperCase();
  if (!cleaned) {
    return "";
  }
  return cleaned.replace(/[^A-Z0-9_|]/g, "");
}

interface NerisFlatMultiOptionSelectProps {
  inputId: string;
  value: string;
  options: NerisValueOption[];
  onChange: (nextValue: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  maxSelections?: number;
  usePortal?: boolean;
  disabled?: boolean;
  isOptionDisabled?: (optionValue: string) => boolean;
}

export function NerisFlatMultiOptionSelect({
  inputId,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  maxSelections,
  usePortal = false,
  disabled = false,
  isOptionDisabled,
}: NerisFlatMultiOptionSelectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  const selectedValues = Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => normalizeNerisEnumValue(entry)),
    ),
  );
  const selectedValueSet = new Set<string>(selectedValues);
  const selectionLimitReached =
    typeof maxSelections === "number" &&
    maxSelections > 0 &&
    selectedValueSet.size >= maxSelections;
  const selectedOptions = selectedValues
    .map((selectedValue) => options.find((option) => option.value === selectedValue))
    .filter((option): option is NerisValueOption => Boolean(option));
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredOptions = normalizedSearch
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(normalizedSearch) ||
          option.value.toLowerCase().includes(normalizedSearch),
      )
    : options;

  useLayoutEffect(() => {
    if (!isOpen || !usePortal || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const maxPanelHeight = Math.min(480, Math.max(320, spaceBelow));
    const minPanelHeight = 280;
    setPanelStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 280),
      minHeight: `${Math.min(minPanelHeight, maxPanelHeight)}px`,
      maxHeight: `${maxPanelHeight}px`,
      display: "flex",
      flexDirection: "column",
      zIndex: 100000,
    });
  }, [isOpen, usePortal]);

  useEffect(() => {
    if (!isOpen || disabled) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inPanel = panelRef.current?.contains(target);
      if (!inContainer && !inPanel) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, disabled]);

  useEffect(() => {
    if (!isOpen || disabled) {
      return;
    }
    searchInputRef.current?.focus();
  }, [isOpen, disabled]);

  return (
    <div className="neris-incident-type-select" ref={containerRef}>
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        className={`neris-incident-type-select-trigger${disabled ? " disabled" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }
          setIsOpen((previous) => !previous);
          if (isOpen) {
            setSearchTerm("");
          }
        }}
      >
        <div className="neris-selected-pill-row">
          {selectedOptions.length ? (
            selectedOptions.map((selected) => (
              <span key={`${inputId}-${selected.value}`} className="neris-selected-pill">
                {selected.label}
              </span>
            ))
          ) : (
            <span
              className={
                placeholder && placeholder.length > 0 ? "neris-incident-type-placeholder" : undefined
              }
            >
              {placeholder ?? "Select one or more options"}
            </span>
          )}
        </div>
        <ChevronDown
          size={15}
          className={`neris-incident-type-trigger-icon${isOpen ? " open" : ""}`}
        />
      </button>

      {isOpen && !disabled ? (
        usePortal ? (
          createPortal(
            <div
              ref={panelRef}
              className="neris-incident-type-select-panel neris-incident-type-select-panel-portal"
              style={panelStyle}
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="neris-incident-type-search-row">
                <Search size={14} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  placeholder={searchPlaceholder ?? "Search options..."}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                {searchTerm ? (
                  <button
                    type="button"
                    className="neris-incident-type-search-clear"
                    onClick={() => setSearchTerm("")}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              {typeof maxSelections === "number" ? (
                <p
                  className={`neris-incident-type-selection-limit${
                    selectionLimitReached ? " reached" : ""
                  }`}
                >
                  Selected {selectedValueSet.size} of {maxSelections} allowed.
                </p>
              ) : null}
              <div
                className="neris-incident-type-options-scroll"
                role="listbox"
                onWheel={(e) => e.stopPropagation()}
              >
                {filteredOptions.length ? (
                  <div className="neris-incident-type-item-list">
                    {filteredOptions.map((option) => {
                      const isSelected = selectedValueSet.has(option.value);
                      const optionDisabled = Boolean(isOptionDisabled?.(option.value));
                      const isDisabled = (selectionLimitReached && !isSelected) || optionDisabled;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`neris-incident-type-item${isSelected ? " selected" : ""}${
                            isDisabled ? " disabled" : ""
                          }`}
                          aria-selected={isSelected}
                          disabled={isDisabled}
                          onClick={() => {
                            if (isDisabled) return;
                            const nextSelected = new Set(selectedValueSet);
                            if (nextSelected.has(option.value)) {
                              nextSelected.delete(option.value);
                            } else {
                              nextSelected.add(option.value);
                            }
                            const nextOrderedValues = options
                              .map((entry) => entry.value)
                              .filter((entryValue) => nextSelected.has(entryValue));
                            onChange(nextOrderedValues.join(","));
                          }}
                        >
                          <span className="neris-incident-type-item-checkbox">
                            <input type="checkbox" tabIndex={-1} readOnly checked={isSelected} />
                          </span>
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="neris-incident-type-empty">No options match your search.</p>
                )}
              </div>
            </div>,
            document.body,
          )
        ) : (
          <div className="neris-incident-type-select-panel">
            <div className="neris-incident-type-search-row">
              <Search size={14} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                placeholder={searchPlaceholder ?? "Search options..."}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              {searchTerm ? (
                <button
                  type="button"
                  className="neris-incident-type-search-clear"
                  onClick={() => setSearchTerm("")}
                >
                  Clear
                </button>
              ) : null}
            </div>
            {typeof maxSelections === "number" ? (
              <p
                className={`neris-incident-type-selection-limit${
                  selectionLimitReached ? " reached" : ""
                }`}
              >
                Selected {selectedValueSet.size} of {maxSelections} allowed.
              </p>
            ) : null}
            <div
              className="neris-incident-type-options-scroll"
              role="listbox"
              onWheel={(e) => e.stopPropagation()}
            >
              {filteredOptions.length ? (
                <div className="neris-incident-type-item-list">
                  {filteredOptions.map((option) => {
                    const isSelected = selectedValueSet.has(option.value);
                    const optionDisabled = Boolean(isOptionDisabled?.(option.value));
                    const isDisabled = (selectionLimitReached && !isSelected) || optionDisabled;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`neris-incident-type-item${isSelected ? " selected" : ""}${
                          isDisabled ? " disabled" : ""
                        }`}
                        aria-selected={isSelected}
                        disabled={isDisabled}
                        onClick={() => {
                          if (isDisabled) return;
                          const nextSelected = new Set(selectedValueSet);
                          if (nextSelected.has(option.value)) {
                            nextSelected.delete(option.value);
                          } else {
                            nextSelected.add(option.value);
                          }
                          const nextOrderedValues = options
                            .map((entry) => entry.value)
                            .filter((entryValue) => nextSelected.has(entryValue));
                          onChange(nextOrderedValues.join(","));
                        }}
                      >
                        <span className="neris-incident-type-item-checkbox">
                          <input type="checkbox" tabIndex={-1} readOnly checked={isSelected} />
                        </span>
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="neris-incident-type-empty">No options match your search.</p>
              )}
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

interface NerisFlatSingleOptionSelectProps {
  inputId: string;
  value: string;
  options: NerisValueOption[];
  onChange: (nextValue: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  usePortal?: boolean;
  disabled?: boolean;
  isOptionDisabled?: (optionValue: string) => boolean;
  allowClear?: boolean;
}

export function NerisFlatSingleOptionSelect({
  inputId,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  usePortal = false,
  disabled = false,
  isOptionDisabled,
  allowClear = false,
}: NerisFlatSingleOptionSelectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  const normalizedValue = normalizeNerisEnumValue(value);
  const selectedOption = options.find((option) => option.value === normalizedValue);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredOptions = normalizedSearch
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(normalizedSearch) ||
          option.value.toLowerCase().includes(normalizedSearch),
      )
    : options;

  useLayoutEffect(() => {
    if (!isOpen || !usePortal || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const maxPanelHeight = Math.min(480, Math.max(280, spaceBelow));
    setPanelStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: `${maxPanelHeight}px`,
      zIndex: 100000,
    });
  }, [isOpen, usePortal]);

  useEffect(() => {
    if (!isOpen || disabled) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inPanel = panelRef.current?.contains(target);
      if (!inContainer && !inPanel) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, disabled]);

  useEffect(() => {
    if (!isOpen || disabled) {
      return;
    }
    searchInputRef.current?.focus();
  }, [isOpen, disabled]);

  return (
    <div className="neris-incident-type-select" ref={containerRef}>
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        className={`neris-incident-type-select-trigger${disabled ? " disabled" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }
          setIsOpen((previous) => !previous);
          if (isOpen) {
            setSearchTerm("");
          }
        }}
      >
        <div className="neris-selected-pill-row">
          {selectedOption ? (
            <span className="neris-selected-pill">{selectedOption.label}</span>
          ) : (
            <span
              className={
                placeholder && placeholder.length > 0 ? "neris-incident-type-placeholder" : undefined
              }
            >
              {placeholder ?? "Select an option"}
            </span>
          )}
        </div>
        <ChevronDown
          size={15}
          className={`neris-incident-type-trigger-icon${isOpen ? " open" : ""}`}
        />
      </button>

      {isOpen && !disabled ? (
        usePortal ? (
          createPortal(
            <div
              ref={panelRef}
              className="neris-incident-type-select-panel"
              style={panelStyle}
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="neris-incident-type-search-row">
                <Search size={14} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  placeholder={searchPlaceholder ?? "Search options..."}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                {searchTerm ? (
                  <button
                    type="button"
                    className="neris-incident-type-search-clear"
                    onClick={() => setSearchTerm("")}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              {allowClear && normalizedValue ? (
                <div className="neris-single-select-clear-row">
                  <button
                    type="button"
                    className="neris-incident-type-search-clear"
                    onClick={() => {
                      onChange("");
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                  >
                    Clear selection
                  </button>
                </div>
              ) : null}
              <div
                className="neris-incident-type-options-scroll"
                role="listbox"
                onWheel={(e) => e.stopPropagation()}
              >
                {filteredOptions.length ? (
                  <div className="neris-incident-type-item-list">
                    {filteredOptions.map((option) => {
                      const isSelected = option.value === normalizedValue;
                      const optionDisabled = Boolean(isOptionDisabled?.(option.value));
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`neris-incident-type-item${isSelected ? " selected" : ""}${
                            optionDisabled ? " disabled" : ""
                          }`}
                          aria-selected={isSelected}
                          aria-disabled={optionDisabled}
                          onClick={() => {
                            if (optionDisabled) return;
                            onChange(option.value);
                            setIsOpen(false);
                            setSearchTerm("");
                          }}
                        >
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="neris-incident-type-empty">No options match your search.</p>
                )}
              </div>
            </div>,
            document.body,
          )
        ) : (
          <div className="neris-incident-type-select-panel">
            <div className="neris-incident-type-search-row">
              <Search size={14} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                placeholder={searchPlaceholder ?? "Search options..."}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              {searchTerm ? (
                <button
                  type="button"
                  className="neris-incident-type-search-clear"
                  onClick={() => setSearchTerm("")}
                >
                  Clear
                </button>
              ) : null}
            </div>
            {allowClear && normalizedValue ? (
              <div className="neris-single-select-clear-row">
                <button
                  type="button"
                  className="neris-incident-type-search-clear"
                  onClick={() => {
                    onChange("");
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                >
                  Clear selection
                </button>
              </div>
            ) : null}
            <div
              className="neris-incident-type-options-scroll"
              role="listbox"
              onWheel={(e) => e.stopPropagation()}
            >
              {filteredOptions.length ? (
                <div className="neris-incident-type-item-list">
                  {filteredOptions.map((option) => {
                    const isSelected = option.value === normalizedValue;
                    const optionDisabled = Boolean(isOptionDisabled?.(option.value));
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`neris-incident-type-item${isSelected ? " selected" : ""}${
                          optionDisabled ? " disabled" : ""
                        }`}
                        aria-selected={isSelected}
                        aria-disabled={optionDisabled}
                        onClick={() => {
                          if (optionDisabled) {
                            return;
                          }
                          onChange(option.value);
                          setIsOpen(false);
                          setSearchTerm("");
                        }}
                      >
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="neris-incident-type-empty">No options match your search.</p>
              )}
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
