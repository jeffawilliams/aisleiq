import { useState, useRef, useEffect } from "react";
import { CameraCapture } from "./CameraCapture.js";
import { ProductConfirm } from "./ProductConfirm.js";
import { ListReview } from "./ListReview.js";
import { RecipeIngredient } from "../types/index.js";

type View = 'menu' | 'type' | 'product-confirm' | 'list-review' | 'recipe' | 'recipe-review';
type RecipeSubMode = 'photo' | 'url' | 'text';

interface AddItemSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItems: (items: string[]) => void;
  onAddItemWithPhoto?: (item: string, photo: string) => void;
  onAddRecipeItems?: (items: { name: string; quantity: string | null; recipeName: string | null }[]) => void;
  userId?: string | null;
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1200;
      let { width, height } = img;
      if (width > height && width > MAX) {
        height = Math.round((height * MAX) / width);
        width = MAX;
      } else if (height > width && height > MAX) {
        width = Math.round((width * MAX) / height);
        height = MAX;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      resolve(dataUrl.replace("data:image/jpeg;base64,", ""));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function AddItemSheet({ isOpen, onClose, onAddItems, onAddItemWithPhoto, onAddRecipeItems, userId }: AddItemSheetProps) {
  const [view, setView] = useState<View>('menu');
  const [typeInput, setTypeInput] = useState('');
  const [isScanLoading, setIsScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedItems, setScannedItems] = useState<string[]>([]);
  const [productDraft, setProductDraft] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Recipe state
  const [recipeSubMode, setRecipeSubMode] = useState<RecipeSubMode>('photo');
  const [recipeUrlInput, setRecipeUrlInput] = useState('');
  const [recipeTextInput, setRecipeTextInput] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [recipeName, setRecipeName] = useState<string | null>(null);
  const [recipeChecked, setRecipeChecked] = useState<Set<number>>(new Set());

  const productTriggerRef = useRef<(() => void) | null>(null);
  const listTriggerRef = useRef<(() => void) | null>(null);
  const recipePhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setView('menu');
      setScanError(null);
      setTypeInput('');
      setCapturedPhoto(null);
      setRecipeUrlInput('');
      setRecipeTextInput('');
      setRecipeIngredients([]);
      setRecipeName(null);
      setRecipeChecked(new Set());
    }
  }, [isOpen]);

  const handleCapture = async (base64: string, mode: 'product' | 'list') => {
    if (mode === 'product') setCapturedPhoto(base64);
    setIsScanLoading(true);
    setScanError(null);
    try {
      const base = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${base}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mode, ...(userId ? { userId } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Server error ${res.status}`);
      }
      const data = await res.json();
      const items: string[] = data.items ?? [];
      if (items.length === 0) {
        setScanError('No items detected. Try again.');
      } else if (mode === 'product' && items.length === 1) {
        setProductDraft(items[0]);
        setView('product-confirm');
      } else {
        setScannedItems(items);
        setView('list-review');
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed. Please try again.');
    } finally {
      setIsScanLoading(false);
    }
  };

  const handleRecipePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setIsScanLoading(true);
    setScanError(null);
    try {
      const base64 = await compressImage(file);
      const apiBase = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${apiBase}/api/recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'photo', image: base64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Server error ${res.status}`);
      }
      const ingredients: RecipeIngredient[] = data.ingredients ?? [];
      setRecipeIngredients(ingredients);
      setRecipeName(data.recipeName ?? null);
      setRecipeChecked(new Set(ingredients.map((_, i) => i)));
      setView('recipe-review');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Import failed. Please try again.');
    } finally {
      setIsScanLoading(false);
    }
  };

  const handleRecipeImport = async () => {
    setScanError(null);
    const apiBase = import.meta.env.VITE_API_URL ?? "";

    let body: Record<string, string>;
    if (recipeSubMode === 'url') {
      if (!recipeUrlInput.trim()) {
        setScanError('Please enter a URL.');
        return;
      }
      body = { mode: 'url', url: recipeUrlInput.trim() };
    } else {
      if (!recipeTextInput.trim()) {
        setScanError('Please paste some recipe text.');
        return;
      }
      body = { mode: 'text', text: recipeTextInput.trim() };
    }

    setIsScanLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Server error ${res.status}`);
      }
      const ingredients: RecipeIngredient[] = data.ingredients ?? [];
      setRecipeIngredients(ingredients);
      setRecipeName(data.recipeName ?? null);
      setRecipeChecked(new Set(ingredients.map((_, i) => i)));
      setView('recipe-review');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Import failed. Please try again.');
    } finally {
      setIsScanLoading(false);
    }
  };

  const toggleRecipeItem = (index: number) => {
    setRecipeChecked(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleRecipeConfirm = () => {
    const selected = recipeIngredients
      .filter((_, i) => recipeChecked.has(i))
      .map(ing => ({ name: ing.name, quantity: ing.quantity, recipeName }));
    if (onAddRecipeItems) {
      onAddRecipeItems(selected);
    }
    onClose();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        onAddItems(lines);
        onClose();
      } else {
        setScanError('Clipboard is empty — copy your list into buffer, then tap Paste a list.');
      }
    } catch {
      setScanError('Clipboard access denied. Use "Type item" and paste there.');
    }
  };

  const handleTypeEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && typeInput.trim()) {
      onAddItems([typeInput.trim()]);
      setTypeInput('');
    }
  };

  const handleProductConfirm = (item: string) => {
    if (capturedPhoto && onAddItemWithPhoto) {
      onAddItemWithPhoto(item, capturedPhoto);
    } else {
      onAddItems([item]);
    }
    onClose();
  };

  const handleListConfirm = (items: string[]) => {
    if (capturedPhoto && onAddItemWithPhoto && items.length > 0) {
      items.forEach(item => onAddItemWithPhoto(item, capturedPhoto));
    } else {
      onAddItems(items);
    }
    onClose();
  };

  if (!isOpen) return null;

  // Full-screen overlays render outside the sheet
  if (view === 'product-confirm') {
    return (
      <ProductConfirm
        item={productDraft}
        photo={capturedPhoto ?? undefined}
        onConfirm={handleProductConfirm}
        onCancel={() => setView('menu')}
      />
    );
  }

  if (view === 'list-review') {
    return (
      <ListReview
        items={scannedItems}
        onConfirm={handleListConfirm}
        onCancel={() => setView('menu')}
      />
    );
  }

  if (view === 'recipe-review') {
    const selectedCount = recipeChecked.size;
    return (
      <div className="list-review-overlay">
        <div className="list-review">
          <h3>{recipeName ?? "Review Ingredients"}</h3>
          <ul className="list-review-items">
            {recipeIngredients.map((ing, i) => (
              <li
                key={i}
                className={`list-review-item${recipeChecked.has(i) ? ' list-review-item--checked' : ''}`}
                onClick={() => toggleRecipeItem(i)}
              >
                <span className="list-review-checkbox">
                  {recipeChecked.has(i) ? '✓' : ''}
                </span>
                <span>
                  <span>{ing.name}</span>
                  {ing.quantity && (
                    <span style={{ display: 'block', fontSize: '0.8em', opacity: 0.6, fontWeight: 'normal' }}>
                      {ing.quantity}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="list-review-actions">
            <button onClick={() => setView('recipe')}>Back</button>
            <button
              className="btn-primary"
              onClick={handleRecipeConfirm}
              disabled={selectedCount === 0}
            >
              Add {selectedCount} item{selectedCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bottom-sheet-overlay" onClick={onClose} />
      <div className="bottom-sheet">
        {/* Hidden file input for recipe photo capture */}
        <input
          ref={recipePhotoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleRecipePhotoFileChange}
        />

        {view === 'menu' && (
          <>
            <h3 className="bottom-sheet-title">Add items</h3>
            {isScanLoading && <p className="scan-loading">Analyzing your photo — please wait…</p>}
            {scanError && <p className="scan-error">{scanError}</p>}
            <CameraCapture
              onCapture={handleCapture}
              productTriggerRef={productTriggerRef}
              listTriggerRef={listTriggerRef}
            />
            <button className="bottom-sheet-option" onClick={() => { setScanError(null); setView('type'); }}>
              <span className="bottom-sheet-option__icon">⌨️</span>
              <span>Type an item</span>
            </button>
            <button className="bottom-sheet-option" onClick={handlePaste}>
              <span className="bottom-sheet-option__icon">📋</span>
              <span>Paste a list<br/><small style={{opacity: 0.6, fontWeight: 'normal'}}>Copy your list first, then tap here</small></span>
            </button>
            <button className="bottom-sheet-option" onClick={() => { setScanError(null); productTriggerRef.current?.(); }}>
              <span className="bottom-sheet-option__icon">📷</span>
              <span>Scan a product</span>
            </button>
            <button className="bottom-sheet-option" onClick={() => { setScanError(null); listTriggerRef.current?.(); }}>
              <span className="bottom-sheet-option__icon">📝</span>
              <span>Scan a list</span>
            </button>
            <button className="bottom-sheet-option" onClick={() => { setScanError(null); setView('recipe'); }}>
              <span className="bottom-sheet-option__icon">🍽️</span>
              <span>Add from Recipe</span>
            </button>
            <button className="bottom-sheet-option bottom-sheet-option--cancel" onClick={onClose}>
              Cancel
            </button>
          </>
        )}

        {view === 'type' && (
          <>
            <h3 className="bottom-sheet-title">Type an item</h3>
            <input
              type="text"
              className="sheet-type-input"
              value={typeInput}
              onChange={(e) => setTypeInput(e.target.value)}
              onKeyDown={handleTypeEnter}
              placeholder="Type item and press Enter"
              autoFocus
            />
            <p className="hint">Press Enter to add each item. Tap Done when finished.</p>
            <button className="btn-primary" style={{ marginTop: '0.75rem' }} onClick={onClose}>Done</button>
          </>
        )}

        {view === 'recipe' && (
          <>
            <h3 className="bottom-sheet-title">Add from Recipe</h3>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {(['photo', 'url', 'text'] as RecipeSubMode[]).map((mode) => (
                <button
                  key={mode}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    background: recipeSubMode === mode ? '#333' : 'transparent',
                    color: recipeSubMode === mode ? '#fff' : 'inherit',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                  onClick={() => { setRecipeSubMode(mode); setScanError(null); }}
                >
                  {mode === 'photo' ? '📷 Photo' : mode === 'url' ? '🔗 URL' : '✏️ Text'}
                </button>
              ))}
            </div>

            {isScanLoading && <p className="scan-loading">Importing recipe…</p>}
            {scanError && <p className="scan-error">{scanError}</p>}

            {recipeSubMode === 'photo' && !isScanLoading && (
              <button
                className="bottom-sheet-option"
                onClick={() => { setScanError(null); recipePhotoInputRef.current?.click(); }}
              >
                <span className="bottom-sheet-option__icon">📷</span>
                <span>Take a photo of the recipe</span>
              </button>
            )}

            {recipeSubMode === 'url' && (
              <>
                <input
                  type="url"
                  className="sheet-type-input"
                  value={recipeUrlInput}
                  onChange={(e) => setRecipeUrlInput(e.target.value)}
                  placeholder="https://example.com/recipe"
                  disabled={isScanLoading}
                  autoFocus
                />
                <button
                  className="btn-primary"
                  style={{ marginTop: '0.75rem' }}
                  onClick={handleRecipeImport}
                  disabled={isScanLoading || !recipeUrlInput.trim()}
                >
                  {isScanLoading ? 'Importing…' : 'Import'}
                </button>
              </>
            )}

            {recipeSubMode === 'text' && (
              <>
                <textarea
                  className="sheet-type-input"
                  value={recipeTextInput}
                  onChange={(e) => setRecipeTextInput(e.target.value)}
                  placeholder="Paste recipe text here…"
                  rows={6}
                  disabled={isScanLoading}
                  style={{ resize: 'vertical', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
                  autoFocus
                />
                <button
                  className="btn-primary"
                  style={{ marginTop: '0.75rem' }}
                  onClick={handleRecipeImport}
                  disabled={isScanLoading || !recipeTextInput.trim()}
                >
                  {isScanLoading ? 'Importing…' : 'Import'}
                </button>
              </>
            )}

            <button
              className="bottom-sheet-option bottom-sheet-option--cancel"
              style={{ marginTop: '0.75rem' }}
              onClick={() => setView('menu')}
            >
              Back
            </button>
          </>
        )}
      </div>
    </>
  );
}
