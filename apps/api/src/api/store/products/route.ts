import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const productModuleService = req.scope.resolve(Modules.PRODUCT);
    const pricingModuleService = req.scope.resolve(Modules.PRICING);
    const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK);

    // Get query parameters for pagination and filtering
    const { limit = 20, offset = 0, category_id, q } = req.query;

    // Build filter object
    const filter: any = {
      status: "published",
    };

    if (category_id) {
      filter.category_id = category_id;
    }

    if (q) {
      filter.q = q;
    }

    // Start with minimal relations to avoid errors
    const [products, count] = await productModuleService.listAndCountProducts(
      filter,
      {
        take: Number(limit),
        skip: Number(offset),
        relations: ["variants", "categories", "images", "options"],
      }
    );

    // For each product, fetch variants and their prices separately
    const enrichedProducts = await Promise.all(
      products.map(async (product) => {
        try {
          // Get variants for this product
          const variants = await productModuleService.listProductVariants({
            product_id: product.id,
          });

          const options = await productModuleService.listProductOptions({
            product_id: product.id,
          });

          // Get prices for each variant
          const variantsWithPrices = await Promise.all(
            variants.map(async (variant) => {
              try {
                // Get the link service for variant to price set
                const linkService = remoteLink.getLinkModule(
                  Modules.PRODUCT,
                  "variant_id",
                  Modules.PRICING,
                  "price_set_id"
                );

                // Get price sets linked to this variant
                const variantPriceSetLinks = await linkService?.list({
                  variant_id: [variant.id],
                });

                // Get prices for the linked price sets
                const prices =
                  variantPriceSetLinks?.length &&
                  variantPriceSetLinks?.length > 0
                    ? await pricingModuleService.listPrices({
                        price_set_id: variantPriceSetLinks?.map(
                          (link: any) => link.price_set_id
                        ),
                      })
                    : [];

                return {
                  ...variant,
                  prices,
                };
              } catch (error) {
                console.error(
                  `Error fetching prices for variant ${variant.id}:`,
                  error
                );
                return variant;
              }
            })
          );

          const optionsWithValues = await Promise.all(
            options.map(async (option) => {
              try {
                const values =
                  await productModuleService.listProductOptionValues({
                    option_id: option.id,
                  });

                return {
                  ...option,
                  values,
                };
              } catch (error) {
                console.error(
                  `Error fetching options for product ${product.id}:`,
                  error
                );
                return option;
              }
            })
          );

          return {
            ...product,
            variants: variantsWithPrices,
            options: optionsWithValues,
          };
        } catch (error) {
          console.error(`Error enriching product ${product.id}:`, error);
          return product;
        }
      })
    );

    res.json({
      products: enrichedProducts,
      count,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    console.error("Error fetching products:", error);

    res.status(500).json({
      error: "Failed to fetch products",
      message: error instanceof Error ? error.message : "Unknown error",
      details: error,
    });
  }
}
