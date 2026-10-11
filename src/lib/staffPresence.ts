/**
 * One live-clock rule for manager dashboard, team, and assignments.
 * Clocked in means an open punch is still inside the live-shift window.
 * On a job is a separate fact: the person has an open assigned work order.
 * An assigned job does not by itself mean the person is clocked in.
 */

export type StaffPresence = {
  clockedIn: boolean;
  onJob: boolean;
  /** off | clocked-in | clocked-in-on-job */
  kind: 'off' | 'clocked-in' | 'clocked-in-on-job';
};

export function staffPresence(input: {
  clockedIn?: boolean | null;
  onJob?: boolean | null;
}): StaffPresence {
  const clockedIn = input.clockedIn === true;
  const onJob = input.onJob === true;
  const kind = !clockedIn ? 'off' : onJob ? 'clocked-in-on-job' : 'clocked-in';
  return { clockedIn, onJob, kind };
}

/** Words already used on the manager screens. Clock and job stay separate. */
export function staffStatusWords(input: {
  clockedIn?: boolean | null;
  onJob?: boolean | null;
}): { clock: 'Off' | 'Clocked in'; job: 'On job' | 'Available' } {
  const presence = staffPresence(input);
  return {
    clock: presence.clockedIn ? 'Clocked in' : 'Off',
    job: presence.onJob ? 'On job' : 'Available',
  };
}
