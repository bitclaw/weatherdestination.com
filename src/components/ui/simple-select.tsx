import { cn } from '@/lib/cn';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './select';

export type SimpleSelectItem = {
  value: string;
  label: string;
};

export type SimpleSelectProps = {
  placeholder: string;
  items: SimpleSelectItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
  // Fires when the menu opens; lets a caller lazy-load its items.
  onOpen?: () => void;
};

// Radix Select reserves "" for "no value" and throws on an item with
// value="", but filters commonly use "" for "All". Map it to a sentinel.
const EMPTY_VALUE = '__empty__';
const toRadix = (value: string) => (value === '' ? EMPTY_VALUE : value);
const fromRadix = (value: string) => (value === EMPTY_VALUE ? '' : value);

// Items-array convenience wrapper over the design-system Select, so
// highlight/selected colors come from the same tokens (bg-accent) as every
// other dropdown. Trigger sizing matches Combobox and form inputs.
export const SimpleSelect = ({
  placeholder,
  items,
  value,
  onChange,
  className,
  id,
  disabled,
  onOpen
}: SimpleSelectProps) => {
  const hasEmptyItem = items.some(item => item.value === '');
  return (
    <Select
      disabled={disabled}
      onOpenChange={open => {
        if (open) onOpen?.();
      }}
      onValueChange={v => onChange(fromRadix(v))}
      // Without an "" item, "" means nothing picked: show the placeholder.
      value={value === '' && !hasEmptyItem ? '' : toRadix(value)}
    >
      <SelectTrigger
        className={cn(
          'h-auto w-full rounded-md bg-background px-3 py-2 data-[size=default]:h-auto',
          className
        )}
        id={id}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {/* Always open downward, like Combobox on the create page. Radix would
          flip upward when space below is short; the DS content already caps
          its height to the available space and scrolls instead. */}
      <SelectContent
        avoidCollisions={false}
        position="popper"
        side="bottom"
        sideOffset={4}
      >
        {items.map(item => (
          <SelectItem key={item.value} value={toRadix(item.value)}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
