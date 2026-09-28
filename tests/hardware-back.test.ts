import { hardwareBackAction } from '../src/components/AppNavigationGuard';

describe('hardware back', () => {
  it('closes an open sheet before moving', () => {
    expect(hardwareBackAction({
      overlayOpen: true,
      path: '/tech/jobs',
      home: '/tech/home',
      historyLength: 4,
    })).toBe('close');
  });

  it('exits only from a role home or login', () => {
    expect(hardwareBackAction({
      overlayOpen: false,
      path: '/tech/home',
      home: '/tech/home',
      historyLength: 3,
    })).toBe('exit');
    expect(hardwareBackAction({
      overlayOpen: false,
      path: '/auth/login',
      home: '/tech/home',
      historyLength: 1,
    })).toBe('exit');
  });

  it('goes back through history on a deep page', () => {
    expect(hardwareBackAction({
      overlayOpen: false,
      path: '/shop/jobs',
      home: '/shop/home',
      historyLength: 2,
    })).toBe('back');
  });

  it('opens the role home when a deep page has no history', () => {
    expect(hardwareBackAction({
      overlayOpen: false,
      path: '/manager/payroll',
      home: '/manager/home',
      historyLength: 1,
    })).toBe('home');
  });
});
