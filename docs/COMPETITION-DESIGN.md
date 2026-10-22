# Competition upgrade: review before activation

Existing app: Next.js App Router, React, MongoDB replica-set transactions; session authentication with admin/player roles. The validated domain engine owns all league writes; notifications persist in the same transaction and are delivered asynchronously. Teams are reciprocal partner groups rather than a separate team collection. Legacy weekly roles are manual; accepted challenges enter scheduling directly. Legacy confirmed results can immediately swap/leapfrog individual positions, and vacations freeze ranking.

The new managed competition is opt-in. Existing challenges, results, partner assignments, seasons and weekly publications are preserved. Team identity is the sorted immutable member-ID key, with member snapshots. Partners/divisions/rankings must not change during an unsettled managed publication. Historical schedules retain their own snapshots.

Conflicts and defaults resolved before implementation:

- First/final special weeks have effective type OPEN_ATTACK; special is a boundary designation, not a contradictory third role system. Future overrides remain explicit.
- Rotation is soft in new managed weeks, unlike legacy required roles. Champion/title eligibility and upward distance remain hard.
- Approved absences prevent matches and do not freeze the whole ranking or manufacture duplicate positions. Legacy vacations retain legacy behavior.
- A real postponed commitment can recover with explicit administrator approval, including a court-availability postponement without absence. Administrators may require an approved absence with recovery permission globally or per league; that extra restriction defaults to off. Cancelling an unaccepted challenge does not manufacture a recoverable match.
- Managed official results are recorded immediately but direct swaps settle explicitly at round closure, in ascending scheduled time then stable match ID order. Normal disjoint pairs commute; recovery matches can overlap, so the deterministic order is audited.
- Existing unapproved legacy matches are not retrospectively declared official publications. New publication creates explicit publication metadata. Private drafts never create player-visible Challenge records.
- Accepted challenges that become invalid remain accepted with an explanation and block approval until an administrator resolves the commitment; changing distance never silently cancels them.
- Exact matching maximizes coverage before weighted priorities/variety/rotation. Accepted commitments and selected locks are protected. Priority does not override hard eligibility. No blanket hard-rule override exists.
- Historical title/capacity data are untouched; league size derives from actual teams. Defaults are 10 rounds, distance2, title challenger positions2/3; an administrator must review configuration before enabling.
- New season configuration and future week dates require explicit administrator review. Background generation can only create private proposals after closure; never approve/publish.

See COMPETITION-SIMULATION.md for the required pre-integration demonstration and COMPETITION-OPERATIONS.md for the workflow.
