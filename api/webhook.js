const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const event = req.body;

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;

    await supabase
      .from('profiles')
      .update({ is_premium: true, premium_since: new Date().toISOString() })
      .eq('id', userId);
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customer = await stripe.customers.retrieve(subscription.customer);
    
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', customer.email)
      .single();
    
    if (data) {
      await supabase
        .from('profiles')
        .update({ is_premium: false })
        .eq('id', data.id);
    }
  }

  res.status(200).json({ received: true });
};
