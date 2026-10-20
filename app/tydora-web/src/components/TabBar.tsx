import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./TabBar.css";

export interface TabItem {
  id: string;
  /** 文件绝对路径；未命名标签为 null */
  path: string | null;
  modified: boolean;
}

interface TabBarProps {
  tabs: TabItem[];
  /** 当前激活标签 id；白板 / 预览等非标签视图显示时为 null */
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

const baseName = (p: string) => p.split(/[/\\]/).pop() || p;
const parentName = (p: string) => {
  const parts = p.split(/[/\\]/).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : "";
};

export function TabBar({ tabs, activeId, onActivate, onClose, onNew }: TabBarProps) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);

  // 同名文件（不同目录）需要附带父目录名才能区分
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tab of tabs) {
      if (!tab.path) continue;
      const name = baseName(tab.path);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
  }, [tabs]);

  useEffect(() => {
    if (!activeId) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, tabs.length]);

  return (
    <div className="editor-tabbar" data-tauri-drag-region="false">
      <div className="editor-tabbar-list" ref={listRef} role="tablist">
        {tabs.map((tab) => {
          const name = tab.path ? baseName(tab.path) : t("app.tabs.untitled");
          const hint = tab.path && (duplicateNames.get(name) ?? 0) > 1 ? parentName(tab.path) : "";
          const active = tab.id === activeId;
          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              role="tab"
              aria-selected={active}
              className={`editor-tab${active ? " is-active" : ""}${tab.modified ? " is-modified" : ""}`}
              title={tab.path ?? name}
              onMouseDown={(e) => {
                if (e.button === 0) onActivate(tab.id);
              }}
            >
              <span className="editor-tab-name">{name}</span>
              {hint && <span className="editor-tab-hint">{hint}</span>}
              <button
                className="editor-tab-close"
                title={t("app.tabs.close")}
                aria-label={t("app.tabs.close")}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
              >
                <span className="editor-tab-dot" />
                <svg className="editor-tab-x" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
      <button className="editor-tabbar-new" title={t("app.tabs.newTab")} aria-label={t("app.tabs.newTab")} onClick={onNew}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
