import DomainException from './HttpException';

export default class InternalServerException extends DomainException {
  constructor(param: { message?: string; throwable?: unknown } = {}) {
    super(
      param.message ?? 'Please contact your provider (Internal Server Error)!',
      param.throwable ?? null,
    );
  }
}
