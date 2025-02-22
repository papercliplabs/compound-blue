import Link from "next/link";

export default function Footer() {
  return (
    <footer className="flex w-full items-center justify-center justify-self-end">
      <div className="flex w-full max-w-screen-xl items-center justify-between p-6">
        <div>A Compound x Morpho x Polygon Collab.</div>
        <div className="flex items-center gap-4">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
