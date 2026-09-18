import 'server-only'

/** A fresh technical ID, never copied from a client-provided header or user ID. */
export function comCorrelacao(handler: (request: Request, correlationId: string) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const correlationId = crypto.randomUUID()
    const response = await handler(request, correlationId)
    response.headers.set('X-Request-ID', correlationId)
    return response
  }
}
