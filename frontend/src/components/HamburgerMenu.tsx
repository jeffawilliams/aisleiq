import { useState, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { ListRecord } from "../hooks/useLists.js";
import { UserRole } from "../hooks/useAuth.js";
import { Store } from "../types/index.js";

interface Props {
  user: User | null;
  role: UserRole;
  lists: ListRecord[];
  activeListId: string | null;
  stores: Store[];
  activeStoreId: number | null;
  onSetListStore: (storeId: number | null) => void;
  onSignOut: () => void;
  onSelectList: (id: string) => void;
  onCreateList: (name: string) => void;
  onDeleteList: (id: string) => void;
  onRenameList: (id: string, name: string) => void;
  onGenerateShareLink: (id: string) => Promise<void>;
  onRevokeShareLink: (id: string) => Promise<void>;
  onOpenDashboard: () => void;
  onSendFeedback: () => void;
}

export function HamburgerMenu({
  user,
  role,
  lists,
  activeListId,
  stores,
  activeStoreId,
  onSetListStore,
  onSignOut,
  onSelectList,
  onCreateList,
  onDeleteList,
  onRenameList,
  onGenerateShareLink,
  onRevokeShareLink,
  onOpenDashboard,
  onSendFeedback,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [sharingListId, setSharingListId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListName, setNewListName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  function open() {
    setIsOpen(true);
    setConfirmingDeleteId(null);
    setRenamingId(null);
    setSharingListId(null);
    setCopiedId(null);
    setShowNewListInput(false);
    setNewListName("");
  }

  function close() {
    setIsOpen(false);
    setConfirmingDeleteId(null);
    setRenamingId(null);
    setSharingListId(null);
    setCopiedId(null);
    setShowNewListInput(false);
    setNewListName("");
  }

  function startRename(list: ListRecord) {
    setRenamingId(list.id);
    setRenameValue(list.name);
    setConfirmingDeleteId(null);
    setSharingListId(null);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed) onRenameList(id, trimmed);
    setRenamingId(null);
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === "Enter") commitRename(id);
    if (e.key === "Escape") setRenamingId(null);
  }

  function handleCreateList() {
    const trimmed = newListName.trim();
    if (!trimmed) return;
    onCreateList(trimmed);
    setShowNewListInput(false);
    setNewListName("");
    close();
  }

  function handleNewListKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleCreateList();
    if (e.key === "Escape") {
      setShowNewListInput(false);
      setNewListName("");
    }
  }

  async function handleShareClick(list: ListRecord) {
    if (!list.share_token) {
      await onGenerateShareLink(list.id);
    }
    setSharingListId(list.id);
    setConfirmingDeleteId(null);
    setRenamingId(null);
  }

  function getShareUrl(token: string) {
    return `${window.location.origin}/shared/${token}`;
  }

  async function handleCopyLink(list: ListRecord) {
    if (!list.share_token) return;
    try {
      await navigator.clipboard.writeText(getShareUrl(list.share_token));
      setCopiedId(list.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard not available — no-op
    }
  }

  async function handleStopSharing(list: ListRecord) {
    await onRevokeShareLink(list.id);
    setSharingListId(null);
  }

  return (
    <>
      <button
        className="hamburger-btn"
        onClick={open}
        aria-label="Open menu"
      >
        <span className="hamburger-icon">
          <span />
          <span />
          <span />
        </span>
      </button>

      {isOpen && (
        <>
          <div className="nav-overlay" onClick={close} />
          <div className="nav-panel" role="dialog" aria-label="Menu">
            <div className="nav-panel__header">
              <span className="nav-panel__title">Menu</span>
              <button className="nav-panel__close" onClick={close} aria-label="Close menu">
                ×
              </button>
            </div>

            <div className="nav-panel__section-label">My Lists</div>

            <ul className="nav-panel__list">
              {lists.map(list => {
                const isActive = list.id === activeListId;
                const isConfirming = confirmingDeleteId === list.id;
                const isRenaming = renamingId === list.id;
                const isSharing = sharingListId === list.id;

                if (isConfirming) {
                  return (
                    <li key={list.id} className="nav-list-item nav-list-item--confirming">
                      <span className="nav-list-item__confirm-text">
                        Delete &ldquo;{list.name}&rdquo;?
                      </span>
                      <div className="nav-list-item__confirm-actions">
                        <button
                          className="nav-list-item__btn-cancel"
                          onClick={() => setConfirmingDeleteId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          className="nav-list-item__btn-delete-confirm"
                          onClick={() => {
                            onDeleteList(list.id);
                            setConfirmingDeleteId(null);
                            close();
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                }

                if (isSharing) {
                  // After generateShareLink resolves, list.share_token is populated via props
                  const url = list.share_token ? getShareUrl(list.share_token) : null;
                  return (
                    <li key={list.id} className="nav-list-item nav-list-item--sharing">
                      <div className="nav-share-panel">
                        <div className="nav-share-panel__header">
                          <span className="nav-share-panel__label">Share &ldquo;{list.name}&rdquo;</span>
                          <button
                            className="nav-share-panel__close"
                            onClick={() => setSharingListId(null)}
                            aria-label="Close share panel"
                          >
                            ×
                          </button>
                        </div>
                        {url ? (
                          <>
                            <div className="nav-share-panel__link-row">
                              <input
                                type="text"
                                className="nav-share-panel__link-input"
                                value={url}
                                readOnly
                                onFocus={e => e.target.select()}
                              />
                              <button
                                className="nav-share-panel__copy-btn"
                                onClick={() => handleCopyLink(list)}
                              >
                                {copiedId === list.id ? "Copied!" : "Copy"}
                              </button>
                            </div>
                            <button
                              className="nav-share-panel__stop-btn"
                              onClick={() => handleStopSharing(list)}
                            >
                              Stop Sharing
                            </button>
                          </>
                        ) : (
                          <p className="nav-share-panel__generating">Generating link…</p>
                        )}
                      </div>
                    </li>
                  );
                }

                return (
                  <li
                    key={list.id}
                    className={`nav-list-item${isActive ? " nav-list-item--active" : ""}`}
                  >
                    {isRenaming ? (
                      <input
                        ref={renameInputRef}
                        className="nav-list-item__name-input"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => handleRenameKeyDown(e, list.id)}
                        onBlur={() => commitRename(list.id)}
                      />
                    ) : (
                      <>
                        <button
                          className="nav-list-item__select"
                          onClick={() => { onSelectList(list.id); close(); }}
                        >
                          <span
                            className="nav-list-item__name"
                            onClick={e => { e.stopPropagation(); startRename(list); }}
                          >
                            {list.name}
                          </span>
                          <span className="nav-list-item__count">
                            {list.items.length} item{list.items.length !== 1 ? "s" : ""}
                          </span>
                        </button>
                        <button
                          className="nav-list-item__share"
                          aria-label={`Share ${list.name}`}
                          onClick={e => { e.stopPropagation(); handleShareClick(list); }}
                          title={list.share_token ? "Shared" : "Share"}
                        >
                          {list.share_token ? "🔗" : "↗"}
                        </button>
                        <button
                          className="nav-list-item__delete"
                          aria-label={`Delete ${list.name}`}
                          onClick={e => { e.stopPropagation(); setConfirmingDeleteId(list.id); }}
                        >
                          ×
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>

            {showNewListInput ? (
              <div className="nav-panel__new-list-row">
                <input
                  type="text"
                  className="nav-panel__new-list-input"
                  placeholder="List name"
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  onKeyDown={handleNewListKeyDown}
                  autoFocus
                />
                <button
                  className="nav-panel__new-list-save"
                  onClick={handleCreateList}
                  disabled={!newListName.trim()}
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                className="nav-panel__new-list-btn"
                onClick={() => setShowNewListInput(true)}
              >
                + New List
              </button>
            )}

            {stores.length > 0 && (
              <>
                <div className="nav-panel__section-label">Store</div>
                <div className="nav-panel__store-picker">
                  <select
                    className="nav-panel__store-select"
                    value={activeStoreId ?? ""}
                    onChange={e => {
                      const val = e.target.value;
                      onSetListStore(val === "" ? null : Number(val));
                    }}
                  >
                    <option value="">None</option>
                    {stores.map(store => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="nav-panel__divider" />
            <div className="nav-panel__section-label">Account</div>

            <button
              className="nav-feedback-btn"
              onClick={() => { close(); onSendFeedback(); }}
            >
              Send Feedback
            </button>

            {role === "admin" && (
              <button
                className="nav-dashboard-btn"
                onClick={() => { close(); onOpenDashboard(); }}
              >
                Dashboard
              </button>
            )}

            {user && (
              <button
                className="nav-sign-out"
                onClick={() => { onSignOut(); close(); }}
              >
                Sign Out
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
