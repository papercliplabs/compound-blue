import EarnTable from "@/components/EarnTable";

export default async function EarnPage() {
  return (
    <>
      <section>
        <h1>Earn</h1>
        <p>Earn yield on assets by lending them out.</p>
      </section>
      <EarnTable />
    </>
  );
}

// export const revalidate = 60;
