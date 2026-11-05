import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import "./RecentFilesPanel.css";

interface RecentFilesPanelProps {
  /** 当前激活仓库路径；为空时显示「尚未打开仓库」 */
  vaultPath: string | null;
  /** 最近打开的文件绝对路径列表（最新的在前） */
  files: string[];
  /** 当前正在编辑的文件（高亮） */
  currentFilePath?: string | null;
  /** 最多显示条数（通用设置 → 侧栏设置） */
  limit?: number;
  onSelectFile: (path: string) => void;
  onNewWindow?: (path: string) => void;
  /** 从列表中移除单条 */
  onRemove?: (path: string) => void;
  /** 清空整个列表 */
  onClear?: () => void;
}

interface MenuState {
  x: number;
  y: number;
  path: string;
}

function baseName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

/** 相对仓库根目录的路径；不在仓库内时原样返回 */
function toRelativePath(path: string, vaultPath: string | null): string {
  if (!vaultPath) return path;
  const abs = path.replace(/\\/g, "/");
  const root = vaultPath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!root) return abs;
  if (abs === root) return "";
  if (abs.startsWith(`${root}/`)) return abs.slice(root.length + 1);
  return abs;
}

export function RecentFilesPanel({
  vaultPath,
  files,
  currentFilePath = null,
  limit = 20,
  onSelectFile,
  onNewWindow,
  onRemove,
  onClear,
}: RecentFilesPanelProps) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<MenuState | null>(null);

  const items = useMemo(() => {
    const max = Math.max(1, limit);
    return files.slice(0, max);
  }, [files, limit]);

  // 菜单点击外部 / Esc / 滚动时关闭
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("click", close);
    document.addEventListener("contextmenu", close);
    document.addEventListener("scroll", close, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("contextmenu", close);
      document.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  if (!vaultPath) {
    return (
      <div className="recent-panel">
        <div className="recent-empty">{t("sidebar.recent.noVault")}</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="recent-panel">
        <div className="recent-empty">{t("sidebar.recent.empty")}</div>
        <div className="recent-empty-hint">{t("sidebar.recent.emptyHint")}</div>
      </div>
    );
  }

  return (
    <div className="recent-panel">
      <div className="recent-panel-header">
        <span className="recent-panel-count">
          {t("sidebar.recent.count", { count: items.length })}
        </span>
        <button
          type="button"
          className="recent-panel-clear"
          title={t("sidebar.recent.clear")}
          onClick={() => onClear?.()}
        >
          {t("sidebar.recent.clear")}
        </button>
      </div>

      <div className="recent-list">
        {items.map((path) => {
          const name = baseName(path);
          const rel = toRelativePath(path, vaultPath);
          const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
          return (
            <div
              key={path}
              className={`recent-item${path === currentFilePath ? " active" : ""}`}
              title={rel}
              onClick={() => onSelectFile(path)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenu({ x: e.clientX, y: e.clientY, path });
              }}
            >
              <span className="recent-item-name">{name}</span>
              {dir && <span className="recent-item-dir">{dir}</span>}
              {onRemove && (
                <button
                  type="button"
                  className="recent-item-remove"
                  title={t("sidebar.recent.remove")}
                  aria-label={t("sidebar.recent.remove")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(path);
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {menu &&
        createPortal(
          <RecentContextMenu
            x={menu.x}
            y={menu.y}
            path={menu.path}
            onClose={() => setMenu(null)}
            onNewWindow={onNewWindow}
            onRemove={onRemove}
          />,
          document.body,
        )}
    </div>
  );
}

function RecentContextMenu({
  x,
  y,
  path,
  onClose,
  onNewWindow,
  onRemove,
}: {
  x: number;
  y: number;
  path: string;
  onClose: () => void;
  onNewWindow?: (path: string) => void;
  onRemove?: (path: string) => void;
}) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // 贴边时向上/向左翻转，避免菜单被窗口裁掉
  useLayoutEffect(() => {
    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect) return;
    const GAP = 6;
    const left = x + rect.width > window.innerWidth - GAP ? x - rect.width : x;
    const top = y + rect.height > window.innerHeight - GAP ? y - rect.height : y;
    setPos({ left: Math.max(GAP, left), top: Math.max(GAP, top) });
  }, [x, y]);

  const copyPath = () => {
    navigator.clipboard.writeText(path).catch(() => {});
    onClose();
  };

  return (
    <div ref={menuRef} className="context-menu" style={{ left: pos.left, top: pos.top }}>
      {onNewWindow && (
        <div
          className="context-menu-item"
          onClick={(e) => {
            e.stopPropagation();
            onNewWindow(path);
            onClose();
          }}
        >
          {t("sidebar.recent.openInNewWindow")}
        </div>
      )}
      <div
        className="context-menu-item"
        onClick={(e) => {
          e.stopPropagation();
          copyPath();
        }}
      >
        {t("sidebar.recent.copyPath")}
      </div>
      {onRemove && (
        <>
          <div className="context-menu-divider" />
          <div
            className="context-menu-item danger"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(path);
              onClose();
            }}
          >
            {t("sidebar.recent.remove")}
          </div>
        </>
      )}
    </div>
  );
}
