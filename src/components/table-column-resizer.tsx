import { useEffect } from "react";

const MIN_COLUMN_WIDTH = 56;

function tableHeaders(table: HTMLTableElement) {
  return Array.from(table.querySelectorAll<HTMLTableCellElement>("thead tr:first-child > th"));
}

function storageKey(table: HTMLTableElement) {
  const signature = tableHeaders(table)
    .map((header) => header.textContent?.trim() || "acoes")
    .join("|");
  return `sigjur:column-widths:${window.location.pathname}:${signature}`;
}

function setWidths(table: HTMLTableElement, widths: number[]) {
  const headers = tableHeaders(table);
  if (headers.length !== widths.length) return;

  table.style.tableLayout = "fixed";
  widths.forEach((width, index) => {
    headers[index].style.width = `${Math.max(MIN_COLUMN_WIDTH, width)}px`;
  });
  const total = widths.reduce((sum, width) => sum + Math.max(MIN_COLUMN_WIDTH, width), 0);
  table.style.width = `${total}px`;
  table.style.minWidth = `${total}px`;
}

function enhanceTable(table: HTMLTableElement) {
  if (table.dataset.columnResizable === "true") return;

  const headers = tableHeaders(table);
  if (!headers.length) return;
  table.dataset.columnResizable = "true";

  try {
    const saved = window.localStorage.getItem(storageKey(table));
    if (saved) setWidths(table, JSON.parse(saved) as number[]);
  } catch {
    // Uma preferência inválida não deve impedir a tabela de abrir.
  }

  headers.forEach((header, columnIndex) => {
    const handle = document.createElement("span");
    handle.className = "table-column-resizer";
    handle.setAttribute("aria-hidden", "true");
    handle.title = "Arraste para ajustar a largura da coluna";

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const currentHeaders = tableHeaders(table);
      const initialWidths = currentHeaders.map((cell) => cell.getBoundingClientRect().width);
      const initialWidth = initialWidths[columnIndex];
      if (!initialWidth) return;

      const startX = event.clientX;
      setWidths(table, initialWidths);
      document.body.dataset.resizingColumn = "true";

      const onPointerMove = (moveEvent: PointerEvent) => {
        const nextWidths = [...initialWidths];
        nextWidths[columnIndex] = Math.max(MIN_COLUMN_WIDTH, initialWidth + moveEvent.clientX - startX);
        setWidths(table, nextWidths);
      };

      const finishResize = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", finishResize);
        window.removeEventListener("pointercancel", finishResize);
        delete document.body.dataset.resizingColumn;

        const widths = tableHeaders(table).map((cell) => cell.getBoundingClientRect().width);
        try {
          window.localStorage.setItem(storageKey(table), JSON.stringify(widths));
        } catch {
          // O ajuste continua válido durante a sessão mesmo sem armazenamento local.
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", finishResize);
      window.addEventListener("pointercancel", finishResize);
    });

    header.appendChild(handle);
  });
}

export function TableColumnResizer() {
  useEffect(() => {
    const enhanceAll = (root: ParentNode) => {
      if (root instanceof HTMLTableElement) enhanceTable(root);
      root.querySelectorAll<HTMLTableElement>("table").forEach(enhanceTable);
    };

    enhanceAll(document);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) enhanceAll(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
