/**
 * Stripe Service
 */
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

const createCustomer = async (email, metadata = {}) => {
    if (!stripe) throw new Error('Stripe not configured');
    return stripe.customers.create({ email, metadata });
};

const createCheckoutSession = async (customerId, priceId, successUrl, cancelUrl, metadata = {}) => {
    if (!stripe) throw new Error('Stripe not configured');
    return stripe.checkout.sessions.create({ customer: customerId, mode: 'subscription', line_items: [{ price: priceId, quantity: 1 }], success_url: successUrl, cancel_url: cancelUrl, metadata });
};

const cancelSubscription = async (subscriptionId) => {
    if (!stripe) throw new Error('Stripe not configured');
    return stripe.subscriptions.cancel(subscriptionId);
};

const constructWebhookEvent = (payload, signature, secret) => {
    if (!stripe) throw new Error('Stripe not configured');
    return stripe.webhooks.constructEvent(payload, signature, secret);
};

module.exports = { createCustomer, createCheckoutSession, cancelSubscription, constructWebhookEvent };