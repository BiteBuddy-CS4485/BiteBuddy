# BiteBuddy Backend

Next.js API backend serving REST endpoints for the BiteBuddy app.

## Getting Started

### Install Dependencies

```bash
npm install
```

### Run the Server

```bash
npm run dev
```

Server runs at **http://localhost:3000**

Test it: http://localhost:3000/api/health

---

## Example Project Structure

```
backend/
├── src/
│   └── app/
│       ├── api/                    # All API routes live here
│       │   ├── health/
│       │   │   └── route.ts        # GET /api/health
│       │   ├── auth/
│       │   │   └── login/
│       │   │       └── route.ts    # POST /api/auth/login
│       │   └── restaurants/
│       │       └── route.ts        # GET/POST /api/restaurants
│       └── layout.tsx              # Required by Next.js (don't delete)
├── next.config.ts                  # Next.js configuration
├── tsconfig.json                   # TypeScript configuration
└── package.json                    # Dependencies
```

---

## Adding API Endpoints

Next.js uses **file-based routing**. The folder structure = URL path.

### Basic Endpoint

Create `src/app/api/restaurants/route.ts`:

```ts
import { NextResponse } from 'next/server'

// GET /api/restaurants
export async function GET() {
  const restaurants = [
    { id: 1, name: 'Pizza Palace', cuisine: 'Italian' },
    { id: 2, name: 'Sushi Station', cuisine: 'Japanese' },
  ]
  return NextResponse.json(restaurants)
}

// POST /api/restaurants
export async function POST(request: Request) {
  const body = await request.json()
  // Save to database...
  return NextResponse.json({ success: true, data: body }, { status: 201 })
}
```

### Dynamic Routes (with URL parameters)

Create `src/app/api/restaurants/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'

// GET /api/restaurants/:id
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params
  // Fetch restaurant by id from database...
  return NextResponse.json({ id, name: 'Pizza Palace' })
}

// DELETE /api/restaurants/:id
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params
  // Delete from database...
  return NextResponse.json({ deleted: id })
}
```

---

## Route Mapping Reference

| File Path | HTTP Method | URL |
|-----------|-------------|-----|
| `api/health/route.ts` | GET | `/api/health` |
| `api/auth/login/route.ts` | POST | `/api/auth/login` |
| `api/auth/register/route.ts` | POST | `/api/auth/register` |
| `api/restaurants/route.ts` | GET, POST | `/api/restaurants` |
| `api/restaurants/[id]/route.ts` | GET, PUT, DELETE | `/api/restaurants/:id` |
| `api/groups/route.ts` | GET, POST | `/api/groups` |
| `api/groups/[id]/route.ts` | GET, PUT, DELETE | `/api/groups/:id` |
| `api/sessions/route.ts` | POST | `/api/sessions` |
| `api/sessions/[id]/swipe/route.ts` | POST | `/api/sessions/:id/swipe` |

---

## HTTP Methods

Export functions matching HTTP method names:

```ts
export async function GET() { }     // GET request
export async function POST() { }    // POST request
export async function PUT() { }     // PUT request
export async function PATCH() { }   // PATCH request
export async function DELETE() { }  // DELETE request
```

---

## Handling Request Data

### Query Parameters

```ts
// GET /api/restaurants?cuisine=italian
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cuisine = searchParams.get('cuisine')
  // ...
}
```

### Request Body (JSON)

```ts
// POST /api/restaurants
export async function POST(request: Request) {
  const body = await request.json()
  const { name, cuisine } = body
  // ...
}
```

### Headers

```ts
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  // ...
}
```

---

## Response Helpers

```ts
import { NextResponse } from 'next/server'

// Success
return NextResponse.json({ data: 'hello' })

// With status code
return NextResponse.json({ error: 'Not found' }, { status: 404 })

// Created
return NextResponse.json({ id: 1 }, { status: 201 })

// No content
return new NextResponse(null, { status: 204 })
```

---

## Installing New Packages

```bash
npm install package-name

# Example: Install Prisma for database
npm install prisma @prisma/client
```

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (hot reload) |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run lint` | Run ESLint |

---

## Testing Endpoints

### Using curl

```bash
# GET request
curl http://localhost:3000/api/health

# POST request with JSON body
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "123456"}'
```

### Using VS Code

Install the **REST Client** extension, create a `.http` file:

```http
### Health check
GET http://localhost:3000/api/health

### Login
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "123456"
}
```

---

## Resources

- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Next.js API Reference](https://nextjs.org/docs/app/api-reference)
