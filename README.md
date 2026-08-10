RiderX2

RiderX2 is a mobile-first ride, delivery and rider-partner platform project inspired by modern ride-hailing applications.

The project is being developed as a complete platform with three connected experiences:

- Customer App
- Rider App
- Admin Panel

RiderX2 uses a premium Black + Yellow interface and is designed around real-time ride operations, maps, authentication, rider availability, booking, earnings and platform administration.

«Development status: RiderX2 is actively under development. Some features require additional Firebase configuration, backend rules, testing and production integration before they should be considered production-ready.»

---

🚕 RiderX2 Services

The platform is designed to support:

- 🏍️ Bike Taxi
- 🚕 Cab
- 📦 Parcel Delivery
- 🍔 Food Delivery

The service architecture is intended to allow additional services to be added later without creating duplicate application structures.

---

👤 Customer App

The customer side is designed for users who want to book and manage rides or deliveries.

Customer Features

- Customer registration
- Customer login
- Role-based access
- Pickup location
- Destination location
- Map interface
- Fare estimation
- Ride booking
- Ride status
- Rider information
- Ride history
- Wallet
- Notifications
- Profile management
- Ride-related communication
- Payment options
- Location services

The customer interface is designed to provide a simple mobile-app-style booking experience.

---

🏍️ Rider App

The rider side is designed for driver/rider partners.

Rider Features

- Rider registration/login
- Rider profile
- Online/offline status
- Location permission
- Live rider location
- Incoming ride requests
- Accept ride
- Reject ride
- Active ride
- Pickup and destination
- Ride completion
- Ride history
- Earnings
- Wallet
- Notifications
- Map/navigation interface
- Customer communication

The rider application is designed around a real-time driver-partner workflow.

---

🛠️ Admin Panel

The Admin Panel is designed to provide centralized control over the RiderX platform.

Admin Areas

- Dashboard
- Customers
- Riders
- Support
- Settings
- Platform monitoring
- User management
- Rider management
- Ride-related administration

Admin access must be protected through proper authentication and role-based authorization.

---

🗺️ Maps & Location

RiderX2 uses Leaflet for map interfaces and is designed to work with OpenStreetMap-based map data.

Map functionality is intended to support:

- Current location
- Pickup marker
- Destination marker
- Rider marker
- Nearby riders
- Route display
- Live location tracking
- Map controls
- Ride navigation UI

Production map usage must follow the terms, attribution requirements and usage limits of the selected tile/data provider.

---

🔥 Firebase

Firebase is used as the main application backend layer.

The project can use Firebase services for areas such as:

- Authentication
- Firestore
- Realtime Database
- Storage
- User data
- Ride data
- Rider status
- Notifications/data synchronization

Firebase configuration is maintained in:

firebase/firebase-config.js

Important

Never put private service-account credentials, private keys or secret backend credentials into frontend files.

Firebase browser configuration is not a substitute for security rules. Authentication, Firestore/Realtime Database rules and access control must be correctly configured before production use.

---

📁 Project Structure

RiderX2 keeps the existing repository structure.

RiderX2/
│
├── admin/
│   ├── dashboard.html
│   ├── customers.html
│   ├── riders.html
│   ├── supports.html
│   └── settings.html
│
├── assets/
│
├── auth/
│
├── css/
│
├── customer/
│
├── firebase/
│   └── firebase-config.js
│
├── js/
│
├── rider/
│
├── index.html
├── manifest.json
├── sw.js
└── README.md

Folder Responsibilities

Folder| Purpose
"admin/"| Admin panel
"assets/"| Images and static assets
"auth/"| Authentication and role selection
"css/"| Application styles
"customer/"| Customer application
"firebase/"| Firebase configuration
"js/"| Shared application JavaScript
"rider/"| Rider application
"index.html"| Main application entry
"manifest.json"| PWA manifest
"sw.js"| Service worker
"README.md"| Project documentation

---

🎨 Design System

RiderX2 uses a premium dark interface.

Primary Brand

