/**
 * Where a Capacitor cold launch should go after the bundled intro.
 * The website never plays that video. The native page navigates to
 * /auth/login?from=intro, and this decides login vs the role dashboard.
 */

export type IntroTokenClaims = {
  role?: string;
  exp?: number;
};

export type IntroSession = {
  role: string;
  exp?: number;
  shopProfileComplete: boolean;
};

const ROLE_DASHBOARD: Record<string, string> = {
  admin: '/admin/home',
  superadmin: '/admin/home',
  manager: '/manager/home',
  tech: '/tech/home',
  customer: '/customer/dashboard',
};

/** Role home for a still-valid session, or null when the login screen should stay. */
export function introHandoffPath(session: IntroSession | null, now = Date.now()): string | null {
  if (!session?.role) return null;
  if (typeof session.exp === 'number' && now >= session.exp * 1000) return null;
  if (session.role === 'shop') {
    return session.shopProfileComplete ? '/shop/home' : '/shop/complete-profile';
  }
  return ROLE_DASHBOARD[session.role] ?? null;
}

export function readIntroSession(
  storage: { getItem(key: string): string | null },
  decode: (token: string) => IntroTokenClaims | null,
): IntroSession | null {
  const token = storage.getItem('token');
  if (!token) return null;
  const claims = decode(token);
  if (!claims) return null;
  const role = claims.role || storage.getItem('userRole') || '';
  if (!role) return null;
  return {
    role,
    exp: claims.exp,
    shopProfileComplete: storage.getItem('shopProfileComplete') === 'true',
  };
}

export type InstalledShellSignals = {
  userAgent?: string;
  cookie?: string;
  capacitorNative?: boolean;
  displayModeStandalone?: boolean;
  navigatorStandalone?: boolean;
};

/** The Capacitor app (user-agent or native cookie). A normal phone or desktop browser is false. */
export function isAppWebView(env: { userAgent?: string; cookie?: string } = {}): boolean {
  const ua = env.userAgent ?? '';
  const cookie = env.cookie ?? '';
  if (ua.includes('FixTray-Android-App') || ua.includes('FixTray-iOS-App')) return true;
  return /(?:^|;\s*)x-fixtray-native=/.test(cookie);
}

export function isAppWebViewClient(): boolean {
  if (typeof window === 'undefined') return false;
  return isAppWebView({ userAgent: navigator.userAgent, cookie: document.cookie });
}

/** App WebView or an installed home-screen icon. Ordinary browser tabs are false. */
export function isInstalledShellClient(env: InstalledShellSignals = readInstalledShellEnv()): boolean {
  if (env.capacitorNative) return true;
  if ((env.userAgent ?? '').includes('FixTray-Android-App')) return true;
  if (/(?:^|;\s*)x-fixtray-native=/.test(env.cookie ?? '')) return true;
  if (env.displayModeStandalone || env.navigatorStandalone) return true;
  return false;
}

function readInstalledShellEnv(): InstalledShellSignals {
  if (typeof window === 'undefined') return {};
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  let displayModeStandalone = false;
  try {
    displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    displayModeStandalone = false;
  }
  return {
    userAgent: navigator.userAgent,
    cookie: document.cookie,
    capacitorNative: typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform(),
    displayModeStandalone,
    navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
  };
}

/** Login, or the role dashboard when a stored session is still valid. */
export function installedShellLaunchPath(session: IntroSession | null, now = Date.now()): string {
  return introHandoffPath(session, now) ?? '/auth/login';
}

/** Client-side claim decode. The server still verifies the signature. */
export function decodeIntroClaims(token: string): IntroTokenClaims | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    let padded = part.replace(/-/g, '+').replace(/_/g, '/');
    while (padded.length % 4) padded += '=';
    const json = JSON.parse(atob(padded)) as { role?: unknown; exp?: unknown };
    return {
      role: typeof json.role === 'string' ? json.role : undefined,
      exp: typeof json.exp === 'number' ? json.exp : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Blocking bootstrap for `/`. Runs before the marketing page paints.
 * Does not add from=intro, so the website never plays the native intro.
 */
/**
 * Runs before paint. A stored desktop preference must not flash the computer
 * layout inside the Capacitor app, and the next open must recover stuck installs.
 */
export function appDesktopViewResetScript(): string {
  return `(function(){try{
    var ua=navigator.userAgent||'';
    var cookie=document.cookie||'';
    var app=ua.indexOf('FixTray-Android-App')!==-1||ua.indexOf('FixTray-iOS-App')!==-1||/(?:^|;\\s*)x-fixtray-native=/.test(cookie);
    if(app&&localStorage.getItem('viewMode')==='desktop') localStorage.removeItem('viewMode');
  }catch(e){}})();`;
}

export function installedShellBootstrapScript(): string {
  const dashboards = JSON.stringify(ROLE_DASHBOARD);
  return `(function(){try{
    if(location.pathname!=='/')return;
    var ua=navigator.userAgent||'';
    var cookie=document.cookie||'';
    var native=ua.indexOf('FixTray-Android-App')!==-1||/(?:^|;\\s*)x-fixtray-native=/.test(cookie);
    var cap=window.Capacitor;
    if(cap&&typeof cap.isNativePlatform==='function'&&cap.isNativePlatform())native=true;
    var standalone=false;
    try{standalone=window.matchMedia('(display-mode: standalone)').matches;}catch(e){}
    if(navigator.standalone===true)standalone=true;
    if(!native&&!standalone)return;
    var dest='/auth/login';
    try{
      var token=localStorage.getItem('token');
      if(token){
        var part=token.split('.')[1];
        if(part){
          var padded=part.replace(/-/g,'+').replace(/_/g,'/');
          while(padded.length%4)padded+='=';
          var json=JSON.parse(atob(padded));
          var role=json.role||localStorage.getItem('userRole')||'';
          var exp=json.exp;
          if(!(typeof exp==='number'&&Date.now()>=exp*1000)){
            var map=${dashboards};
            if(role==='shop'){
              dest=localStorage.getItem('shopProfileComplete')==='true'?'/shop/home':'/shop/complete-profile';
            }else if(map[role]){dest=map[role];}
          }
        }
      }
    }catch(e){}
    if(location.pathname!==dest)location.replace(dest);
  }catch(e){}})();`;
}
