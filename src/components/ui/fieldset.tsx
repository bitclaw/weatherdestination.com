import { ExternalLink } from 'lucide-react';

type FieldsetProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  learnMoreUrl?: string;
  learnMoreLabel?: string;
  onSave?: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  id?: string;
};

export function Fieldset({
  title,
  description,
  children,
  footer,
  learnMoreUrl,
  learnMoreLabel,
  onSave,
  saving,
  saveDisabled,
  id
}: FieldsetProps) {
  return (
    <div className="rounded-lg border" id={id}>
      <div className="space-y-4 p-6">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && (
            <p className="text-muted-foreground mt-1 text-sm">{description}</p>
          )}
        </div>
        {children}
      </div>
      {(footer || learnMoreUrl || onSave) && (
        <div className="bg-muted/30 flex items-center justify-between border-t px-6 py-3">
          <div className="text-muted-foreground text-xs">
            {footer}
            {learnMoreUrl && (
              <a
                className="text-primary inline-flex items-center gap-1 hover:underline"
                href={learnMoreUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {learnMoreLabel ?? 'Learn more'}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          {onSave && (
            <button
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-50"
              disabled={saving || saveDisabled}
              onClick={onSave}
              type="button"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