- Black
- Dark cards
- Yellow accent
- White text
- Muted gray text

UI Style

- Mobile-first layout
- App-style navigation
- Bottom navigation
- Cards
- Bottom sheets
- Modals
- Status badges
- Responsive layouts
- Touch-friendly controls
- Map-based interfaces

The main global styling is maintained through the existing CSS structure.

---

📱 Progressive Web App

RiderX2 contains:

manifest.json
sw.js

These files provide the foundation for PWA functionality.

For a production PWA:

- HTTPS is required.
- Manifest configuration must be valid.
- Required icons must exist.
- Service-worker registration must work.
- Service-worker paths must match the deployed structure.
- Offline behavior should be tested.

---

🔐 Authentication & Roles

RiderX2 uses role-based application areas.

The main roles are:

Customer
   ↓
Customer App

Rider
   ↓
Rider App

Admin
   ↓
Admin Panel

Users must not be able to access another role's protected functionality simply by changing a URL.

Role authorization should be enforced both:

1. In the frontend application.
2. In Firebase/backend security rules.

Frontend checks alone are not sufficient for production security.

---

💰 Fare & Pricing

RiderX2 is designed to support configurable fare calculation.

The pricing system can take factors such as:

- Service type
- Distance
- Time
- Day/night pricing
- Minimum fare
- Additional distance charges
- Other platform pricing rules

The actual production pricing rules should be maintained in the application/backend configuration rather than hard-coded in multiple pages.

---

💳 Payments

The platform is designed to support:

- Cash
- Online payment
- Wallet
- QR-based payment flows

Payment processing must use a proper payment provider/backend integration.

Secret payment credentials must never be exposed inside frontend JavaScript.

---

🔔 Notifications

RiderX2 is designed to support notifications for events such as:

- New ride request
- Ride accepted
- Rider arrival
- Ride started
- Ride completed
- Ride cancelled
- Payment updates
- Account notifications

Notification behavior depends on the application's Firebase/backend configuration and client permissions.

---

📍 Location Permissions

Location-based features require browser/device location permission.

The application should gracefully handle:

- Permission granted
- Permission denied
- Permission unavailable
- GPS disabled
- Location timeout
- Low accuracy

Users should never be shown a fake live location when the real location is unavailable.

---

💬 Ride Communication

The ride workflow is designed to support communication between customer and rider after an appropriate ride relationship has been established.

Possible communication features include:

- Chat
- Call action
- Ride status communication

Communication controls should not expose unnecessary personal information.

---

🧪 Testing

Before considering a feature complete, test it on real mobile browsers and desktop browsers.

Customer Testing

- [ ] Registration
- [ ] Login
- [ ] Logout
- [ ] Role routing
- [ ] Location permission
- [ ] Pickup selection
- [ ] Destination selection
- [ ] Fare calculation
- [ ] Ride request
- [ ] Rider assignment
- [ ] Ride status
- [ ] Cancellation
- [ ] Ride history
- [ ] Wallet
- [ ] Notifications

Rider Testing

- [ ] Registration
- [ ] Login
- [ ] Profile
- [ ] Location permission
- [ ] Online/offline status
- [ ] Ride request
- [ ] Accept ride
- [ ] Reject ride
- [ ] Pickup
- [ ] Start ride
- [ ] Complete ride
- [ ] Earnings
- [ ] Ride history
- [ ] Wallet
- [ ] Notifications

Admin Testing

- [ ] Admin login
- [ ] Authorization
- [ ] Dashboard
- [ ] Customer management
- [ ] Rider management
- [ ] Support
- [ ] Settings
- [ ] Logout

---

🛡️ Security

Security is a critical part of RiderX2.

Never commit:

Private keys
Service-account JSON files
Passwords
Payment secrets
OAuth secrets
Private tokens
Database passwords
Secret API credentials
.env files containing secrets

If a secret is accidentally exposed:

