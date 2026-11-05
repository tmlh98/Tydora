import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../components";
import type { VaultInfo } from "../Sidebar";
import "./VaultMenuButton.css";

interface VaultMenuButtonProps {
  vaults: VaultInfo[];
  activeIndex: number;
  onSelectVault: (index: number) => void;
  onRemoveVault: (index: number) => void;
  onOpenNewVault?: () => void;
  onManageVaults?: () => void;
  onOpenSettings?: () => void;
}

/**
 * 顶栏右上角的仓库切换按钮。
 * 取代原来的「侧栏底部悬浮胶囊 + 右下角浮窗」，任何时候都能点到，
 * 点开后在按钮下方弹出仓库列表 / 管理 / 新开 / 设置。
 */
export function VaultMenuButton({
  vaults,
  activeIndex,
  onSelectVault,
  onRemoveVault,
  onOpenNewVault,
  onManageVaults,
  onOpenSettings,
}: VaultMenuButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [removeIndex, setRemoveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  const activeVault = activeIndex >= 0 ? vaults[activeIndex] : null;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const bookIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M9 7h6M9 11h4" />
    </svg>
  );

  return (
    <div className="vault-topbar" ref={rootRef}>
      <button
        type="button"
        className={`vault-topbar-btn${open ? " active" : ""}`}
        title={activeVault ? `${t("sidebar.vault.switch")}：${activeVault.name}` : t("sidebar.vault.manage")}
        onClick={() => setOpen((v) => !v)}
      >
        {bookIcon}
        <span className="vault-topbar-name">{activeVault ? activeVault.name : t("sidebar.vault.unselected")}</span>
        <svg className="vault-topbar-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="vault-menu vault-menu--dropdown">
          {vaults.length > 0 ? (
            <div className="vault-menu-list">
              {vaults.map((vault, i) => (
                <div
                  key={vault.path}
                  className={`vault-menu-item${i === activeIndex ? " active" : ""}`}
                  onClick={() => {
                    onSelectVault(i);
                    setOpen(false);
                  }}
                >
                  <span className="vault-menu-name">
                    {vault.name}
                    {vault.temporary && <span className="vault-temp-badge">{t("sidebar.vault.temporary")}</span>}
                  </span>
                  <button
                    type="button"
                    className="vault-menu-remove-btn"
                    title={t("sidebar.vault.remove")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRemoveIndex(i);
                    }}
                  >
                    ✕
                  </button>
                  {i === activeIndex && <span className="vault-menu-check">✓</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="vault-menu-empty">{t("sidebar.empty.noVault")}</div>
          )}

          <div className="vault-menu-divider" />
          <div
            className="vault-menu-item vault-menu-manage"
            onClick={() => {
              setOpen(false);
              onManageVaults?.();
            }}
          >
            {bookIcon}
            <span>{t("sidebar.vault.manage")}</span>
          </div>
          <div
            className="vault-menu-item vault-menu-manage"
            onClick={() => {
              setOpen(false);
              onOpenNewVault?.();
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              <line x1="12" y1="10" x2="12" y2="16" />
              <line x1="9" y1="13" x2="15" y2="13" />
            </svg>
            <span>{t("sidebar.vault.openNewVault")}</span>
          </div>
          <div
            className="vault-menu-item vault-menu-manage"
            onClick={() => {
              setOpen(false);
              onOpenSettings?.();
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>{t("sidebar.vault.settings")}</span>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={removeIndex >= 0}
        title={t("sidebar.vault.removeConfirmTitle")}
        message={t("sidebar.vault.removeConfirmMessage", { name: vaults[removeIndex]?.name || "" })}
        type="warning"
        onConfirm={() => {
          onRemoveVault(removeIndex);
          setRemoveIndex(-1);
        }}
        onCancel={() => setRemoveIndex(-1)}
      />
    </div>
  );
}
