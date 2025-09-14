import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithTenant } from '../middleware/tenant.middleware';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithTenant>();
    return request.tenant;
  },
);

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithTenant>();
    return request.user;
  },
);












