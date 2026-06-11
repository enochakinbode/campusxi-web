import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
    try {

        console.log("PAYSTACK_SECRET_KEY:", import.meta.env.PAYSTACK_SECRET_KEY?.slice(0, 8));
        const { paystackProductIds } = await request.json();

        if (!Array.isArray(paystackProductIds) || paystackProductIds.length === 0) {
            return new Response(
                JSON.stringify({ error: 'paystackProductIds is required' }),
                { status: 400 }
            );
        }

        const uniqueProductIds = [
            ...new Set(
                paystackProductIds
                    .map((id) => String(id ?? '').trim())
                    .filter(Boolean)
            )
        ];

        console.log("Product IDs received:", uniqueProductIds);
        console.log("Has Paystack key:", Boolean(import.meta.env.PAYSTACK_SECRET_KEY));

        const products = await Promise.all(
            uniqueProductIds.map(async (productId) => {
                const productResponse = await fetch(
                    `https://api.paystack.co/product/${productId}`,
                    {
                        headers: {
                            Authorization: `Bearer ${import.meta.env.PAYSTACK_SECRET_KEY}`
                        }
                    }
                );

                const productData = await productResponse.json();

                if (!productResponse.ok || !productData.status) {
                    throw new Error(
                        productData.message || `Failed to fetch Paystack product ${productId}`
                    );
                }

                const product = productData.data;

                return {
                    paystackProductId: productId,
                    name: product.name,
                    price: product.price / 100,
                    priceInSubunit: product.price,
                    currency: product.currency || 'NGN',
                    active: product.active
                };
            })
        );

        const productsById = products.reduce(
            (acc, product) => {
                acc[product.paystackProductId] = product;
                return acc;
            },
            {} as Record<string, any>
        );

        return new Response(
            JSON.stringify({
                products,
                productsById
            }),
            { status: 200 }
        );
    } catch (error) {
        console.error('Paystack product prices error:', error);

        return new Response(
            JSON.stringify({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Could not load Paystack product prices'
            }),
            { status: 500 }
        );
    }
};