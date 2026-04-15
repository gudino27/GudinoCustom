# Gudino Custom Woodworking

<div align="center">

<img src="https://img.shields.io/github/last-commit/gudino27/GudinoCustom?style=flat&logo=git&logoColor=white&color=0080ff" alt="last-commit">
<img src="https://img.shields.io/github/languages/top/gudino27/GudinoCustom?style=flat&color=0080ff" alt="top-language">
<img src="https://img.shields.io/github/languages/count/gudino27/GudinoCustom?style=flat&color=0080ff" alt="language-count">

<img src="https://img.shields.io/badge/React-61DAFB.svg?style=flat&logo=React&logoColor=black" alt="React">
<img src="https://img.shields.io/badge/Three.js-000000.svg?style=flat&logo=three.js&logoColor=white" alt="Three.js">
<img src="https://img.shields.io/badge/Swift-FA7343.svg?style=flat&logo=Swift&logoColor=white" alt="Swift">
<img src="https://img.shields.io/badge/Express-000000.svg?style=flat&logo=Express&logoColor=white" alt="Express">
<img src="https://img.shields.io/badge/SQLite-003B57.svg?style=flat&logo=SQLite&logoColor=white" alt="SQLite">
<img src="https://img.shields.io/badge/Docker-2496ED.svg?style=flat&logo=Docker&logoColor=white" alt="Docker">
<img src="https://img.shields.io/badge/GNU%20Bash-4EAA25.svg?style=flat&logo=GNU-Bash&logoColor=white" alt="Bash">

</div>

---

## Overview

A full business operations platform for Gudino Custom Woodworking, a cabinet contracting company in Washington. What started as a customer-facing kitchen designer has grown into a complete system covering the entire business: client design tools, a 360° virtual showroom with AR export, a native Swift iOS admin app with full feature parity, invoicing, time clock and payroll, appointment booking, SMS/push notifications, Instagram integration, bilingual support, and a zero-downtime self-hosted deployment pipeline.

