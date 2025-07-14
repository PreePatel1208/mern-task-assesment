//@ts-nocheck
"use server";

import { sql } from "kysely";
import { DEFAULT_PAGE_SIZE } from "../../constant";
import { db } from "../../db";
import { InsertProducts, UpdateProducts } from "@/types";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/utils/authOptions";
import { cache } from "react";

import Joi from "joi";
import Categories from "@/app/categories/page";

// 1. Define Joi validation schema
const productSchema = Joi.object({
  name: Joi.string().required().messages({
    "any.required": "Product name is required",
    "string.empty": "Product name cannot be empty",
  }),
  id: Joi.number().messages({
    "number.base": "Id must be a number",
  }),
  description: Joi.string().required().messages({
    "any.required": "Product description is required",
    "string.empty": "Description cannot be empty",
  }),
  rating: Joi.number().messages({
    "any.required": "Rating is required",
    "number.base": "Rating must be a number",
  }),
  old_price: Joi.number().required().messages({
    "any.required": "Old price is required",
    "number.base": "Old price must be a number",
  }),
  discount: Joi.number().required().messages({
    "any.required": "Discount is required",
    "number.base": "Discount must be a number",
  }),
  colors: Joi.string().required().messages({
    "any.required": "Colors are required",
  }),
  gender: Joi.string()
    .valid("men", "women", "boy", "girl")
    // .required()
    .messages({
      "any.required": "Gender is required",
      "any.only": "Gender must be one of men, women, boy, or girl",
    }),
  brands: Joi.array()
    .items(
      Joi.object({
        value: Joi.number().required(),
        label: Joi.string().required(),
      })
    )
    .min(1)
    .required()
    .messages({
      "any.required": "At least one brand must be selected",
      "array.base": "Brands must be an array of brand objects",
      "array.min": "Select at least one brand",
    }),

  occasion: Joi.array()
    .items(
      Joi.object({
        value: Joi.string().required(),
        label: Joi.string().required(),
      })
    )
    .min(1)
    .required()
    .messages({
      "any.required": "At least one brand must be selected",
      "array.base": "Brands must be an array of occasion objects",
      "array.min": "Select at least one occasion",
    }),
  categories: Joi.array()
    .items(
      Joi.object({
        value: Joi.number().required(),
        label: Joi.string().required(),
      })
    )
    .min(1)
    .required()
    .messages({
      "any.required": "At least one brand must be selected",
      "array.base": "Brands must be an array of occasion objects",
      "array.min": "Select at least one occasion",
    }),

  image_url: Joi.string().messages({
    "any.required": "Image URL is required",
  }),
});

interface CreateProductPayload {
  name: string;
  description: string;
  price: number;
  rating: number;
  old_price: number;
  discount: number;
  colors: string;
  gender: "men" | "women" | "boy" | "girl";
  brands: { value: number; label: string }[];
  occasion: { value: string; label: string }[];
  image_url: string;
}


