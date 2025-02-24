import BorrowTable from "@/components/BorrowTable";

export default function BorrowPage() {
  return (
    <>
      <section className="flex flex-col gap-2">
        <h1 className="title-2">
          Borrow <span className="text-content-secondary">• Polygon</span>
        </h1>
        <p className="font-medium text-content-secondary">Borrow assets against your collateral.</p>
      </section>
      {/* <div>TODO: sumary</div> */}
      <BorrowTable />
    </>
  );
}
