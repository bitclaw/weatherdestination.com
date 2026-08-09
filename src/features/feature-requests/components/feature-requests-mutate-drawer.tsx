import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type {
  FeatureRequestCategory,
  FeatureRequestPriority,
  FeatureRequestRecord,
  FeatureRequestStatus
} from '../feature-requests.constants';
import {
  categoryOptions,
  priorityOptions,
  statusOptions
} from './feature-requests-columns';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRow?: FeatureRequestRecord;
  onSubmit: (data: {
    title: string;
    description: string;
    status: FeatureRequestStatus;
    priority: FeatureRequestPriority;
    category: FeatureRequestCategory;
  }) => Promise<void>;
};

export function FeatureRequestsMutateDrawer({
  open,
  onOpenChange,
  currentRow,
  onSubmit
}: Props) {
  const isUpdate = !!currentRow;

  const [title, setTitle] = useState(currentRow?.title ?? '');
  const [description, setDescription] = useState(currentRow?.description ?? '');
  const [status, setStatus] = useState<FeatureRequestStatus>(
    currentRow?.status ?? 'submitted'
  );
  const [priority, setPriority] = useState<FeatureRequestPriority>(
    currentRow?.priority ?? 'medium'
  );
  const [category, setCategory] = useState<FeatureRequestCategory>(
    currentRow?.category ?? 'other'
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reset = () => {
    setTitle(currentRow?.title ?? '');
    setDescription(currentRow?.description ?? '');
    setStatus(currentRow?.status ?? 'submitted');
    setPriority(currentRow?.priority ?? 'medium');
    setCategory(currentRow?.category ?? 'other');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      await onSubmit({ title, description, status, priority, category });
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet
      onOpenChange={v => {
        if (!v) reset();
        onOpenChange(v);
      }}
      open={open}
    >
      <SheetContent className="flex flex-col">
        <SheetHeader className="text-start">
          <SheetTitle>
            {isUpdate ? 'Update' : 'Create'} Feature Request
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? 'Update request details then save.'
              : 'Describe the feature you want. Other users will be able to vote on it.'}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex-1 space-y-6 overflow-y-auto px-4 py-2"
          id="feature-request-form"
          onSubmit={handleSubmit}
        >
          <FormField htmlFor="fr-title" label="Title">
            <Input
              id="fr-title"
              onChange={e => setTitle(e.target.value)}
              placeholder="Short description of the feature"
              value={title}
            />
          </FormField>

          <FormField htmlFor="fr-description" label="Description (optional)">
            <Textarea
              className="min-h-24 resize-none"
              id="fr-description"
              onChange={e => setDescription(e.target.value)}
              placeholder="More detail about what you need and why..."
              value={description}
            />
          </FormField>

          {isUpdate && (
            <FormField htmlFor="fr-status" label="Status">
              <Select
                onValueChange={v => setStatus(v as FeatureRequestStatus)}
                value={status}
              >
                <SelectTrigger id="fr-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          <FormField htmlFor="fr-category" label="Category">
            <Select
              onValueChange={v => setCategory(v as FeatureRequestCategory)}
              value={category}
            >
              <SelectTrigger id="fr-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {isUpdate && (
            <FormField htmlFor="fr-priority" label="Priority">
              <RadioGroup
                className="flex flex-col space-y-1"
                id="fr-priority"
                onValueChange={v => setPriority(v as FeatureRequestPriority)}
                value={priority}
              >
                {priorityOptions.map(p => (
                  <label
                    className="flex cursor-pointer items-center gap-2"
                    htmlFor={`priority-${p.value}`}
                    key={p.value}
                  >
                    <RadioGroupItem
                      id={`priority-${p.value}`}
                      value={p.value}
                    />
                    <span className="text-sm font-normal">{p.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </FormField>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>

        <SheetFooter className="gap-2">
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button disabled={pending} form="feature-request-form" type="submit">
            {pending ? 'Saving...' : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
