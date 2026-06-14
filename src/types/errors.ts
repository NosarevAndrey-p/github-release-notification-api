export class AppError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string) {
    super(message, 429);
  }
}

export class ServiceError extends AppError {
  constructor(message: string) {
    super(message, 500);
  }
}
