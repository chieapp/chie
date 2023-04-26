export class AbortError extends Error {
  name = 'AbortError';
}

type APIErrorCode = 'refresh' | 'other';

export class APIError extends Error {
  name = 'APIError';
  code: APIErrorCode;

  constructor(message: string, code: APIErrorCode = 'other') {
    super(message);
    this.code = code;
  }
}

export class NetworkError extends Error {
  name = 'NetworkError';
}
