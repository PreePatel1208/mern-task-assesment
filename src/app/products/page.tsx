import { getProducts } from "@/actions/productActions";
import { DEFAULT_PAGE_SIZE } from "../../../constant";
import PaginationSection from "@/components/PaginationSection";
import SortBy from "@/components/SortBy";
import Filter from "@/components/Filter";
import ProductTable from "@/components/ProductTable";
import { Suspense } from "react";
import { getCategories } from "@/actions/categoryActions";
import { getBrands } from "@/actions/brandActions";

export default async function Products({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE, sortBy, brandId, categoryId, discount, gender, occasions, priceRangeTo } = searchParams as any;
  const selectedBrands = brandId
    ? brandId.split(",").map((id) => Number(id))
    : [];

  const selectedCategories = categoryId
    ? categoryId.split(",").map((id) => Number(id))
    : [];
let discountMin: number | undefined;
let discountMax: number | undefined;

if (discount) {
  const [minStr, maxStr] = discount.split("-").map((v) => v.trim());
  discountMin = Number(minStr);
  discountMax = maxStr !== undefined ? Number(maxStr) : undefined;
}
  // const discountValue = discount
  //   ? Number(discount.split("-")[0]) // Use starting range like 6 from "6-10"
  //   : undefined;

  const maxPrice = priceRangeTo ? Number(priceRangeTo) : 2000;

console.log("selectedBrands",selectedBrands);



  const { products, lastPage, numOfResultsOnCurPage, count } = await getProducts(
    {
      pageNo: +page,
      pageSize: +pageSize,
      sortBy,
      selectedBrands, selectedCategories, gender, occasions, maxPrice, discountMin,discountMax
    }
  );
  console.log("products, lastPage, numOfResultsOnCurPage,count", lastPage, numOfResultsOnCurPage, count);

  const brands = await getBrands();
  const categories = await getCategories();

  return (
    <div className="pb-20 pt-8">
      <h1 className="text-4xl mb-8">Product List</h1>
      <div className="mb-8">
        <SortBy />
        <div className="mt-4">
          <Filter categories={categories} brands={brands} />
        </div>
      </div>

      <h1 className="text-lg font-bold mb-4">Products</h1>
      <Suspense
        fallback={<p className="text-gray-300 text-2xl">Loading Products...</p>}
      >
        <ProductTable
          products={products}
          numOfResultsOnCurPage={numOfResultsOnCurPage}
        />
      </Suspense>
      {products.length > 0 && (
        <PaginationSection
          lastPage={lastPage}
          pageNo={+page}
          count={count}
          numOfResultsOnCurPage={numOfResultsOnCurPage}
          pageSize={+pageSize}
        />
      )}
    </div>
  );
}
