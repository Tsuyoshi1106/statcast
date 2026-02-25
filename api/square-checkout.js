const { Client, Environment } = require('@square/web-sdk');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, userEmail } = req.body;

  const client = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: Environment.Sandbox
  });

  try {
    const response = await client.subscriptionsApi.createSubscription({
      idempotencyKey: `${userId}-${Date.now()}`,
      locationId: process.env.SQUARE_LOCATION_ID,
      planVariationId: process.env.SQUARE_PLAN_ID,
      customerId: userId,
      startDate: new Date().toISOString().split('T')[0],
    });

    res.status(200).json({ success: true, subscription: response.result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
