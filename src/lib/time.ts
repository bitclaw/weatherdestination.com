// Every stored instant is epoch milliseconds (docs/warpkit/patterns/
// timestamps.md). Use these instead of SQLite clock functions or ad-hoc
// unit math so the unit is always explicit.

/** Now, as epoch milliseconds: the value every raw-SQL timestamp column holds. */
export const nowMs = (): number => Date.now();

/** A provider value in seconds (OAuth expires_in, Unix time) as milliseconds. */
export const msFromSeconds = (seconds: number): number => seconds * 1000;
