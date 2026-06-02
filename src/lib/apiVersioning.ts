// API Versioning utilities
// Supports semantic versioning and backward compatibility

export interface APIVersion {
  major: number;
  minor: number;
  patch: number;
}

type APIHandler = (...args: unknown[]) => unknown;

export interface APIEndpoint {
  path: string;
  versions: {
    [version: string]: {
      handler: APIHandler;
      deprecated?: boolean;
      deprecatedAt?: string;
      sunsetAt?: string;
    };
  };
  defaultVersion: string;
}

class APIVersionManager {
  private endpoints: Map<string, APIEndpoint> = new Map();
  private currentVersion: APIVersion = { major: 1, minor: 0, patch: 0 };

  // Register an API endpoint with version support
  registerEndpoint(endpoint: APIEndpoint) {
    this.endpoints.set(endpoint.path, endpoint);
  }

  // Get the appropriate handler for an endpoint and version
  getHandler(path: string, requestedVersion?: string): APIHandler | null {
    const endpoint = this.endpoints.get(path);
    if (!endpoint) return null;

    // If no version specified, use default
    const version = requestedVersion || endpoint.defaultVersion;

    // Check if the requested version exists
    if (endpoint.versions[version]) {
      const versionInfo = endpoint.versions[version];

      // Check if version is deprecated
      if (versionInfo.deprecated) {
        console.warn(`API endpoint ${path} version ${version} is deprecated. ` +
                    `Deprecated at: ${versionInfo.deprecatedAt || 'unknown'}. ` +
                    `Sunset at: ${versionInfo.sunsetAt || 'unknown'}. ` +
                    `Please migrate to version ${endpoint.defaultVersion}.`);
      }

      return versionInfo.handler;
    }

    // Try to find a compatible version (backward compatibility)
    return this.findCompatibleVersion(endpoint, version);
  }

  private findCompatibleVersion(endpoint: APIEndpoint, requestedVersion: string): APIHandler | null {
    const requested = this.parseVersion(requestedVersion);
    if (!requested) return null;

    // Find the highest version that is backward compatible
    const compatibleVersions = Object.keys(endpoint.versions)
      .map(v => ({ version: this.parseVersion(v), original: v }))
      .filter(v => v.version !== null)
      .filter(v => this.isBackwardCompatible(v.version!, requested))
      .sort((a, b) => this.compareVersions(b.version!, a.version!));

    if (compatibleVersions.length > 0) {
      const compatibleVersion = compatibleVersions[0];
      console.log(`Using compatible version ${compatibleVersion.original} for requested version ${requestedVersion}`);
      return endpoint.versions[compatibleVersion.original].handler;
    }

    return null;
  }

  private parseVersion(version: string): APIVersion | null {
    const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return null;

    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3])
    };
  }

  private isBackwardCompatible(available: APIVersion, requested: APIVersion): boolean {
    // Major version must match for backward compatibility
    if (available.major !== requested.major) return false;

    // Available version should be >= requested version
    return this.compareVersions(available, requested) >= 0;
  }

  private compareVersions(a: APIVersion, b: APIVersion): number {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
  }

  // Extract version from request headers or URL
  extractVersion(request: Request): string | undefined {
    // Check Accept header (e.g., application/vnd.api.v1+json)
    const acceptHeader = request.headers.get('Accept');
    if (acceptHeader) {
      const versionMatch = acceptHeader.match(/vnd\.api\.v(\d+\.\d+\.\d+)/);
      if (versionMatch) return versionMatch[1];
    }

    // Check custom header
    const versionHeader = request.headers.get('X-API-Version');
    if (versionHeader) return versionHeader;

    // Check URL path (e.g., /api/v1/endpoint)
    const url = new URL(request.url);
    const pathMatch = url.pathname.match(/^\/api\/v(\d+\.\d+\.\d+)\//);
    if (pathMatch) return pathMatch[1];

    return undefined;
  }

  // Middleware for API versioning
  middleware(request: Request): Response | null {
    const version = this.extractVersion(request);

    if (version) {
      // Add version to request for handlers to use
      (request as any).apiVersion = version;
    }

    return null; // Continue to next middleware
  }

  // Get all registered endpoints
  getEndpoints(): APIEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  // Deprecate a version
  deprecateVersion(path: string, version: string, sunsetAt?: string) {
    const endpoint = this.endpoints.get(path);
    if (endpoint && endpoint.versions[version]) {
      endpoint.versions[version].deprecated = true;
      endpoint.versions[version].deprecatedAt = new Date().toISOString();
      if (sunsetAt) {
        endpoint.versions[version].sunsetAt = sunsetAt;
      }
    }
  }
}

// Export singleton instance
export const apiVersionManager = new APIVersionManager();

// Alias used by workorders/route.ts and enterprise.ts
export const apiVersioning = {
  getVersionFromRequest(request: Request): string {
    return apiVersionManager.extractVersion(request) || '1.0.0';
  },
  isVersionSupported(_version: string): boolean {
    return true; // All versions currently supported
  },
  getSupportedVersions(): string[] {
    return ['1.0.0'];
  },
  setDefaultVersion(_version: string): void {
    // no-op for now
  },
  addVersion(_version: string, _config: Record<string, unknown>): void {
    // no-op for now
  },
  getStats(): Record<string, unknown> {
    return { currentVersion: '1.0.0', supportedVersions: ['1.0.0'] };
  },
};

// Helper function to create versioned API responses
export function createVersionedResponse(data: any, version: string, metadata?: any) {
  return {
    data,
    apiVersion: version,
    timestamp: new Date().toISOString(),
    ...metadata
  };
}

// Helper function to handle version negotiation
export function negotiateVersion(requestedVersion: string | undefined, supportedVersions: string[]): string {
  if (!requestedVersion) return supportedVersions[0];

  // Exact match
  if (supportedVersions.includes(requestedVersion)) {
    return requestedVersion;
  }

  // Try semantic versioning compatibility
  const requested = apiVersionManager['parseVersion'](requestedVersion);
  if (!requested) return supportedVersions[0];

  for (const supported of supportedVersions) {
    const supportedParsed = apiVersionManager['parseVersion'](supported);
    if (supportedParsed && apiVersionManager['isBackwardCompatible'](supportedParsed, requested)) {
      return supported;
    }
  }

  return supportedVersions[0];
}