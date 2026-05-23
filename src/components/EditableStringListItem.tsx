import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import InlineEditableText from './InlineEditableText';

export interface EditableStringListItemProps {
  value: string;
  onCommit: (next: string) => Promise<void>;
  onRemove: () => Promise<void>;
  textClassName?: string;
  chipClassName?: string;
}

const EditableStringListItem: React.FC<EditableStringListItemProps> = ({
  value,
  onCommit,
  onRemove,
  textClassName = 'text-sm md:text-[15px] text-white',
  chipClassName,
}) => (
  <span
    className={cn(
      'inline-flex max-w-full items-center gap-0.5 border border-white/15 bg-black/30 px-2.5 py-1',
      chipClassName
    )}
  >
    <InlineEditableText
      as="span"
      size="sm"
      textClassName={textClassName}
      value={value}
      onCommit={onCommit}
      className="min-w-0"
    />
    <button
      type="button"
      onClick={() => void onRemove()}
      className="inline-flex shrink-0 items-center justify-center rounded border border-white/25 p-1 text-white/70 hover:border-red-400/50 hover:text-red-300"
      aria-label="Quitar"
    >
      <X size={12} strokeWidth={2} />
    </button>
  </span>
);

export default EditableStringListItem;
