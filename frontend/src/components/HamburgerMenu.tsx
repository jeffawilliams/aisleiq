import { useState, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { ListRecord } from "../hooks/useLists.js";

interface Props {
  user: User | null;
  lists: ListRecord[];
  activeListId: string | null;
  onSignOut: () => void;
  onSelectList: (id: string) => void;
  onCreateList: (name: string) => void;
  onDeleteList: (id: string) => void;
  onRenameList: (id: string, name: string) => void;
}

export function HamburgerMenu({
  user,
  lists,
  activeListId,
  onSignOut,
  onSelectList,
  onCreateList,
  onDeleteList,
  onRenameList,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListName, setNewListName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  function open() {
    setIsOpen(true);
    setConfirmingDeleteId(null);
    setRenamingId(null);
    setShowNewListInput(false);
    setNewListName("");
  }

  function close() {
    setIsOpen(false);
    setConfirmingDeleteId(null);
    setRenamingId(null);
    setShowNewListInput(false);
    setNewListName("");
  }

  function startRename(list: ListRecord) {
    setRenamingId(list.id);
    setRenameValue(list.name);
    setConfirmingDeleteId(null);
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

                return (
                  <li
                    key={list.id}
                    className={`nav-list-item${isActive ? " nav-list-item--active" : ""}`}
                  >
                    <button
                      className="nav-list-item__select"
                      onClick={() => { onSelectList(list.id); close(); }}
                    >
                      {isRenaming ? (
                        <input
                          ref={renameInputRef}
                          className="nav-list-item__name-input"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => handleRenameKeyDown(e, list.id)}
                          onBlur={() => commitRename(list.id)}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="nav-list-item__name"
                          onClick={e => { e.stopPropagation(); startRename(list); }}
                        >
                          {list.name}
                        </span>
                      )}
                      <span className="nav-list-item__count">
                        {list.items.length} item{list.items.length !== 1 ? "s" : ""}
                      </span>
                    </button>
                    {!isRenaming && (
                      <button
                        className="nav-list-item__delete"
                        aria-label={`Delete ${list.name}`}
                        onClick={e => { e.stopPropagation(); setConfirmingDeleteId(list.id); }}
                      >
                        ×
                      </button>
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

            <div className="nav-panel__spacer" />

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
