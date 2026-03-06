import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { type NerisValueOption } from "./nerisMetadata";

type NerisGroupedOptionVariant = "incidentType" | "actionTactic" | "entityByState";

const INCIDENT_TYPE_CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  HAZSIT: "HazMat",
  NOEMERG: "No Emergency",
  LAWENFORCE: "Law Enforcement",
  PUBSERV: "Public Service",
};

const US_STATE_CODE_TO_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

function normalizeNerisEnumValue(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, "_").replace(/\//g, "_").toUpperCase();
  if (!cleaned) {
    return "";
  }
  return cleaned.replace(/[^A-Z0-9_|]/g, "");
}

function formatNerisEnumSegment(value: string): string {
  const cleaned = value
    .replace(/[|]+/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!cleaned) {
    return "";
  }
  return cleaned.replace(/\b\w/g, (character) => character.toUpperCase());
}

function getNerisGroupedCategoryLabel(
  categoryKey: string,
  variant: NerisGroupedOptionVariant,
): string {
  if (variant === "entityByState") {
    return US_STATE_CODE_TO_NAME[categoryKey] ?? categoryKey;
  }
  if (variant === "incidentType" && INCIDENT_TYPE_CATEGORY_LABEL_OVERRIDES[categoryKey]) {
    return INCIDENT_TYPE_CATEGORY_LABEL_OVERRIDES[categoryKey];
  }
  return formatNerisEnumSegment(categoryKey);
}

function getNerisGroupedSubgroupKey(
  categoryKey: string,
  rawSubgroupKey: string | undefined,
  variant: NerisGroupedOptionVariant,
): string {
  if (variant === "entityByState") {
    return rawSubgroupKey ?? "OTHER";
  }
  if (rawSubgroupKey) {
    return rawSubgroupKey;
  }
  if (variant === "incidentType" && categoryKey === "LAWENFORCE") {
    return "LAW_ENFORCEMENT_SUPPORT";
  }
  return "OTHER";
}

function getNerisGroupedSubgroupLabel(
  categoryKey: string,
  subgroupKey: string,
  variant: NerisGroupedOptionVariant,
): string {
  if (
    variant === "incidentType" &&
    categoryKey === "LAWENFORCE" &&
    subgroupKey === "LAW_ENFORCEMENT_SUPPORT"
  ) {
    return "Law Enforcement Support";
  }
  return formatNerisEnumSegment(subgroupKey);
}

function getNerisGroupedLeafLabel(
  segments: string[],
  option: NerisValueOption,
  variant: NerisGroupedOptionVariant,
): string {
  if (variant === "entityByState") {
    return option.label;
  }
  if (segments.length > 2) {
    return segments.slice(2).map(formatNerisEnumSegment).join(" / ");
  }
  if (segments.length === 2) {
    return formatNerisEnumSegment(segments[1]);
  }
  if (variant === "incidentType" && segments[0] === "LAWENFORCE") {
    return "Law Enforcement Support";
  }
  return option.label;
}

function getNerisGroupedSelectedLabel(
  option: NerisValueOption,
  variant: NerisGroupedOptionVariant,
): string {
  if (variant === "entityByState") {
    return option.label;
  }
  const segments = option.value
    .split("||")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return option.label;
  }

  const categoryKey = segments[0] ?? "";
  const categoryLabel = getNerisGroupedCategoryLabel(categoryKey, variant);
  if (segments.length === 1) {
    if (variant === "incidentType" && categoryKey === "LAWENFORCE") {
      return "Law Enforcement Support";
    }
    return categoryLabel;
  }

  const subgroupKey = getNerisGroupedSubgroupKey(categoryKey, segments[1], variant);
  const subgroupLabel = getNerisGroupedSubgroupLabel(categoryKey, subgroupKey, variant);
  if (segments.length === 2) {
    return `${categoryLabel} / ${subgroupLabel}`;
  }

  const leafLabel = segments.slice(2).map(formatNerisEnumSegment).join(" / ");
  return `${categoryLabel} / ${subgroupLabel} / ${leafLabel}`;
}

interface NerisGroupedOptionSelectProps {
  inputId: string;
  value: string;
  options: NerisValueOption[];
  onChange: (nextValue: string) => void;
  mode: "single" | "multi";
  variant: NerisGroupedOptionVariant;
  placeholder?: string;
  searchPlaceholder?: string;
  maxSelections?: number;
  showCheckboxes?: boolean;
  disabled?: boolean;
  usePortal?: boolean;
}

