import type { Request, Response, NextFunction } from 'express'
import { log } from '../logger.js'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  log.error({ err, path: _req.path, method: _req.method }, 'Request error')
  res.status(500).json({
    error: err.message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  })
}