1. Revoke the credential.
2. Generate a replacement.
3. Remove the secret from the current code.
4. Check repository history.
5. Remove leaked secrets from history when necessary.
6. Update the application with the new credential.

Removing a secret from the latest commit does not automatically invalidate a credential that was already exposed.

---

🚀 Local Development

RiderX2 is a browser-based application.

It should be served through an HTTP server during development instead of opening HTML files directly using:

file://

For example, with Python:

python -m http.server 8000

Then open:

http://localhost:8000

The exact development environment may vary depending on the Firebase and deployment configuration.

---

🌐 Deployment

RiderX2 can be deployed as a static web application when its required backend services are configured.

Before deployment:

- [ ] Firebase configured
- [ ] Authentication configured
- [ ] Database rules reviewed
- [ ] Storage rules reviewed
- [ ] Maps tested
- [ ] HTTPS enabled
- [ ] PWA tested
- [ ] Mobile layout tested
- [ ] Customer flow tested
- [ ] Rider flow tested
- [ ] Admin authorization tested
- [ ] Payment integration tested
- [ ] Secrets removed
- [ ] Production error handling tested

---

🏙️ Initial Service Area

The RiderX project is being designed initially around Chandigarh and its intended operating area.

Location-based restrictions should be enforced through application/business logic rather than relying only on the map's visible area.

---

🧩 Development Rules

To keep RiderX2 maintainable:

- Preserve the existing repository structure.
- Keep folder and file names lowercase where already established.
- Do not create duplicate files for existing functionality.
- Reuse shared JavaScript modules.
- Reuse shared CSS.
- Keep Firebase configuration centralized.
- Keep authentication logic centralized.
- Test shared changes across Customer, Rider and Admin areas.
- Do not hard-code secrets.
- Do not claim unfinished functionality as production-ready.
- Fix existing files instead of creating parallel replacements.

---

🗺️ Development Roadmap

Phase 1 — Foundation

- [x] Project structure
- [x] Customer area
- [x] Rider area
- [x] Admin area
- [x] Authentication structure
- [x] Firebase integration structure
- [x] PWA foundation
- [x] Global UI system

Phase 2 — Core Ride System

- [ ] Complete customer booking flow
- [ ] Complete rider request flow
- [ ] Real-time ride state
- [ ] Rider assignment
- [ ] Pickup/drop flow
- [ ] Fare calculation
- [ ] Ride completion
- [ ] Cancellation handling

Phase 3 — Real-Time Platform

- [ ] Live rider location
- [ ] Nearby rider discovery
- [ ] Real-time map updates
- [ ] Ride status synchronization
- [ ] Customer/rider communication
- [ ] Notifications

Phase 4 — Payments & Wallet

- [ ] Cash flow
- [ ] Online payment integration
- [ ] Wallet
- [ ] Transaction history
- [ ] Payment verification

Phase 5 — Production

- [ ] Security audit
- [ ] Firebase rules audit
- [ ] Performance optimization
- [ ] Mobile testing
- [ ] PWA testing
- [ ] Error monitoring
- [ ] Production deployment
- [ ] Final customer/rider acceptance testing

---

📌 Current Status

RiderX2 is an active development project.

The repository currently provides the application structure and UI foundation for Customer, Rider and Admin experiences, while the complete real-time ride platform is being built and tested incrementally.

A feature should only be marked complete after its:

- UI
- JavaScript logic
- Firebase/backend integration
- Security rules
- Error handling
- Mobile behavior
- Real-world workflow

have been tested together.

---

⚠️ Important

RiderX2 is an independent project.

It is not affiliated with, endorsed by, or operated by Uber or Rapido.

The project may be inspired by common ride-hailing application patterns, but its branding, implementation and business logic are developed independently.

---

📄 License

No open-source license is currently specified for this repository.

Until a "LICENSE" file is added, the project should not be assumed to be freely redistributable or reusable under an open-source license.

---

👨‍💻 Project

RiderX2

Aiming to build a complete customer + rider + admin mobility platform with a strong mobile-first experience and real-time ride infrastructure.
