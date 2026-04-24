export class ApiError extends Error {
    public readonly status: number;
    public readonly code?: string;
    public readonly body?: unknown;

    constructor(message: string, status: number, code?: string, body?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.body = body;
    }

    get isNetworkError(): boolean {
        return this.status === 0;
    }

    get isUnauthorized(): boolean {
        return this.status === 401;
    }

    get isForbidden(): boolean {
        return this.status === 403;
    }

    get isNotFound(): boolean {
        return this.status === 404;
    }

    get isConflict(): boolean {
        return this.status === 409 || this.status === 412;
    }

    get isServerError(): boolean {
        return this.status >= 500;
    }

    get isRetryable(): boolean {
        return this.isNetworkError || this.isServerError || this.status === 429;
    }
}

export function isApiError(err: unknown): err is ApiError {
    return err instanceof ApiError;
}