export function NerisGroupedOptionSelect({
  inputId,
  value,
  options,
  onChange,
  mode,
  variant,
  placeholder,
  searchPlaceholder,
  maxSelections,
  showCheckboxes = false,
  disabled = false,
  usePortal = false,
}: NerisGroupedOptionSelectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [collapsedSubgroups, setCollapsedSubgroups] = useState<Record<string, boolean>>({});

  const normalizedSelectedValues = Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => normalizeNerisEnumValue(entry)),
    ),
  );
  const normalizedSelectedValue = normalizedSelectedValues[0] ?? "";
  const selectedValueSet = new Set<string>(normalizedSelectedValues);
  const selectedOptions = normalizedSelectedValues
    .map((selectedValue) => options.find((option) => option.value === selectedValue))
    .filter((option): option is NerisValueOption => Boolean(option));
  const selectedOption = selectedOptions[0];
  const selectedOptionLabel = selectedOption
    ? getNerisGroupedSelectedLabel(selectedOption, variant)
    : "";
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const selectionLimitReached =
    mode === "multi" &&
    typeof maxSelections === "number" &&
    selectedValueSet.size >= maxSelections;

  interface GroupedLeafOption {
    option: NerisValueOption;
    leafLabel: string;
  }

  interface GroupedOptionCategory {
    categoryKey: string;
    categoryLabel: string;
    optionCount: number;
    directOptions: GroupedLeafOption[];
    subgroups: Array<{
      subgroupKey: string;
      subgroupLabel: string;
      options: GroupedLeafOption[];
    }>;
  }

  const groupedOptions: GroupedOptionCategory[] = useMemo(() => {
    const filteredOptions = options.filter((option) => {
      if (!normalizedSearch) {
        return true;
      }
      return (
        option.label.toLowerCase().includes(normalizedSearch) ||
        option.value.toLowerCase().includes(normalizedSearch)
      );
    });
    const categoryMap = new Map<
      string,
      Map<string, Array<{ option: NerisValueOption; leafLabel: string }>>
    >();

    for (const option of filteredOptions) {
      const segments = option.value
        .split("||")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
      const categoryKey = segments[0] ?? "UNCLASSIFIED";
      const subgroupKey = getNerisGroupedSubgroupKey(categoryKey, segments[1], variant);
      const leafLabel = getNerisGroupedLeafLabel(segments, option, variant);
      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, new Map());
      }
      const subgroupMap = categoryMap.get(categoryKey);
      if (!subgroupMap) {
        continue;
      }
      if (!subgroupMap.has(subgroupKey)) {
        subgroupMap.set(subgroupKey, []);
      }
      const subgroupOptions = subgroupMap.get(subgroupKey);
      if (!subgroupOptions) {
        continue;
      }
      subgroupOptions.push({
        option,
        leafLabel,
      });
    }

    return Array.from(categoryMap.entries()).map(([categoryKey, subgroupMap]) => {
      const directOptions: GroupedLeafOption[] = [];
      const subgroups = Array.from(subgroupMap.entries()).reduce<
        Array<{
          subgroupKey: string;
          subgroupLabel: string;
          options: GroupedLeafOption[];
        }>
      >((groupAccumulator, [subgroupKey, subgroupOptions]) => {
        if (variant === "entityByState") {
          subgroupOptions.forEach((item) => directOptions.push(item));
          return groupAccumulator;
        }
        if (variant === "actionTactic" && subgroupOptions.length === 1) {
          const onlyOption = subgroupOptions[0];
          if (onlyOption) {
            directOptions.push({
              option: onlyOption.option,
              leafLabel: getNerisGroupedSubgroupLabel(categoryKey, subgroupKey, variant),
            });
          }
          return groupAccumulator;
        }
        groupAccumulator.push({
          subgroupKey,
          subgroupLabel: getNerisGroupedSubgroupLabel(categoryKey, subgroupKey, variant),
          options: subgroupOptions,
        });
        return groupAccumulator;
      }, []);

      return {
        categoryKey,
        categoryLabel: getNerisGroupedCategoryLabel(categoryKey, variant),
        optionCount: Array.from(subgroupMap.values()).reduce(
          (count, subgroupOptions) => count + subgroupOptions.length,
          0,
        ),
        directOptions,
        subgroups,
      };
    });
  }, [options, normalizedSearch, variant]);

  useLayoutEffect(() => {
    if (!isOpen || !usePortal || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const maxPanelHeight = Math.min(480, Math.max(320, spaceBelow));
    setPanelStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 280),
      minHeight: "280px",
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

  const handleToggleCategory = (categoryKey: string) => {
    const currentlyCollapsed = collapsedCategories[categoryKey] !== false;
    const nextCollapsed = !currentlyCollapsed;
    setCollapsedCategories((previous) => ({
      ...previous,
      [categoryKey]: nextCollapsed,
    }));
    if (!nextCollapsed) {
      setCollapsedSubgroups((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(
            ([collapseKey]) => !collapseKey.startsWith(`${categoryKey}::`),
          ),
        ),
      );
    }
  };

  const handleToggleSubgroup = (categoryKey: string, subgroupKey: string) => {
    const collapseKey = `${categoryKey}::${subgroupKey}`;
    setCollapsedSubgroups((previous) => ({
      ...previous,
      [collapseKey]: !previous[collapseKey],
    }));
  };

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
        {mode === "single" ? (
          <div className="neris-selected-pill-row">
            {selectedOption ? (
              <span className="neris-selected-pill">{selectedOptionLabel}</span>
            ) : (
              <span
                className={
                  selectedOptions.length === 0 && placeholder && placeholder.length > 0
                    ? "neris-incident-type-placeholder"
                    : undefined
                }
              >
                {placeholder && placeholder.length > 0 ? placeholder : "\u00A0"}
              </span>
            )}
          </div>
        ) : (
          <div className="neris-selected-pill-row">
            {selectedOptions.length ? (
              selectedOptions.map((selected) => (
                <span key={`${inputId}-${selected.value}`} className="neris-selected-pill">
                  {getNerisGroupedSelectedLabel(selected, variant)}
                </span>
              ))
            ) : (
              <span
                className={
                  placeholder && placeholder.length > 0
                    ? "neris-incident-type-placeholder"
                    : undefined
                }
              >
                {placeholder ?? "Select one or more options"}
              </span>
            )}
          </div>
        )}
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

              {mode === "multi" && typeof maxSelections === "number" ? (
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
                {groupedOptions.length ? (
                  groupedOptions.map((category) => {
                    const categoryCollapsed =
                      normalizedSearch.length === 0 &&
                      collapsedCategories[category.categoryKey] !== false;
                    return (
                      <section key={category.categoryKey} className="neris-incident-type-group">
                        <button
                          type="button"
                          className="neris-incident-type-group-button"
                          onClick={() => handleToggleCategory(category.categoryKey)}
                        >
                          {categoryCollapsed ? (
                            <ChevronRight size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                          <span>{category.categoryLabel}</span>
                          <strong>{category.optionCount}</strong>
                        </button>

                        {!categoryCollapsed ? (
                          <>
                            {category.directOptions.length ? (
                              <div className="neris-incident-type-item-list">
                                {category.directOptions.map(({ option, leafLabel }) => {
                                  const isSelected =
                                    mode === "single"
                                      ? option.value === normalizedSelectedValue
                                      : selectedValueSet.has(option.value);
                                  const isDisabled =
                                    mode === "multi" &&
                                    typeof maxSelections === "number" &&
                                    selectedValueSet.size >= maxSelections &&
                                    !isSelected;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      className={`neris-incident-type-item neris-incident-type-item-main${
                                        isSelected ? " selected" : ""
                                      }${isDisabled ? " disabled" : ""}`}
                                      aria-selected={isSelected}
                                      aria-disabled={isDisabled}
                                      onClick={() => {
                                        if (isDisabled) {
                                          return;
                                        }
                                        if (mode === "single") {
                                          onChange(option.value);
                                          setIsOpen(false);
                                          setSearchTerm("");
                                          return;
                                        }
                                        const nextSelected = new Set(selectedValueSet);
                                        if (nextSelected.has(option.value)) {
                                          nextSelected.delete(option.value);
                                        } else {
                                          nextSelected.add(option.value);
                                        }
                                        const nextOrderedValues = options
                                          .map((entry) => entry.value)
                                          .filter((entryValue) =>
                                            nextSelected.has(entryValue),
                                          );
                                        onChange(nextOrderedValues.join(","));
                                      }}
                                    >
                                      {showCheckboxes ? (
                                        <span className="neris-incident-type-item-checkbox">
                                          <input
                                            type="checkbox"
                                            tabIndex={-1}
                                            readOnly
                                            checked={isSelected}
                                          />
                                        </span>
                                      ) : null}
                                      <span>{leafLabel}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                            {category.subgroups.map((subgroup) => {
                              const subgroupCollapseKey = `${category.categoryKey}::${subgroup.subgroupKey}`;
                              const subgroupCollapsed =
                                normalizedSearch.length === 0 &&
                                Boolean(collapsedSubgroups[subgroupCollapseKey]);
                              return (
                                <div
                                  key={subgroupCollapseKey}
                                  className="neris-incident-type-subgroup-container"
                                >
                                  <button
                                    type="button"
                                    className="neris-incident-type-subgroup-button"
                                    onClick={() =>
                                      handleToggleSubgroup(
                                        category.categoryKey,
                                        subgroup.subgroupKey,
                                      )
                                    }
                                  >
                                    {subgroupCollapsed ? (
                                      <ChevronRight size={13} />
                                    ) : (
                                      <ChevronDown size={13} />
                                    )}
                                    <span>{subgroup.subgroupLabel}</span>
                                  </button>
                                  {!subgroupCollapsed ? (
                                    <div className="neris-incident-type-item-list">
                                      {subgroup.options.map(({ option, leafLabel }) => {
                                        const isSelected =
                                          mode === "single"
                                            ? option.value === normalizedSelectedValue
                                            : selectedValueSet.has(option.value);
                                        const isDisabled =
                                          mode === "multi" &&
                                          typeof maxSelections === "number" &&
                                          selectedValueSet.size >= maxSelections &&
                                          !isSelected;
                                        return (
                                          <button
                                            key={option.value}
                                            type="button"
                                            className={`neris-incident-type-item${
                                              isSelected ? " selected" : ""
                                            }${isDisabled ? " disabled" : ""}`}
                                            aria-selected={isSelected}
                                            aria-disabled={isDisabled}
                                            onClick={() => {
                                              if (isDisabled) {
                                                return;
                                              }
                                              if (mode === "single") {
                                                onChange(option.value);
                                                setIsOpen(false);
                                                setSearchTerm("");
                                                return;
                                              }
                                              const nextSelected = new Set(selectedValueSet);
                                              if (nextSelected.has(option.value)) {
                                                nextSelected.delete(option.value);
                                              } else {
                                                nextSelected.add(option.value);
                                              }
                                              const nextOrderedValues = options
                                                .map((entry) => entry.value)
                                                .filter((entryValue) =>
                                                  nextSelected.has(entryValue),
                                                );
                                              onChange(nextOrderedValues.join(","));
                                            }}
                                          >
                                            {showCheckboxes ? (
                                              <span className="neris-incident-type-item-checkbox">
                                                <input
                                                  type="checkbox"
                                                  tabIndex={-1}
                                                  readOnly
                                                  checked={isSelected}
                                                />
                                              </span>
                                            ) : null}
                                            <span>{leafLabel}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </>
                        ) : null}
                      </section>
                    );
                  })
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
            {mode === "multi" && typeof maxSelections === "number" ? (
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
              {groupedOptions.length ? (
                groupedOptions.map((category) => {
                  const categoryCollapsed =
                    normalizedSearch.length === 0 &&
                    collapsedCategories[category.categoryKey] !== false;
                  return (
                    <section key={category.categoryKey} className="neris-incident-type-group">
                      <button
                        type="button"
                        className="neris-incident-type-group-button"
                        onClick={() => handleToggleCategory(category.categoryKey)}
                      >
                        {categoryCollapsed ? (
                          <ChevronRight size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                        <span>{category.categoryLabel}</span>
                        <strong>{category.optionCount}</strong>
                      </button>
                      {!categoryCollapsed ? (
                        <>
                          {category.directOptions.length ? (
                            <div className="neris-incident-type-item-list">
                              {category.directOptions.map(({ option, leafLabel }) => {
                                const isSelected =
                                  mode === "single"
                                    ? option.value === normalizedSelectedValue
                                    : selectedValueSet.has(option.value);
                                const isDisabled =
                                  mode === "multi" &&
                                  typeof maxSelections === "number" &&
                                  selectedValueSet.size >= maxSelections &&
                                  !isSelected;
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    className={`neris-incident-type-item neris-incident-type-item-main${
                                      isSelected ? " selected" : ""
                                    }${isDisabled ? " disabled" : ""}`}
                                    aria-selected={isSelected}
                                    aria-disabled={isDisabled}
                                    onClick={() => {
                                      if (isDisabled) return;
                                      if (mode === "single") {
                                        onChange(option.value);
                                        setIsOpen(false);
                                        setSearchTerm("");
                                        return;
                                      }
                                      const nextSelected = new Set(selectedValueSet);
                                      if (nextSelected.has(option.value)) {
                                        nextSelected.delete(option.value);
                                      } else {
                                        nextSelected.add(option.value);
                                      }
                                      const nextOrderedValues = options
                                        .map((entry) => entry.value)
                                        .filter((entryValue) =>
                                          nextSelected.has(entryValue),
                                        );
                                      onChange(nextOrderedValues.join(","));
                                    }}
                                  >
                                    {showCheckboxes ? (
                                      <span className="neris-incident-type-item-checkbox">
                                        <input
                                          type="checkbox"
                                          tabIndex={-1}
                                          readOnly
                                          checked={isSelected}
                                        />
                                      </span>
                                    ) : null}
                                    <span>{leafLabel}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                          {category.subgroups.map((subgroup) => {
                            const subgroupCollapseKey = `${category.categoryKey}::${subgroup.subgroupKey}`;
                            const subgroupCollapsed =
                              normalizedSearch.length === 0 &&
                              Boolean(collapsedSubgroups[subgroupCollapseKey]);
                            return (
                              <div
                                key={subgroupCollapseKey}
                                className="neris-incident-type-subgroup-container"
                              >
                                <button
                                  type="button"
                                  className="neris-incident-type-subgroup-button"
                                  onClick={() =>
                                    handleToggleSubgroup(
                                      category.categoryKey,
                                      subgroup.subgroupKey,
                                    )
                                  }
                                >
                                  {subgroupCollapsed ? (
                                    <ChevronRight size={13} />
                                  ) : (
                                    <ChevronDown size={13} />
                                  )}
                                  <span>{subgroup.subgroupLabel}</span>
                                </button>
                                {!subgroupCollapsed ? (
                                  <div className="neris-incident-type-item-list">
                                    {subgroup.options.map(({ option, leafLabel }) => {
                                      const isSelected =
                                        mode === "single"
                                          ? option.value === normalizedSelectedValue
                                          : selectedValueSet.has(option.value);
                                      const isDisabled =
                                        mode === "multi" &&
                                        typeof maxSelections === "number" &&
                                        selectedValueSet.size >= maxSelections &&
                                        !isSelected;
                                      return (
                                        <button
                                          key={option.value}
                                          type="button"
                                          className={`neris-incident-type-item${
                                            isSelected ? " selected" : ""
                                          }${isDisabled ? " disabled" : ""}`}
                                          aria-selected={isSelected}
                                          aria-disabled={isDisabled}
                                          onClick={() => {
                                            if (isDisabled) return;
                                            if (mode === "single") {
                                              onChange(option.value);
                                              setIsOpen(false);
                                              setSearchTerm("");
                                              return;
                                            }
                                            const nextSelected = new Set(selectedValueSet);
                                            if (nextSelected.has(option.value)) {
                                              nextSelected.delete(option.value);
                                            } else {
                                              nextSelected.add(option.value);
                                            }
                                            const nextOrderedValues = options
                                              .map((entry) => entry.value)
                                              .filter((entryValue) =>
                                                nextSelected.has(entryValue),
                                              );
                                            onChange(nextOrderedValues.join(","));
                                          }}
                                        >
                                          {showCheckboxes ? (
                                            <span className="neris-incident-type-item-checkbox">
                                              <input
                                                type="checkbox"
                                                tabIndex={-1}
                                                readOnly
                                                checked={isSelected}
                                              />
                                            </span>
                                          ) : null}
                                          <span>{leafLabel}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </>
                      ) : null}
                    </section>
                  );
                })
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
