import "server-only";
import jsforce from "jsforce";

/**
 * Salesforce credentials live entirely in env vars — no DB storage, no
 * UI for them. This keeps secrets out of the codebase + database and
 * makes decommissioning trivial later (unset the vars, the integration
 * stops; the history rows stay for audit).
 *
 * Required:
 *   SALESFORCE_USERNAME         — Salesforce login email
 *   SALESFORCE_PASSWORD         — Salesforce password
 *   SALESFORCE_SECURITY_TOKEN   — 24-char token from Salesforce
 *                                  (My Settings → Personal → Reset My Security Token)
 *
 * Optional:
 *   SALESFORCE_LOGIN_URL        — defaults to https://login.salesforce.com
 *                                  (use https://test.salesforce.com for Sandbox)
 *   SALESFORCE_SOQL_QUERY       — override the default query if the default
 *                                  doesn't match your SF schema
 */
export type SalesforceConfig = {
  username: string;
  password: string;
  securityToken: string;
  loginUrl: string;
  soqlQuery: string;
};

export type SalesforceConfigStatus =
  | { configured: true; config: SalesforceConfig }
  | { configured: false; missing: string[] };

/** Default SOQL. Returns closed-won opportunities from the past 24 hours,
 *  joined with the Account's address + phone + email. Adjust via
 *  SALESFORCE_SOQL_QUERY env var if your SF schema differs. */
export const DEFAULT_SOQL = `
  SELECT
    Id,
    Name,
    CloseDate,
    Amount,
    Description,
    Account.Id,
    Account.Name,
    Account.Phone,
    Account.BillingStreet,
    Account.BillingCity,
    Account.BillingState,
    Account.BillingPostalCode
  FROM Opportunity
  WHERE StageName = 'Closed Won'
    AND CloseDate = LAST_N_DAYS:1
  ORDER BY CloseDate DESC
  LIMIT 200
`.trim();

export function readConfig(): SalesforceConfigStatus {
  const username = process.env.SALESFORCE_USERNAME?.trim();
  const password = process.env.SALESFORCE_PASSWORD?.trim();
  const securityToken = process.env.SALESFORCE_SECURITY_TOKEN?.trim();
  const loginUrl =
    process.env.SALESFORCE_LOGIN_URL?.trim() || "https://login.salesforce.com";
  const soqlQuery =
    process.env.SALESFORCE_SOQL_QUERY?.trim() || DEFAULT_SOQL;

  const missing: string[] = [];
  if (!username) missing.push("SALESFORCE_USERNAME");
  if (!password) missing.push("SALESFORCE_PASSWORD");
  if (!securityToken) missing.push("SALESFORCE_SECURITY_TOKEN");

  if (missing.length > 0) {
    return { configured: false, missing };
  }

  return {
    configured: true,
    config: {
      username: username!,
      password: password!,
      securityToken: securityToken!,
      loginUrl,
      soqlQuery,
    },
  };
}

/** Create an authenticated jsforce Connection. Throws on auth failure. */
export async function connect(cfg: SalesforceConfig) {
  const conn = new jsforce.Connection({ loginUrl: cfg.loginUrl });
  await conn.login(cfg.username, cfg.password + cfg.securityToken);
  return conn;
}
