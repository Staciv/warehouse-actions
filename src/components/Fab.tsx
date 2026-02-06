import type { PropsWithChildren } from 'react';

type FabProps = PropsWithChildren<{
  onClick: () => void;
  label: string;
}>;

export function Fab({ onClick, label, children }: FabProps) {
  return (
    <button className="fab" onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}
