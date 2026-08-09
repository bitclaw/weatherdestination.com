import { describe, expect, it } from 'bun:test';
import { Route } from './{$indexNowKey}[.]txt';

// Net-new cast: no existing test in this repo invokes a GET handler with
// route params (adapts the POST-body cast pattern from contact.test.ts/
// lead.test.ts to GET + params instead of GET + request body).
const callGet = (indexNowKey: string) =>
  (
    Route.options.server as unknown as {
      handlers: {
        GET: (opts: { params: { indexNowKey: string } }) => Promise<Response>;
      };
    }
  ).handlers.GET({ params: { indexNowKey } });

describe('GET /{$indexNowKey}.txt', () => {
  it('returns 200 with the key as plain text when it matches INDEXNOW_KEY', async () => {
    const key = process.env.INDEXNOW_KEY;
    if (!key) throw new Error('INDEXNOW_KEY must be set in .env.test');

    const response = await callGet(key);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain');
    expect(await response.text()).toBe(key);
  });

  it('returns 404 when the key does not match', async () => {
    const response = await callGet('wrong-value');

    expect(response.status).toBe(404);
  });
});
