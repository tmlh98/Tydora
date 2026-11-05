// 空表格退格即删除
//
// TipTap / ProseMirror 的表格默认只删单元格内容，不允许「退格把光标退出表格」。
// 于是 Markdown 里常见的空表（例如文件末尾残留的 `|  |` + `| --- |`）会变成
// 一块删不掉、也走不出去的空白，用户只能去源码模式手动删两行。
// 这里补一条规则：整张表没有任何内容时，Backspace / Delete 直接删除整表。

import { Extension } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";

/** 表格里是否完全没有内容（纯空白文本、无图片/公式等叶子节点） */
function isTableEmpty(table: PMNode): boolean {
  let empty = true;
  table.descendants((node) => {
    if (!empty) return false;
    if (node.isText) {
      if (node.text && node.text.trim()) empty = false;
    } else if (node.isLeaf) {
      empty = false;
    }
    return true;
  });
  return empty;
}

export const EmptyTableDelete = Extension.create({
  name: "emptyTableDelete",
  // 高于表格自身 keymap 的优先级，保证先于 prosemirror-tables 处理按键
  priority: 1000,

  addKeyboardShortcuts() {
    const deleteEmptyTable = (): boolean => {
      const { state } = this.editor;
      const { selection } = state;
      if (!selection.empty) return false;

      const { $from } = selection;
      let tableDepth = -1;
      for (let depth = $from.depth; depth > 0; depth--) {
        if ($from.node(depth).type.name === "table") {
          tableDepth = depth;
          break;
        }
      }
      if (tableDepth < 0) return false;
      if (!isTableEmpty($from.node(tableDepth))) return false;

      const pos = $from.before(tableDepth);
      const { tr } = state;
      tr.delete(pos, pos + $from.node(tableDepth).nodeSize);

      // 删完文档为空时需要补一个空段落，否则 doc 非法
      if (tr.doc.childCount === 0) {
        tr.insert(0, state.schema.nodes.paragraph.create());
      }
      tr.setSelection(Selection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size)), -1));

      this.editor.view.dispatch(tr.scrollIntoView());
      return true;
    };

    return {
      Backspace: deleteEmptyTable,
      Delete: deleteEmptyTable,
    };
  },
});
