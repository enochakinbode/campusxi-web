// src/pages/api/create-checkout.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
    try {
        const {
            idToken,
            eventId,
            eventKey,
            tier,
            paystackProductId
        } = await request.json();

        if (!idToken || !eventId || !eventKey || !tier || !paystackProductId) {
            return new Response(
                JSON.stringify({
                    error: 'idToken, eventId, eventKey, tier, and paystackProductId are required'
                }),
                { status: 400 }
            );
        }

        const verifyResponse = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${import.meta.env.PUBLIC_FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ idToken })
            }
        );

        const verifyData = await verifyResponse.json();

        if (!verifyResponse.ok || !verifyData.users?.length) {
            return new Response(
                JSON.stringify({ error: 'Invalid Firebase session' }),
                { status: 401 }
            );
        }

        const firebaseUser = verifyData.users[0];
        const userId = firebaseUser.localId;
        const email = firebaseUser.email;

        if (!email) {
            return new Response(
                JSON.stringify({ error: 'User email is required' }),
                { status: 400 }
            );
        }

        const productId = String(paystackProductId).trim();

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
            return new Response(
                JSON.stringify({
                    error: productData.message || 'Could not fetch Paystack product'
                }),
                { status: 400 }
            );
        }

        const product = productData.data;

        if (!product.active) {
            return new Response(
                JSON.stringify({ error: 'This product is not active' }),
                { status: 400 }
            );
        }

        const callbackUrl =
            `${new URL(request.url).origin}/complete-payment?eventId=${encodeURIComponent(eventId)}&tier=${encodeURIComponent(tier)}`;

        const checkoutResponse = await fetch(
            'https://api.paystack.co/transaction/initialize',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${import.meta.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    amount: product.price,
                    currency: product.currency || 'NGN',
                    callback_url: callbackUrl,
                    metadata: {
                        userId,
                        eventId,
                        eventKey,
                        tier,
                        paystackProductId: productId,
                        productName: product.name
                    }
                })
            }
        );

        const checkoutData = await checkoutResponse.json();

        if (!checkoutResponse.ok || !checkoutData.status) {
            return new Response(
                JSON.stringify({
                    error: checkoutData.message || 'Could not initialize checkout'
                }),
                { status: 400 }
            );
        }

        return new Response(
            JSON.stringify({
                authorization_url: checkoutData.data.authorization_url,
                access_code: checkoutData.data.access_code,
                reference: checkoutData.data.reference
            }),
            { status: 200 }
        );
    } catch (error) {
        console.error('Create checkout error:', error);

        return new Response(
            JSON.stringify({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Could not create checkout'
            }),
            { status: 500 }
        );
    }
};
