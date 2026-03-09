import { useState, useRef, useEffect } from "react";
import { CameraCapture } from "./CameraCapture.js";
import { ProductConfirm } from "./ProductConfirm.js";
import { ListReview } from "./ListReview.js";

type View = 'menu' | 'type' | 'product-confirm' | 'list-review';

interface AddItemSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItems: (items: string[]) => void;
  onAddItemWithPhoto?: (item: string, photo: string) => void;
}

export function AddItemSheet({ isOpen, onClose, onAddItems, onAddItemWithPhoto }: AddItemSheetProps) {
  const [view, setView] = useState<View>('menu');
  const [typeInput, setTypeInput] = useState('');
  const [isScanLoading, setIsScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedItems, setScannedItems] = useState<string[]>([]);
  const [productDraft, setProductDraft] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const productTriggerRef = useRef<(() => void) | null>(null);
  const listTriggerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isOpen) {
      setView('menu');
      setScanError(null);
      setTypeInput('');
      setCapturedPhoto(null);
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
        body: JSON.stringify({ image: base64, mode }),
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
    onAddItems(items);
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

  return (
    <>
      <div className="bottom-sheet-overlay" onClick={onClose} />
      <div className="bottom-sheet">
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
      </div>
    </>
  );
}
