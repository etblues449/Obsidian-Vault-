# Fincast Suite

Unified Fincast application suite - combines frontend, backend, and finance dashboard into a cohesive monorepo.

## Directory Structure

```
fincast-suite/
├── dashboard/           # Fincast Dashboard - Financial analytics UI
│   ├── .claude/        # Claude Code configuration
│   ├── SUPERSEDED.md   # Historical reference
│   └── finance-channel-app.jsx.txt
│
├── backend/            # Fincast Worker - Backend services (coming soon)
│   └── [backend code]
│
├── frontend/           # Faceless Finance App - Frontend application (coming soon)
│   └── [frontend code]
│
└── web-version/        # Faceless Finance Web - Web version (coming soon)
    └── [web code]
```

## Services

### Dashboard (`/dashboard`)
Financial analytics dashboard interface providing visual insights and metrics.

### Backend (`/backend`)
Worker services handling business logic, data processing, and API endpoints.

### Frontend (`/frontend`)
Web-based user interface for the Faceless Finance application.

### Web Version (`/web-version`)
Alternative web implementation of Faceless Finance.

## Development

Each service is independently developed and organized within its subdirectory. Services can be developed, tested, and deployed independently while sharing the monorepo structure.

### Setup

1. Clone the repository
2. Navigate to the desired service directory
3. Install dependencies and follow service-specific setup instructions

## Status

- ✅ Dashboard: Integrated
- ⏳ Backend: Pending merge
- ⏳ Frontend: Pending merge  
- ⏳ Web Version: Pending merge

## Notes

This monorepo consolidates multiple Fincast and Faceless Finance projects into a unified structure for easier management and cross-service development.

---

**Last Updated:** 2026-06-04