export async function createProduct(value: CreateProductPayload) {
  const { error } = productSchema.validate(value);
  if (error) return { error: error.details[0].message };

  const price = Number(
    (value.old_price - (value.old_price * value.discount) / 100).toFixed(2)
  );

  const brandIdsArray = value.brands.map((b) => b.value);
  const brandIdsStr = JSON.stringify(brandIdsArray);
  const occasionIds = value.occasion.map((o) => o.value).join(",");
  const { categories, ...rest } = value;

  try {
    await db.transaction().execute(async (trx) => {
      const result = await trx
        .insertInto("products")
        .values({
          ...rest,
          brands: brandIdsStr,
          occasion: occasionIds,
          price,
        })
        .executeTakeFirst();

      const productId = result?.insertId;
      console.log("product id", productId);

      if (!productId) throw new Error("Product insert failed");
      const productCategoryRows = categories.map((cat) => ({
        product_id: productId,
        category_id: Number(cat.value),
      }));

      await trx
        .insertInto("product_categories")
        .values(productCategoryRows)
        .execute();
    });

    revalidatePath("/products");

    return { message: "Product created successfully" };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function editProduct(
  value: CreateProductPayload & { id: number }
) {

  const { error } = productSchema.validate(value);
  if (error) return { error: error.details[0].message };

  const price = Number(
    (value.old_price - (value.old_price * value.discount) / 100).toFixed(2)
  );

  const brandIdsStr = JSON.stringify(value.brands.map((b) => b.value));
  const occasionIds = value.occasion.map((o) => o.value).join(",");

  const { categories, id, ...rest } = value;
  console.log("value.id", value);

  try {
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("products")
        .set({
          ...rest,
          brands: brandIdsStr,
          occasion: occasionIds,
          price,
        })
        .where("id", "=", id)
        .execute();

      await trx
        .deleteFrom("product_categories")
        .where("product_id", "=", id)
        .execute();

      if (categories.length > 0) {
        const newLinks = categories.map((cat) => ({
          product_id: id,
          category_id: Number(cat.value), // cast if INT PK
        }));

        await trx.insertInto("product_categories").values(newLinks).execute();
      }
    });

    revalidatePath("/products");

    return { message: "Product updated successfully" };
  } catch (err: any) {
    return { error: err.message };
  }
}



// export async function getProducts(pageNo = 1, pageSize = DEFAULT_PAGE_SIZE) {
//   try {
//     let products;
//     let dbQuery = db.selectFrom("products").selectAll("products");

//     const { count } = await dbQuery
//       .select(sql`COUNT(DISTINCT products.id) as count`)
//       .executeTakeFirst();

//     const lastPage = Math.ceil(count / pageSize);

//     products = await dbQuery
//       .distinct()
//       .offset((pageNo - 1) * pageSize)
//       .limit(pageSize)
//       .execute();

//     const numOfResultsOnCurPage = products.length;

//     return { products, count, lastPage, numOfResultsOnCurPage };
//   } catch (error) {
//     throw error;
//   }
// }

export async function getProducts({
  pageNo = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  sortBy,
  sortOrder = "asc",
  selectedBrands = [],
  selectedCategories = [],
  minPrice = 0,
  maxPrice = 999999,
  gender,
  occasions,
  discount,
}: {
  pageNo: number;
  pageSize: number;
  sortBy?: "price" | "rating" | "name";
  sortOrder?: "asc" | "desc";
  selectedBrands?: number[];
  selectedCategories?: number[];
  minPrice?: number;
  maxPrice?: number;
  gender?: string;
  occasions?: string;
  discount?: number;
}) {
  try {
    let dbQuery = db.selectFrom("products").selectAll();

    if (selectedBrands.length > 0) {
      const likeClauses: string[] = [];

      for (const id of selectedBrands) {
        likeClauses.push(
          `products.brands LIKE '[${id},%'`,
          `products.brands LIKE '%,${id},%'`,
          `products.brands LIKE '%,${id}]'`,
          `products.brands = '[${id}]'`
        );
      }

      const rawSql = likeClauses.join(" OR ");

      dbQuery = dbQuery.where(sql`${sql.raw(rawSql)}`);
    }

    if (selectedCategories.length > 0) {
      dbQuery = dbQuery.where((eb) =>
        eb("products.id", "in",
          db
            .selectFrom("product_categories")
            .select("product_id")
            .where("category_id", "in", selectedCategories)
        )
      );
    }
if(maxPrice){

  dbQuery = dbQuery.where("products.price", "<=", maxPrice);
}

    if (gender && gender.toLowerCase() !== "none") {
      dbQuery = dbQuery.where("products.gender", "=", gender.toLowerCase());
    }

    if (occasions && occasions.trim() !== "") {
      // Break the incoming string into individual tokens
      const occasionList = occasions
        .split(",")
        .map((o) => o.trim())
        .filter((o) => o.length > 0);

      if (occasionList.length > 0) {
        const occasionClauses = occasionList.flatMap((val) => [
          `products.occasion LIKE '${val},%'`,   
          `products.occasion LIKE '%,${val},%'`, 
          `products.occasion LIKE '%,${val}'`,   
          `products.occasion = '${val}'`
        ]);

        const occasionRawSql = occasionClauses.join(" OR ");

        dbQuery = dbQuery.where(sql`${sql.raw(occasionRawSql)}`);
      }
    }
    console.log("SQL Preview:", dbQuery.compile().sql);

    if (discount) {
      dbQuery = dbQuery.where("products.discount", ">=", discount);
    }

    if (sortBy) {
      const [sort, order] = sortBy.split("-");
      dbQuery = dbQuery.orderBy(`products.${sort}`, order);
    }

    // ✅ Total count for pagination
    const { count } = await dbQuery
      .clearSelect()
      .select(sql`COUNT(DISTINCT products.id) as count`)
      .executeTakeFirst();

    const lastPage = Math.ceil(count / pageSize);

    // ✅ Actual paginated product list
    const products = await dbQuery
      .distinct()
      .offset((pageNo - 1) * pageSize)
      .limit(pageSize)
      .execute();

    const numOfResultsOnCurPage = products.length;

    return { products, count, lastPage, numOfResultsOnCurPage };
  } catch (error) {
    console.error("Error in getProducts:", error);
    throw error;
  }
}


