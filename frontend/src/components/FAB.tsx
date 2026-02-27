interface FABProps {
  onClick: () => void;
  disabled?: boolean;
}

export function FAB({ onClick, disabled }: FABProps) {
  return (
    <button className="fab" onClick={onClick} disabled={disabled} aria-label="Add items">
      +
    </button>
  );
}