**Live:** [gudinocustom.com](https://gudinocustom.com)

---

## 3D & Visualization

This is the most technically complex part of the platform, built entirely with Three.js and React Three Fiber.

### Virtual Showroom

A 360° panoramic showroom viewer that lets clients explore the physical space before visiting:

- **PanoramaSphere:** renders an inverted sphere (radius 500) with an equirectangular panorama texture. Texture is horizontally flipped (`repeat.x = -1`) for correct inside-sphere viewing using `THREE.BackSide` material
- **PanoramaControls:** fully custom spherical camera controller using `THREE.Spherical` for yaw/pitch navigation — not OrbitControls. Supports pointer drag, scroll-to-zoom (FOV clamped 30°–120°), two-finger pinch zoom, auto-rotate with inactivity detection, and smooth lerp interpolation per frame
- **Material Swapping:** clients click on surfaces (cabinets, countertops, flooring) in the panorama and swap materials in real time. `SwappableOverlay` uses ear-clipping triangulation to map polygon regions defined by UV coordinates onto the sphere, with two modes: polygon masks (arbitrary shapes) and bounding box planes. Handles UV seam wrapping at u=0/u=1
- **3D Hotspots:** `ShowroomHotspots3D` renders interactive markers using `@react-three/drei` Billboard + Html. Four types: info (amber), link to designer (green), room navigation (blue), material link (purple). Includes hover tooltips and pulsing ring animations
- **Admin Polygon Tool:** `AdminPanoramaPreview` lets admins draw material swap regions directly in 3D by clicking on the panorama sphere. Click positions are converted back to UV coordinates via `positionToUV()` and saved as `polygon_points` on the element. Draw mode disables OrbitControls while preserving FOV zoom
- **Room Navigation:** supports dropdown, arrow, and minimap (thumbnail) navigation styles between panorama rooms

### Room Designer 3D

While placing cabinets, clients can switch between 2D and a live 3D view:

- **DesignEditor3D:** core Three.js scene with `TransformControls` for drag-to-move cabinet placement. Renders cabinet bodies, countertops, shaker door panels with inset detail, handles (cylinders), crown molding on tall cabinets, and drawer line detail. `CameraController` exposes `setWallView(n)` for instant wall-facing camera presets (eye height 66", view distance 24" from center)
- **Designer3D:** full-screen 3D editor overlay with material controls: paint swatches, wood stain swatches, grain type selector, finish/sheen selector, and appliance finish swatches
- **DesignPreview3D:** lightweight 400px 3D preview with OrbitControls, used inline in the 2D designer

### AR Viewer

- **ARSceneExporter:** renders an off-screen Three.js scene and exports it as a `.glb` binary via `GLTFExporter`. Handles corner cabinets as L-shapes, standard cabinets, and marble countertops
- **ARViewer:** displays the exported model in a `<model-viewer>` web component with WebXR + iOS Quick Look AR modes. Includes a download button for the `.glb` file

---

## iOS App (GCWadmin)

A fully native Swift iOS admin app with complete feature parity to the web admin panel. Built with iOS 26 Liquid Glass design language (`GlassView`, `GlassButton`, `ShimmerEffect`).

**Authentication:** Face ID biometric login with APNs push notifications for real-time alerts on new testimonials, invoices, and design submissions.

**Features:**
- Dashboard with live business metrics
- Design inbox: review and manage client-submitted kitchen/bathroom designs
- Photo management: upload and organize portfolio photos by category
- Price management: update cabinet, material, and color pricing
- Employee management: profiles and team display order
- User management: invite users via multi-channel delivery, manage roles and permissions
- Time clock: admin live view, employee clock-in/out with breaks, calendar view, manual entry, audit trails, hours reports, paycheck calculator, payroll settings
- Invoice management: create invoices, track payments, send receipts via SMS and email
- Appointment management: view/reschedule bookings, manage availability, add blocked time
- Project timeline manager
- Testimonial management with push notification alerts
- Instagram manager (Graph API)
- Analytics dashboard with traffic and geographic data
- SMS routing manager
- Security monitor
- Showroom manager
- Bilingual support (English/Spanish) via `LanguageManager.swift`

---

## Customer Platform

### For Clients

- **Virtual Showroom:** immersive 360° panorama viewer with real-time material swapping — see how different cabinet finishes, countertops, and flooring look in the actual showroom before committing
- **3D Room Designer:** design kitchens and bathrooms in 3D with drag-and-drop cabinet placement, real-time pricing, material and finish selection, and wall elevation views
- **AR Export:** export any design as a `.glb` file and view it in augmented reality on iOS (Quick Look) or Android (Scene Viewer)
- **PDF Quote:** download an itemized quote with notes and preferences
- **Design Submission:** completed designs are saved and sent to the team with an email notification
- **Appointment Booking:** schedule consultations directly through the site
- **Before/After Portfolio:** slider and carousel views of completed projects
- **Hardware Catalog:** browse available hardware options
- **Testimonials:** submit and view customer reviews
- **Bilingual:** full English and Spanish support throughout

### For the Business

- **Dynamic Pricing:** update cabinet, material, and color prices in real time without code changes
- **Portfolio Management:** upload and organize project photos and videos by category
- **Design Inbox:** review all submitted client designs with full contact information
- **Invoice System:** create invoices, track payment status, send receipts via email or SMS
- **Time Clock:** employee clock-in/out, break tracking, payroll calculations, audit trails
- **Appointment System:** manage availability, handle booking requests and reschedules
- **Project Timelines:** track project milestones and communicate progress via SMS
- **Instagram Integration:** manage and display Instagram content (Graph API)
- **Analytics:** page views, unique visitors, geographic distribution via GeoLite2
- **Security Monitor:** track suspicious activity and rate limit events
- **Team Management:** employee profiles, role-based access control, user invitations
- **Google Reviews:** integrated review display

---

## Backend

A modular Express.js API with route-level separation for every feature domain:

```
cabinet-photo-server/routes/
├── admin/          invoices, testimonials
├── analytics.js    GeoLite2 IP geolocation, page view tracking
├── appointments.js booking, availability, reschedule requests
├── auth.js         JWT, registration, password reset, invitations
├── designs.js      client design submissions
├── employees.js    team profiles
├── instagram.js    Graph API integration
├── invoices.js     invoice CRUD, payment tracking
├── photos.js       portfolio uploads (Sharp image processing)
├── pricing.js      cabinet/material/color pricing
├── push-tokens.js  APNs device token registration
├── showroom.js     panorama rooms, elements, materials
├── testimonials.js reviews + push notification triggers
├── timeclock.js    clock-in/out, breaks, payroll
├── timelines.js    project timeline SMS updates
└── uploads/        file handling
```

**Services:** Twilio SMS, APNs push notifications, Nodemailer email, Puppeteer PDF generation, fluent-ffmpeg video processing, MaxMind GeoLite2 geolocation

---

## Deployment

Zero-downtime blue-green deployment on self-hosted bare metal with Cloudflare Tunnels:

```
Cloudflare Tunnel
      │
      ▼
Nginx Reverse Proxy + Let's Encrypt SSL (Certbot)
      │
   ┌──┴──┐
   ▼     ▼
Frontend  Backend API / SQLite
(React)   (Express.js)
```

**Build:** Docker Buildx Bake (`docker-bake.hcl`) builds frontend and backend images in parallel with layer caching, reducing build time from ~30 minutes to ~3–5 minutes (85–90% reduction).

**Deploy:** `docker-compose.deploy.yml` spins up new containers (`backend-new`, `frontend-new`) on alternate ports (3002, 8080) alongside the live stack, sharing the same Docker network and external volumes. Once health checks pass, traffic switches and old containers are torn down — no downtime.

**Scripts:**
- `manage.sh`: full deployment orchestration (fast-build, deploy, rollback, backup, restore, health-check)
- `manage-bake.sh`: Docker Bake-specific build and deploy workflow
- `scripts/`: deployment validator, fresh-start, analytics init, manual backup/restore

---

## Project Structure

```
GudinoCustom/
├── IOS/GCWadmin/              # Native Swift iOS admin app
│   ├── Features/              # Analytics, Appointments, Auth, Dashboard, Designs,
│   │                          # Employees, Instagram, Invoices, Photos, Pricing,
│   │                          # Security, Showroom, SMS, Testimonials, TimeClock,
│   │                          # Timelines, UserManagement
│   ├── Models/                # Swift data models
│   ├── Services/API/          # Per-feature API service classes
│   └── Core/                  # GlassView, GlassButton, ShimmerEffect, design tokens
│
├── kitchen-designer/          # React web frontend
│   └── src/
│       ├── components/
│       │   ├── showroom/      # ThreeShowroomViewer, PanoramaSphere, PanoramaControls,
│       │   │                  # ShowroomHotspots3D, SwappableOverlay, MaterialSwapPanel
│       │   ├── design/        # DesignEditor3D, Designer3D, DesignPreview3D,
│       │   │                  # ARViewer, ARSceneExporter
│       │   ├── admin/         # AdminPanel, TimeClockManager, InvoiceManager,
│       │   │                  # ShowroomManager, InstagramManager, AnalyticsDashboard, ...
│       │   ├── portfolio/     # Carousel3D, BeforeAfterSlider, GridView
│       │   └── pages/         # Home, About, Contact, Portfolio, HardwareCatalog,
│       │                      # AppointmentBooking, WhyChooseUs, ...
│       ├── contexts/          # LanguageContext, PricingContext
│       ├── hooks/designer/    # useDesignerState, useElementManagement, useRoomManagement, ...
│       └── utils/             # translations.js (EN/ES), designHelpers, collisionUtils, ...
│
├── cabinet-photo-server/      # Express.js + SQLite backend
│   ├── routes/                # Per-feature route modules (see Backend section)
│   ├── middleware/            # auth, rate-limiters, upload, validation
│   ├── services/              # notification-service (email + SMS + push)
│   └── utils/                 # email, sms, pdf-generator, push-notifications,
│                              # geolocation, password-validation, receipt-generator
│
├── docker-compose.yml         # Production stack (backend + frontend + nginx + certbot)
├── docker-compose.deploy.yml  # Zero-downtime blue-green deployment
├── docker-compose.tunnel.yml  # Cloudflare Tunnel service
├── docker-bake.hcl            # Buildx Bake: parallel builds with layer caching (HCL)
├── manage.sh                  # Deployment orchestration
├── manage-bake.sh             # Bake workflow
├── scripts/                   # Deployment utilities
├── data/geolite2/             # MaxMind GeoLite2 City database
├── app.json / eas.json        # Retained for future Android app via Expo
└── sitemap.xml                # SEO
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web Frontend | React 18, Tailwind CSS, React Router |
| 3D / WebGL | Three.js, React Three Fiber, React Three Drei, `@google/model-viewer` (AR) |
| Mobile | Swift (native iOS), iOS 26 Liquid Glass, APNs |
| Backend | Node.js, Express 4, SQLite (sqlite3 + better-sqlite3) |
| Auth | JWT, bcryptjs, session management, Face ID (iOS) |
| Notifications | Twilio SMS, APNs push notifications, Nodemailer email |
| Media | Multer uploads, Sharp image processing, fluent-ffmpeg video |
| PDF | Puppeteer, jsPDF |
| Analytics | MaxMind GeoLite2, chart.js |
| Social | Instagram Graph API |
| Infrastructure | Docker, Docker Buildx Bake, Cloudflare Tunnels, Nginx, Let's Encrypt, self-hosted Linux |

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- Docker and Docker Compose

### Development

```bash
git clone https://github.com/gudino27/GudinoCustom
cd GudinoCustom

# Backend
cd cabinet-photo-server
cp .env.example .env
npm install
node init-database.js
node server.js

# Frontend (separate terminal)
cd kitchen-designer
npm install
npm start
```

### Production

```bash
# Build all images in parallel (~3-5 min)
bash manage-bake.sh build

# Zero-downtime deploy
bash manage.sh deploy

# Rollback if needed
bash manage.sh rollback
```

See `.env.example` for required environment variables.

---

## Future Enhancements

- Android companion app via Expo (foundation retained in `app.json` / `eas.json`)
- Supplier catalog integration

---

## License

MIT. See [LICENSE](LICENSE) for details.
