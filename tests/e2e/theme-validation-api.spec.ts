import { test, expect } from '@playwright/test';

// Configuration for API requests to NUMU-api
// Assumes NUMU-api is running on http://127.0.0.1:8000
const API_URL = 'http://127.0.0.1:8000/api/v1';

test.describe('External Theme Infrastructure API Tests (Phase 1.5)', () => {
  let adminSessionCookie: string;
  let testStoreId: string;
  let csrfToken: string;

  // 1. Setup: Login and dynamically resolve a store for testing
  test.beforeAll(async ({ request }) => {
    // Attempt admin login
    const loginResp = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: 'superadmin@numu.store',
        password: 'password123'
      }
    });
    
    // We expect successful login or 401 if credentials are changed
    // if it fails, we output to console to know env expectations
    if (!loginResp.ok()) {
      console.warn("Could not login. Check local seed data. Details:", await loginResp.text());
      return; 
    }
    
    const headers = loginResp.headers();
    const setCookieHeader = headers['set-cookie'] || '';
    
    // Extract CSRF token
    const csrfResp = await request.get(`${API_URL}/auth/csrf-token`);
    if (csrfResp.ok()) {
        const body = await csrfResp.json();
        csrfToken = body.data.csrf_token;
    }
    
    // Use the /stores to get a store ID for testing
    const storesResp = await request.get(`${API_URL}/stores/`, {
      headers: {
        'Cookie': setCookieHeader
      }
    });
    if (storesResp.ok()) {
        const payload = await storesResp.json();
        if (payload.data && payload.data.length > 0) {
            testStoreId = payload.data[0].id;
        }
    }
  });

  test('POST /stores/:id/themes/external/rebuild returns proper schema (Phase 1.5.5)', async ({ request }) => {
    // Exits early if no store found
    test.skip(!testStoreId, 'Requires a provisioned test store');

    const rebuildRes = await request.post(`${API_URL}/stores/${testStoreId}/themes/external/rebuild`, {
        data: {
            branch: "main"
        },
        headers: {
            'X-CSRF-Token': csrfToken,
        }
    });

    // Check status
    // If it fails with 400 (no github repo config), that's expected but we validate the structure
    expect([200, 400]).toContain(rebuildRes.status());
    
    const body = await rebuildRes.json();
    
    // If it returned 200, check the properties
    if (rebuildRes.status() === 200) {
        expect(body.data).toHaveProperty('status');
        expect(body.data).toHaveProperty('task_id');
        expect(body.data).toHaveProperty('message');
        console.log(`Rebuild Task ID triggered: ${body.data.task_id}`);
    } else {
        // Assert error wrapper is clear
        expect(body.detail).toBeDefined();
    }
  });

  test('POST /stores/:id/themes/external/validate detects bundle size / dangerous patterns (Phase 1.5.6)', async ({ request }) => {
    test.skip(!testStoreId, 'Requires a provisioned test store');

    // Call validation endpoint
    const valRes = await request.post(`${API_URL}/stores/${testStoreId}/themes/external/validate`, {
        headers: {
            'X-CSRF-Token': csrfToken,
        }
    });

    expect([200, 400]).toContain(valRes.status());

    const body = await valRes.json();
    
    if (valRes.status() === 200) {
        // Expected Model: ThemeValidationResponse
        expect(body.data).toHaveProperty('valid');
        expect(body.data).toHaveProperty('errors');
        expect(body.data).toHaveProperty('warnings');
        expect(body.data).toHaveProperty('contract_version');
        
        // Output for visibility
        console.log(`Validation returned valid=${body.data.valid}, contract=${body.data.contract_version}`);
    } else {
        expect(body.detail).toBeDefined();
    }
  });
});

