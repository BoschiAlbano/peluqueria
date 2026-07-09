export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-center">
      <div className="w-full max-w-4xl text-start">
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="mt-5 w-full max-w-4xl space-y-4">{children}</div>
    </div>
  );
}
