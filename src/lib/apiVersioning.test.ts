import { createVersionedResponse, negotiateVersion } from './apiVersioning';

describe('apiVersioning', () => {
  it('returns exact version when supported', () => {
    const supported = ['1.0.0', '1.1.0', '2.0.0'];
    expect(negotiateVersion('1.1.0', supported)).toBe('1.1.0');
  });

  it('falls back to first supported version for unsupported major', () => {
    const supported = ['1.0.0', '1.1.0'];
    expect(negotiateVersion('2.0.0', supported)).toBe('1.0.0');
  });

  it('builds a versioned response shape', () => {
    const payload = { ok: true };
    const response = createVersionedResponse(payload, '1.0.0', { source: 'test' });

    expect(response).toMatchObject({
      data: payload,
      apiVersion: '1.0.0',
      source: 'test',
    });
    expect(typeof response.timestamp).toBe('string');
  });
});
