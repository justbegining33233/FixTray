export type SetupStepId = 'agreement' | 'license' | 'insurance' | 'stripe';

export type SetupStep = { id: SetupStepId; label: string; done: boolean };

export function shopSetupSteps(input: {
  agreementAccepted?: boolean;
  businessLicense?: string | null;
  insurancePolicy?: string | null;
  stripeConnected?: boolean;
}): SetupStep[] {
  return [
    { id: 'agreement', label: 'Participation agreement', done: input.agreementAccepted === true },
    { id: 'license', label: 'Business license', done: Boolean(String(input.businessLicense || '').trim()) },
    { id: 'insurance', label: 'Insurance policy', done: Boolean(String(input.insurancePolicy || '').trim()) },
    { id: 'stripe', label: 'Stripe payouts', done: input.stripeConnected === true },
  ];
}

export function remainingSetupSteps(input: Parameters<typeof shopSetupSteps>[0]): SetupStep[] {
  return shopSetupSteps(input).filter((step) => !step.done);
}
