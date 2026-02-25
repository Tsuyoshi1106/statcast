const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

export const config = {
  api: {
    bodyParser: false,
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const sig = req.headers['stripe-signature'];
  let event;
  let rawBody = '';

  await new Promise((resolve, reject) => {
    req.on('data', chunk => { rawBody += chunk; });
    req.on('end', resolve);
    req.on('error', reject);
  });

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).json({ error: err.message });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata && session.metadata.userId;
    if (userId) {
      const { error } = await supabase
        .from('profiles')
        .update({ is_premium: true, premium_since: new Date().toISOString() })
        .eq('id', userId);
      console.log('Premium updated for:', userId, error ? error.message : 'OK');
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    try {
      const customer = await stripe.customers.retrieve(subscription.customer);
      if (customer.email) {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', customer.email);
        if (data && data.length > 0) {
          await supabase
            .from('profiles')
            .update({ is_premium: false })
            .eq('id', data[0].id);
        }
      }
    } catch(e) {
      console.error('Subscription delete error:', e.message);
    }
  }

  res.status(200).json({ received: true });
};
