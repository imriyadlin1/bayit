export function PersonalSectionPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="leading-relaxed text-muted">{description}</p>
    </div>
  );
}
