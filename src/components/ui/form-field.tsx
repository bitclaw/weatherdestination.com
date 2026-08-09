import type { AnyFieldApi } from '@tanstack/react-form';

type FormFieldProps = {
  label: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
  optional?: boolean;
};

export function FormField({
  label,
  error,
  children,
  htmlFor,
  optional
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={htmlFor}>
        {label}
        {optional && (
          <span className="text-muted-foreground ml-1 font-normal">
            (optional)
          </span>
        )}
      </label>
      {children}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

export function FieldInfo({ field }: { field: AnyFieldApi }) {
  if (!field.state.meta.isTouched || field.state.meta.isValid) return null;
  return (
    <p className="text-destructive text-sm">
      {field.state.meta.errors.join(', ')}
    </p>
  );
}
