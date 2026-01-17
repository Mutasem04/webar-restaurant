# WebAR Restaurant Platform

A production-ready WebAR platform for restaurants that allows owners to create augmented reality experiences for their menu items.

## Features

- 🎯 **Image Target Tracking** - Use menu photos as AR triggers
- 📱 **No App Required** - Works in mobile browsers via WebXR
- 🎬 **Rich AR Content** - Support for videos, images, and 3D models
- 📊 **Analytics Dashboard** - Track QR scans and AR views
- 💳 **Stripe Integration** - Subscription-based pricing
- 🔐 **JWT Authentication** - Secure user accounts
- 📧 **Email Notifications** - Welcome emails and QR ready alerts

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (better-sqlite3)
- **AR**: MindAR.js
- **Payments**: Stripe
- **Auth**: JWT + bcrypt

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

## Environment Variables

```env
PORT=3001
JWT_SECRET=your-secret-key
STRIPE_SECRET_KEY=sk_test_xxx
BASE_URL=http://localhost:3001
```

## API Documentation

Swagger docs available at `/api/docs`

## Deploy

Ready for Railway, Render, or any Node.js host.

## License

MIT