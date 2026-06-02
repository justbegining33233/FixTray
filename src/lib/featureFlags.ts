// Feature flag management system
// Supports environment variables, database flags, and A/B testing

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage?: number; // 0-100
  conditions?: FeatureFlagCondition[];
  description?: string;
}

export interface FeatureFlagCondition {
  type: 'user' | 'shop' | 'role' | 'environment';
  value: string | string[];
  operator: 'equals' | 'contains' | 'in' | 'not_in';
}

class FeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map();
  private userOverrides: Map<string, Map<string, boolean>> = new Map();

  constructor() {
    this.initializeFlags();
  }

  private initializeFlags() {
    // Define feature flags with default values
    const defaultFlags: FeatureFlag[] = [
      {
        name: 'advanced_analytics',
        enabled: process.env.FEATURE_ADVANCED_ANALYTICS === 'true',
        rolloutPercentage: 100,
        description: 'Advanced analytics dashboard with real-time metrics'
      },
      {
        name: 'ai_assistance',
        enabled: process.env.FEATURE_AI_ASSISTANCE === 'true',
        rolloutPercentage: 50,
        description: 'AI-powered work order suggestions and diagnostics'
      },
      {
        name: 'mobile_app',
        enabled: process.env.FEATURE_MOBILE_APP === 'true',
        rolloutPercentage: 100,
        description: 'Mobile application for technicians'
      },
      {
        name: 'automated_scheduling',
        enabled: process.env.FEATURE_AUTOMATED_SCHEDULING === 'true',
        rolloutPercentage: 25,
        description: 'AI-powered work order scheduling optimization'
      },
      {
        name: 'multi_language',
        enabled: process.env.FEATURE_MULTI_LANGUAGE === 'true',
        rolloutPercentage: 100,
        description: 'Multi-language support (i18n)'
      },
      {
        name: 'dark_mode',
        enabled: process.env.FEATURE_DARK_MODE === 'true',
        rolloutPercentage: 75,
        description: 'Dark mode theme support'
      },
      {
        name: 'advanced_reporting',
        enabled: process.env.FEATURE_ADVANCED_REPORTING === 'true',
        rolloutPercentage: 100,
        description: 'Advanced reporting and export capabilities'
      },
      {
        name: 'real_time_collaboration',
        enabled: process.env.FEATURE_REAL_TIME_COLLABORATION === 'true',
        rolloutPercentage: 90,
        description: 'Real-time collaboration features'
      }
    ];

    defaultFlags.forEach(flag => {
      this.flags.set(flag.name, flag);
    });
  }

  // Check if a feature is enabled for a user
  isEnabled(featureName: string, userContext?: {
    userId?: string;
    shopId?: string;
    role?: string;
    environment?: string;
  }): boolean {
    const flag = this.flags.get(featureName);
    if (!flag) return false;

    // Check user-specific overrides first
    if (userContext?.userId) {
      const userOverrides = this.userOverrides.get(userContext.userId);
      if (userOverrides?.has(featureName)) {
        return userOverrides.get(featureName)!;
      }
    }

    // Check conditions if they exist
    if (flag.conditions && userContext) {
      const conditionsMet = flag.conditions.every(condition =>
        this.evaluateCondition(condition, userContext)
      );
      if (!conditionsMet) return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage && flag.rolloutPercentage < 100) {
      if (userContext?.userId) {
        const hash = this.simpleHash(userContext.userId + featureName);
        const percentage = (hash % 100 + 100) % 100; // Ensure positive
        if (percentage >= flag.rolloutPercentage) {
          return false;
        }
      } else {
        // If no user context, use random rollout
        if (Math.random() * 100 >= flag.rolloutPercentage) {
          return false;
        }
      }
    }

    return flag.enabled;
  }

  private evaluateCondition(condition: FeatureFlagCondition, context: any): boolean {
    const contextValue = context[condition.type];

    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;
      case 'contains':
        return String(contextValue).includes(String(condition.value));
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(contextValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(contextValue);
      default:
        return false;
    }
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  // Admin methods to manage flags
  setFlag(featureName: string, enabled: boolean, rolloutPercentage?: number) {
    const flag = this.flags.get(featureName);
    if (flag) {
      flag.enabled = enabled;
      if (rolloutPercentage !== undefined) {
        flag.rolloutPercentage = rolloutPercentage;
      }
      this.flags.set(featureName, flag);
    }
  }

  addUserOverride(userId: string, featureName: string, enabled: boolean) {
    if (!this.userOverrides.has(userId)) {
      this.userOverrides.set(userId, new Map());
    }
    this.userOverrides.get(userId)!.set(featureName, enabled);
  }

  removeUserOverride(userId: string, featureName: string) {
    const userOverrides = this.userOverrides.get(userId);
    if (userOverrides) {
      userOverrides.delete(featureName);
    }
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  getFlag(featureName: string): FeatureFlag | undefined {
    return this.flags.get(featureName);
  }
}

// Export singleton instance
export const featureFlags = new FeatureFlagManager();

// React hook for using feature flags
export function useFeatureFlag(featureName: string, userContext?: any): boolean {
  // In a real implementation, this would use React context and re-render on flag changes
  return featureFlags.isEnabled(featureName, userContext);
}

// Server-side feature flag check
export function checkFeatureFlag(featureName: string, userContext?: any): boolean {
  return featureFlags.isEnabled(featureName, userContext);
}