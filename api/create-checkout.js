{
  "name": "statcast",
  "version": "1.0.0",
  "dependencies": {
    "stripe": "^14.0.0",
    "@supabase/supabase-js": "^2.0.0"
  }
}


const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { userEmail, userId } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: 'https://statcast-git-main-tsuyopons-projects.vercel.app?premium=success&userId=' + userId,
      cancel_url: 'https://statcast-git-main-tsuyopons-projects.vercel.app?premium=cancel',
      customer_email: userEmail,
      metadata: { userId: userId }
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
