export default function RestrictedRegionPage() {
  return (
    <div className="fixed inset-0 isolate z-[100] flex flex-col items-center justify-center gap-2 bg-background-primary p-6 text-center">
      <h1>Compound Blue Unavailable</h1>
      <p className="text-content-secondary">It seems you are trying to connect from a restricted region.</p>
    </div>
  );
}
