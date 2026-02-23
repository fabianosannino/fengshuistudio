import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
```

**Ctrl+S** e no terminal:
```
git add .
git commit -m "disable middleware - usando client redirect"
git push origin master