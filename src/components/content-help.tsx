import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type HelpState = {
  text: string;
  x: number;
  y: number;
};

const ACTION_PREFIXES: Record<string, string> = {
  editar: "Clique para alterar este registro.",
  excluir: "Clique para remover este registro.",
  remover: "Clique para remover este registro.",
  salvar: "Clique para gravar as alterações informadas.",
  cancelar: "Clique para cancelar sem salvar alterações.",
  novo: "Clique para cadastrar um novo item.",
  adicionar: "Clique para incluir um novo item.",
  importar: "Clique para trazer dados de uma planilha.",
  exportar: "Clique para baixar os dados exibidos.",
  gerar: "Clique para gerar este documento ou relatório.",
  copiar: "Clique para copiar esta informação.",
  abrir: "Clique para visualizar os detalhes.",
};

function normalizedText(element: Element) {
  return (
    element.getAttribute("title") ||
    element.getAttribute("aria-label") ||
    element.textContent ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function labelForField(element: Element) {
  const id = element.getAttribute("id");
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }

  const parentLabel = element.closest("label");
  if (parentLabel?.textContent?.trim()) return parentLabel.textContent.trim();

  const fieldContainer = element.closest("div");
  const nearbyLabel = fieldContainer?.querySelector("label");
  return nearbyLabel?.textContent?.trim() || element.getAttribute("placeholder") || "este campo";
}

function describeElement(element: Element) {
  const explicit = element.getAttribute("data-context-help");
  if (explicit) return explicit;

  if (element.matches("th")) {
    const label = normalizedText(element);
    return label ? `Coluna “${label}”. Use-a para identificar e comparar os dados da lista.` : null;
  }

  if (element.matches("td")) {
    const row = element.parentElement;
    const index = row ? Array.from(row.children).indexOf(element) : -1;
    const table = element.closest("table");
    const heading =
      index >= 0 ? table?.querySelectorAll("thead th")[index]?.textContent?.trim() : "";
    return heading
      ? `Informação da coluna “${heading}” deste registro.`
      : "Informação deste registro.";
  }

  if (
    element.matches("input, textarea, select, [role=combobox], [role=spinbutton], [role=checkbox]")
  ) {
    const label = labelForField(element);
    const type = element.getAttribute("type");
    if (type === "checkbox" || element.getAttribute("role") === "checkbox") {
      return `Marque ou desmarque “${label}”.`;
    }
    if (element.matches("select, [role=combobox]")) return `Selecione uma opção para “${label}”.`;
    return `Preencha “${label}”. Esta informação será usada no registro.`;
  }

  if (element.matches("button, [role=button]")) {
    const label = normalizedText(element);
    if (!label) return "Clique para executar esta ação.";
    const keyword = Object.keys(ACTION_PREFIXES).find((item) =>
      label.toLowerCase().startsWith(item),
    );
    return keyword
      ? `${ACTION_PREFIXES[keyword]} Ação: ${label}.`
      : `Ação: ${label}. Clique para continuar.`;
  }

  if (element.matches("a")) {
    const label = normalizedText(element);
    return label ? `Acesse “${label}”.` : "Clique para abrir esta página.";
  }

  if (element.matches("h1, h2, h3, h4, [role=tab]")) {
    const label = normalizedText(element);
    return label ? `Seção “${label}”. Aqui você consulta e gerencia estas informações.` : null;
  }

  return null;
}

function getHelpTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest(
    "button, a, input, textarea, select, [role=button], [role=combobox], [role=spinbutton], [role=checkbox], [role=tab], th, td, h1, h2, h3, h4, [data-context-help]",
  );
}

export function ContentHelp() {
  const [help, setHelp] = useState<HelpState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef<Element | null>(null);

  useEffect(() => {
    const cancel = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };

    const hide = () => {
      cancel();
      active.current = null;
      setHelp(null);
    };

    const showFor = (event: PointerEvent) => {
      const target = getHelpTarget(event.target);
      if (!target || !target.closest("[data-content-area]")) return hide();
      if (target === active.current) return;

      cancel();
      active.current = target;
      const description = describeElement(target);
      if (!description) return;
      const position = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        if (active.current === target) setHelp({ text: description, ...position });
      }, 550);
    };

    const move = (event: PointerEvent) => {
      if (!active.current) return;
      setHelp((current) => (current ? { ...current, x: event.clientX, y: event.clientY } : null));
    };

    const leave = (event: PointerEvent) => {
      const from = getHelpTarget(event.target);
      const to = getHelpTarget(event.relatedTarget);
      if (from && from !== to) hide();
    };

    document.addEventListener("pointerover", showFor);
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerout", leave);
    document.addEventListener("scroll", hide, true);

    return () => {
      cancel();
      document.removeEventListener("pointerover", showFor);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("scroll", hide, true);
    };
  }, []);

  if (!help || typeof document === "undefined") return null;
  const left = Math.min(help.x + 16, window.innerWidth - 340);
  const top = Math.min(help.y + 16, window.innerHeight - 86);

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[100] max-w-xs rounded-lg border border-primary/30 bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
      style={{ left: Math.max(8, left), top: Math.max(8, top) }}
    >
      <span className="font-semibold text-primary">Ajuda: </span>
      {help.text}
    </div>,
    document.body,
  );
}
