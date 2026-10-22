// 安全版 TableCell / TableHeader
//
// 官方扩展的 colspan / rowspan 走 TipTap 默认解析（getAttribute + 字符串转数字），
// 来自外部 HTML 的 rowspan="0"、colspan="0"、colspan="" 等会原样进入文档。
// prosemirror-tables 的 TableMap 对这类单元格不会登记其后续兄弟单元格，
// 而 fixTables 也修不了，于是列宽拖拽插件在 mousemove / decorations 中反复抛
// `RangeError: No cell with offset N found`。这里统一规整为 ≥1 的整数。

import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";

function parseSpan(element: HTMLElement, name: "colspan" | "rowspan"): number {
  const n = parseInt(element.getAttribute(name) ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

const spanAttributes = {
  colspan: {
    default: 1,
    parseHTML: (element: HTMLElement) => parseSpan(element, "colspan"),
  },
  rowspan: {
    default: 1,
    parseHTML: (element: HTMLElement) => parseSpan(element, "rowspan"),
  },
};

export const TableCellSafe = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...spanAttributes };
  },
});

export const TableHeaderSafe = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...spanAttributes };
  },
});
