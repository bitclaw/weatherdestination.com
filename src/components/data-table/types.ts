import '@tanstack/react-table';

declare module '@tanstack/react-table' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: module augmentation requires interface syntax
  interface ColumnMeta<TData, TValue> {
    className?: string;
    thClassName?: string;
    tdClassName?: string;
  }
}