export const getProduct = cache(async function getProduct(productId: number) {
  // console.log("run");
  try {
    const product = await db
      .selectFrom("products")
      .selectAll()
      .where("id", "=", productId)
      .execute();

    return product;
  } catch (error) {
    return { error: "Could not find the product" };
  }
});

async function enableForeignKeyChecks() {
  await sql`SET foreign_key_checks = 1`.execute(db);
}

async function disableForeignKeyChecks() {
  await sql`SET foreign_key_checks = 0`.execute(db);
}

export async function deleteProduct(productId: number) {
  try {
    await disableForeignKeyChecks();
    await db
      .deleteFrom("product_categories")
      .where("product_categories.product_id", "=", productId)
      .execute();
    await db
      .deleteFrom("reviews")
      .where("reviews.product_id", "=", productId)
      .execute();

    await db
      .deleteFrom("comments")
      .where("comments.product_id", "=", productId)
      .execute();

    await db.deleteFrom("products").where("id", "=", productId).execute();

    await enableForeignKeyChecks();
    revalidatePath("/products");
    return { message: "success" };
  } catch (error) {
    return { error: "Something went wrong, Cannot delete the product" };
  }
}

export async function MapBrandIdsToName(brandsId) {
  const brandsMap = new Map();
  try {
    for (let i = 0; i < brandsId.length; i++) {
      const brandId = brandsId.at(i);
      const brand = await db
        .selectFrom("brands")
        .select("name")
        .where("id", "=", +brandId)
        .executeTakeFirst();
      brandsMap.set(brandId, brand?.name);
    }
    return brandsMap;
  } catch (error) {
    throw error;
  }
}

export async function getAllProductCategories(products: any) {
  try {
    const productsId = products.map((product) => product.id);
    const categoriesMap = new Map();

    for (let i = 0; i < productsId.length; i++) {
      const productId = productsId.at(i);
      const categories = await db
        .selectFrom("product_categories")
        .innerJoin(
          "categories",
          "categories.id",
          "product_categories.category_id"
        )
        .select("categories.name")
        .where("product_categories.product_id", "=", productId)
        .execute();
      categoriesMap.set(productId, categories);
    }
    return categoriesMap;
  } catch (error) {
    throw error;
  }
}

export async function getProductCategories(productId: number) {
  try {
    const categories = await db
      .selectFrom("product_categories")
      .innerJoin(
        "categories",
        "categories.id",
        "product_categories.category_id"
      )
      .select(["categories.id", "categories.name"])
      .where("product_categories.product_id", "=", productId)
      .execute();

    return categories;
  } catch (error) {
    throw error;
  }
}
