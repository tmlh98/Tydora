import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

const GRID_ROWS = 8;
const GRID_COLS = 10;
const MAX_ROWS = 1000;
const MAX_COLS = 100;

const clampSize = (value: string, max: number) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), max) : 1;
};

interface TableFloatingToolbarProps {
  editor: Editor;
  tableElement: HTMLElement;
  onClose: () => void;
}

export function TableFloatingToolbar({ editor, tableElement, onClose }: TableFloatingToolbarProps) {
  const { t } = useTranslation();

  // editor 销毁后 commandManager 被置 null，任何 .chain() 都会抛
  // "Cannot read properties of null (reading 'chain')"；统一经此守卫执行命令
  const runSafe = useCallback((fn: (ed: Editor) => void) => {
    try {
      if (!editor || editor.isDestroyed) return;
      fn(editor);
    } catch { /* editor 已销毁时忽略 */ }
  }, [editor]);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showGridPicker, setShowGridPicker] = useState(false);
  const [hoverRow, setHoverRow] = useState(0);
  const [hoverCol, setHoverCol] = useState(0);
  const [customRows, setCustomRows] = useState("");
  const [customCols, setCustomCols] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const gridPickerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // 定位工具栏所属表格节点的位置；DOM 定位失败时回退到当前选区所在表格
  const findTablePos = useCallback((ed: Editor): number => {
    const { state, view } = ed;
    const resolveTableFrom = (pos: number) => {
      const $pos = state.doc.resolve(pos);
      for (let depth = $pos.depth; depth > 0; depth--) {
        if ($pos.node(depth).type.name === "table") return $pos.before(depth);
      }
      return -1;
    };
    const cell = tableElement.querySelector("th, td");
    if (cell) {
      try {
        const pos = resolveTableFrom(view.posAtDOM(cell, 0));
        if (pos !== -1) return pos;
      } catch { /* DOM 已脱离文档 */ }
    }
    return resolveTableFrom(state.selection.from);
  }, [tableElement]);

  // 调整表格大小：保留已有单元格，按目标行列补齐或裁剪
  const handleResizeTable = useCallback((targetRows: number, targetCols: number) => {
    runSafe((ed) => {
      const tablePos = findTablePos(ed);
      if (tablePos === -1) return;
      const { state } = ed;
      const table = state.doc.nodeAt(tablePos);
      if (!table || table.type.name !== "table") return;

      const { tableRow, tableCell, tableHeader } = state.schema.nodes;
      const firstRow = table.childCount > 0 ? table.child(0) : null;
      const headerType = firstRow?.firstChild?.type === tableHeader ? tableHeader : tableCell;
      const lastRow = table.childCount > 0 ? table.child(table.childCount - 1) : null;

      const rows: PMNode[] = [];
      for (let r = 0; r < targetRows; r++) {
        const oldRow = r < table.childCount ? table.child(r) : null;
        const cellType = r === 0 ? headerType : tableCell;
        const cells: PMNode[] = [];
        for (let c = 0; c < targetCols; c++) {
          if (oldRow && c < oldRow.childCount) {
            cells.push(oldRow.child(c));
            continue;
          }
          // 新单元格沿用同列已有单元格的对齐方式
          const refCell = (oldRow ?? lastRow)?.maybeChild(c) ?? null;
          const align = refCell?.attrs.align;
          const created = cellType.createAndFill(align ? { align } : null);
          if (created) cells.push(created);
        }
        rows.push(tableRow.create(oldRow?.attrs ?? null, cells));
      }
      const newTable = table.type.create(table.attrs, rows);

      const tr = state.tr.replaceWith(tablePos, tablePos + table.nodeSize, newTable);
      const tableEnd = tablePos + newTable.nodeSize;
      if (tr.selection.from <= tablePos || tr.selection.to >= tableEnd) {
        tr.setSelection(TextSelection.near(tr.doc.resolve(tablePos + 1)));
      }
      ed.view.dispatch(tr);
      ed.commands.focus();
    });
    setShowGridPicker(false);
    if (!tableElement.isConnected) onClose();
  }, [runSafe, findTablePos, tableElement, onClose]);

  const toggleGridPicker = () => {
    if (!showGridPicker) {
      let rows = 0;
      let cols = 0;
      runSafe((ed) => {
        const tablePos = findTablePos(ed);
        const table = tablePos === -1 ? null : ed.state.doc.nodeAt(tablePos);
        if (!table) return;
        rows = table.childCount;
        cols = table.firstChild?.childCount ?? 0;
      });
      setCustomRows(rows ? String(rows) : "");
      setCustomCols(cols ? String(cols) : "");
      setHoverRow(0);
      setHoverCol(0);
    }
    setShowGridPicker(!showGridPicker);
    setShowMoreMenu(false);
  };

  const applyCustomSize = () => {
    handleResizeTable(clampSize(customRows, MAX_ROWS), clampSize(customCols, MAX_COLS));
  };

  // 输入框内的按键不能冒泡到编辑器 / 全局快捷键
  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      applyCustomSize();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowGridPicker(false);
    }
  };

  const updatePosition = useCallback(() => {
    const rect = tableElement.getBoundingClientRect();
    const toolbarHeight = toolbarRef.current?.offsetHeight || 36;
    setPos({
      top: rect.top - toolbarHeight - 4,
      left: rect.left,
    });
  }, [tableElement]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    updatePosition();
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [updatePosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        toolbarRef.current && !toolbarRef.current.contains(e.target as Node) &&
        moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node) &&
        gridPickerRef.current && !gridPickerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleAlign = (align: "left" | "center" | "right") => {
    // 表格内（含多选单元格 CellSelection）：用 setCellAttribute 批量设置单元格 align，
    // TableCell/TableHeader 内置 align 属性会渲染为 td/th 上的 text-align 样式
    runSafe((ed) => {
      if (ed.isActive("tableCell") || ed.isActive("tableHeader")) {
        ed.chain().focus().setCellAttribute("align", align).run();
        return;
      }
      // 非表格场景：回退到段落级 textAlign
      ed.chain().focus().command(({ tr, state }) => {
        const { $from } = state.selection;
        for (let depth = $from.depth; depth >= 0; depth--) {
          const node = $from.node(depth);
          if (node.type.name === "paragraph") {
            const pos = $from.before(depth);
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, textAlign: align });
            return true;
          }
        }
        return false;
      }).run();
    });
  };

  const handleInsertRowAbove = () => {
    runSafe((ed) => ed.chain().focus().addRowBefore().run());
    setShowMoreMenu(false);
  };

  const handleInsertRowBelow = () => {
    runSafe((ed) => ed.chain().focus().addRowAfter().run());
    setShowMoreMenu(false);
  };

  const handleInsertColLeft = () => {
    runSafe((ed) => ed.chain().focus().addColumnBefore().run());
    setShowMoreMenu(false);
  };

  const handleInsertColRight = () => {
    runSafe((ed) => ed.chain().focus().addColumnAfter().run());
    setShowMoreMenu(false);
  };

  const handleDeleteRow = () => {
    runSafe((ed) => ed.chain().focus().deleteRow().run());
    setShowMoreMenu(false);
  };

  const handleDeleteCol = () => {
    runSafe((ed) => ed.chain().focus().deleteColumn().run());
    setShowMoreMenu(false);
  };

  const handleMergeCells = () => {
    runSafe((ed) => ed.chain().focus().mergeCells().run());
    setShowMoreMenu(false);
  };

  const handleSplitCell = () => {
    runSafe((ed) => ed.chain().focus().splitCell().run());
    setShowMoreMenu(false);
  };

  const handleDeleteTable = () => {
    runSafe((ed) => ed.chain().focus().deleteTable().run());
    onClose();
  };

  const ICONS = {
    table: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
      </svg>
    ),
    alignLeft: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" />
      </svg>
    ),
    alignCenter: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
      </svg>
    ),
    alignRight: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" />
      </svg>
    ),
    more: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
      </svg>
    ),
    trash: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    ),
  };

  const gridPicker = showGridPicker && (
    <div className="table-grid-picker">
      <div className="table-grid-grid">
        {Array.from({ length: GRID_ROWS }, (_, row) => (
          <div key={row} className="table-grid-row">
            {Array.from({ length: GRID_COLS }, (_, col) => {
              const isHovered = row < hoverRow && col < hoverCol;
              return (
                <div
                  key={col}
                  className={`table-grid-cell ${isHovered ? "hover" : ""}`}
                  onMouseEnter={() => {
                    setHoverRow(row + 1);
                    setHoverCol(col + 1);
                  }}
                  onClick={() => handleResizeTable(row + 1, col + 1)}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="table-grid-size">
        {hoverRow > 0 && hoverCol > 0
          ? `${hoverRow} × ${hoverCol}`
          : t("editor.tableToolbar.selectTableSize")}
      </div>
      <div className="table-grid-custom">
        <input
          type="number"
          min={1}
          max={MAX_ROWS}
          value={customRows}
          title={t("editor.tableToolbar.rows")}
          aria-label={t("editor.tableToolbar.rows")}
          onChange={(e) => setCustomRows(e.target.value)}
          onKeyDown={handleCustomKeyDown}
        />
        <span>×</span>
        <input
          type="number"
          min={1}
          max={MAX_COLS}
          value={customCols}
          title={t("editor.tableToolbar.cols")}
          aria-label={t("editor.tableToolbar.cols")}
          onChange={(e) => setCustomCols(e.target.value)}
          onKeyDown={handleCustomKeyDown}
        />
        <button onClick={applyCustomSize}>{t("editor.tableToolbar.apply")}</button>
      </div>
    </div>
  );

  const toolbar = (
    <div
      ref={toolbarRef}
      className="table-floating-toolbar"
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
    >
      <div className="table-floating-toolbar-left">
        <div className="table-toolbar-grid-wrapper" ref={gridPickerRef}>
          <button
            className={`table-toolbar-btn ${showGridPicker ? "active" : ""}`}
            title={t("editor.tableToolbar.resizeTable")}
            onClick={toggleGridPicker}
          >
            {ICONS.table}
          </button>
          {gridPicker}
        </div>
        <div className="table-toolbar-divider" />
        <button className="table-toolbar-btn" title={t("editor.tableToolbar.alignLeft")} onClick={() => handleAlign("left")}>{ICONS.alignLeft}</button>
        <button className="table-toolbar-btn" title={t("editor.tableToolbar.alignCenter")} onClick={() => handleAlign("center")}>{ICONS.alignCenter}</button>
        <button className="table-toolbar-btn" title={t("editor.tableToolbar.alignRight")} onClick={() => handleAlign("right")}>{ICONS.alignRight}</button>
      </div>
      <div className="table-floating-toolbar-right">
        <div className="table-toolbar-more-wrapper" ref={moreMenuRef}>
          <button
            className={`table-toolbar-btn ${showMoreMenu ? "active" : ""}`}
            title={t("editor.tableToolbar.moreActions")}
            onClick={() => {
              setShowMoreMenu(!showMoreMenu);
              setShowGridPicker(false);
            }}
          >
            {ICONS.more}
          </button>
          {showMoreMenu && (
            <div className="table-toolbar-dropdown">
              <button onClick={handleInsertRowAbove}>{t("editor.tableToolbar.insertRowAbove")}</button>
              <button onClick={handleInsertRowBelow}>{t("editor.tableToolbar.insertRowBelow")}</button>
              <div className="table-toolbar-dropdown-divider" />
              <button onClick={handleInsertColLeft}>{t("editor.tableToolbar.insertColLeft")}</button>
              <button onClick={handleInsertColRight}>{t("editor.tableToolbar.insertColRight")}</button>
              <div className="table-toolbar-dropdown-divider" />
              <button onClick={handleDeleteRow}>{t("editor.tableToolbar.deleteRow")}</button>
              <button onClick={handleDeleteCol}>{t("editor.tableToolbar.deleteCol")}</button>
              <div className="table-toolbar-dropdown-divider" />
              <button onClick={handleMergeCells}>{t("editor.tableToolbar.mergeCells")}</button>
              <button onClick={handleSplitCell}>{t("editor.tableToolbar.splitCell")}</button>
            </div>
          )}
        </div>
        <button className="table-toolbar-btn delete" title={t("editor.tableToolbar.deleteTable")} onClick={handleDeleteTable}>{ICONS.trash}</button>
      </div>
    </div>
  );

  return createPortal(toolbar, document.body);
}
