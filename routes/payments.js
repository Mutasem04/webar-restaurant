/**
 * Payments Routes
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { userOps, planOps, transactionOps } = require('../database');

const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

router.get('/plans', (req, res) => {
    try {
        const plans = planOps.findAll.all();
        res.json({ success: true, plans: plans.map(p => ({ ...p, features: JSON.parse(p.features || '[]'), priceMonthly: p.price_monthly / 100, priceYearly: p.price_yearly / 100 })) });
    } catch (error) { res.status(500).json({ error: 'Failed to load plans' }); }
});

router.post('/checkout', authenticate, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Payments not configured' });
    try {
        const { planId, interval = 'monthly' } = req.body;
        const plan = planOps.findById.get(planId);
        if (!plan) return res.status(404).json({ error: 'Plan not found' });
        let customerId = req.user.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create({ email: req.user.email, metadata: { userId: req.user.id } });
            customerId = customer.id;
            userOps.updateStripeCustomer.run(customerId, req.user.id);
        }
        const priceId = interval === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly;
        if (!priceId) return res.status(400).json({ error: 'Price not configured' });
        const session = await stripe.checkout.sessions.create({ customer: customerId, mode: 'subscription', line_items: [{ price: priceId, quantity: 1 }], success_url: `${process.env.BASE_URL || 'http://localhost:3001'}/admin?success=true`, cancel_url: `${process.env.BASE_URL || 'http://localhost:3001'}/pricing?canceled=true`, metadata: { userId: req.user.id, planId } });
        res.json({ success: true, url: session.url });
    } catch (error) { console.error('Checkout error:', error); res.status(500).json({ error: 'Checkout failed' }); }
});

router.post('/webhook', async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Payments not configured' });
    const sig = req.headers['stripe-signature'];
    try {
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const { userId, planId } = session.metadata;
            const plan = planOps.findById.get(planId);
            if (plan && userId) {
                userOps.updatePlan.run(planId, plan.qr_limit, session.subscription, 'active', userId);
                transactionOps.create.run(uuidv4(), userId, session.payment_intent, session.amount_total, session.currency, 'completed', `Subscription: ${plan.name}`);
            }
        } else if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object;
            const user = userOps.findByStripeSubscription?.get(subscription.id);
            if (user) userOps.updatePlan.run('free', 3, null, 'inactive', user.id);
        }
        res.json({ received: true });
    } catch (error) { console.error('Webhook error:', error); res.status(400).json({ error: 'Webhook failed' }); }
});

router.get('/history', authenticate, (req, res) => {
    try {
        const transactions = transactionOps.findByUser.all(req.user.id);
        res.json({ success: true, transactions });
    } catch (error) { res.status(500).json({ error: 'Failed to load history' }); }
});

module.exports = router;