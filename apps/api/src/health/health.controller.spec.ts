import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('informa que a API está disponível', () => {
    const controller = new HealthController();

    expect(controller.getHealth()).toEqual({ status: 'ok' });
  });
});
