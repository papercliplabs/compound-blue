import EarnTable from "@/components/EarnTable";

export default async function EarnPage() {
  return (
    <>
      <section className="flex flex-col gap-2">
        <h1 className="title-2">
          Earn <span className="text-content-secondary">• Polygon</span>
        </h1>
        <p className="font-medium text-content-secondary">Earn yield on assets by lending them out.</p>
      </section>
      {/* <div>TODO: sumary</div> */}
      <EarnTable />
    </>
  );
}

export const revalidate = 60;
