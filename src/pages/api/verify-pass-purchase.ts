import type { APIRoute } from 'astro';

const FUNCTION_REGION = 'africa-south1';
const FUNCTION_NAME = 'verifyTournamentPassPurchase';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { idToken, eventId, purchase } = await request.json();

        if (!idToken || !eventId || !purchase?.platform || !purchase?.reference) {
            return json(400, {
                error: 'idToken, eventId, purchase.platform, and purchase.reference are required'
            });
        }

        const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;

        if (!projectId) {
            return json(500, { error: 'Firebase project ID is not configured' });
        }

        const functionUrl =
            import.meta.env.PASS_PURCHASE_SERVICE_URL ||
            `https://${FUNCTION_REGION}-${projectId}.cloudfunctions.net/${FUNCTION_NAME}`;

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: {
                    eventId,
                    purchase
                }
            })
        });

        const responseText = await response.text();
        const data = parseJson(responseText);

        if (!response.ok || data.error) {
            const isMissingFunction =
                response.status === 404 && responseText.includes('Page not found');

            return json(response.ok ? 400 : mapFunctionStatus(response.status), {
                error: isMissingFunction
                    ? `Backend function not found at ${functionUrl}`
                    :
                    data.error?.message ||
                    data.error?.status ||
                    data.error ||
                    'Could not complete this pass'
            });
        }

        return json(200, { result: data.result ?? null });
    } catch (error) {
        console.error('Verify pass purchase error:', error);

        return json(500, {
            error:
                error instanceof Error
                    ? error.message
                    : 'Could not complete this pass'
        });
    }
};

function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

function parseJson(text: string) {
    try {
        return JSON.parse(text);
    } catch {
        return {};
    }
}

function mapFunctionStatus(status: number) {
    if (status === 401 || status === 403) {
        return status;
    }

    return 502;
}
