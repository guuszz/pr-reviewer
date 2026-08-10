export type SecuritySeverity = "critical" | "high" | "medium" | "low";

export interface SecurityFinding {
  ruleId: string;
  severity: SecuritySeverity;
  title: string;
  file: string;
  line: number;
  evidence: string;
  description: string;
  remediation: string;
  cwe: string;
  owasp: string;
}

export interface SecuritySummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface Rule {
  id: string;
  severity: SecuritySeverity;
  title: string;
  cwe: string;
  owasp: string;
  description: string;
  remediation: string;
  pattern: RegExp;
  predicate?: (line: string) => boolean;
}

const PLACEHOLDER = /(example|placeholder|changeme|dummy|your[_-]|process\.env|import\.meta\.env|<[^>]+>)/i;

const RULES: Rule[] = [
  {
    id: "SPR-001",
    severity: "critical",
    title: "Potential hardcoded credential",
    cwe: "CWE-798",
    owasp: "A07:2025 Authentication Failures",
    description: "A credential-like value was added directly to source code.",
    remediation: "Load secrets from a managed secret store or runtime environment and rotate the exposed value.",
    pattern: /\b(api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password)\b\s*[:=]\s*["'`][^"'`\s]{8,}["'`]/i,
    predicate: (line) => !PLACEHOLDER.test(line),
  },
  {
    id: "SPR-002",
    severity: "critical",
    title: "AWS access key added to source",
    cwe: "CWE-798",
    owasp: "A07:2025 Authentication Failures",
    description: "The added line contains a value shaped like an AWS access key identifier.",
    remediation: "Remove and rotate the key immediately, then use workload identity or a secret manager.",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    id: "SPR-003",
    severity: "high",
    title: "Dynamic code execution with eval",
    cwe: "CWE-95",
    owasp: "A05:2025 Injection",
    description: "eval executes strings as code and can turn untrusted data into code execution.",
    remediation: "Replace eval with explicit parsing, a safe expression evaluator, or a fixed dispatch table.",
    pattern: /\beval\s*\(/,
  },
  {
    id: "SPR-004",
    severity: "high",
    title: "Shell command built with interpolation",
    cwe: "CWE-78",
    owasp: "A05:2025 Injection",
    description: "A shell execution call contains string interpolation, which can enable command injection.",
    remediation: "Use an argument-array API without a shell and validate every externally controlled argument.",
    pattern: /\b(exec|execSync)\s*\(\s*`[^`]*\$\{/,
  },
  {
    id: "SPR-005",
    severity: "high",
    title: "SQL statement built with interpolation",
    cwe: "CWE-89",
    owasp: "A05:2025 Injection",
    description: "A SQL statement is assembled with an interpolated value.",
    remediation: "Use parameterized queries or the parameter binding API provided by the database client.",
    pattern: /`[^`]*\b(SELECT|INSERT|UPDATE|DELETE)\b[^`]*\$\{/i,
  },
  {
    id: "SPR-006",
    severity: "high",
    title: "TLS certificate verification disabled",
    cwe: "CWE-295",
    owasp: "A02:2025 Security Misconfiguration",
    description: "The change disables server certificate verification for a TLS connection.",
    remediation: "Keep certificate validation enabled and configure the correct CA bundle for the environment.",
    pattern: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0/i,
  },
  {
    id: "SPR-007",
    severity: "medium",
    title: "Wildcard CORS origin",
    cwe: "CWE-942",
    owasp: "A02:2025 Security Misconfiguration",
    description: "The response permits requests from every origin.",
    remediation: "Allow only the explicit origins required by the application and review credential handling.",
    pattern: /access-control-allow-origin["']?\s*[:,]\s*["']\*["']|origin\s*:\s*["']\*["']/i,
  },
  {
    id: "SPR-008",
    severity: "medium",
    title: "Weak cryptographic hash",
    cwe: "CWE-328",
    owasp: "A04:2025 Cryptographic Failures",
    description: "MD5 or SHA-1 was selected for a security-sensitive hash operation.",
    remediation: "Use SHA-256 or stronger for integrity, and a dedicated password hashing function for passwords.",
    pattern: /createHash\s*\(\s*["'](md5|sha1)["']\s*\)/i,
  },
  {
    id: "SPR-009",
    severity: "medium",
    title: "Non-cryptographic randomness used for a token",
    cwe: "CWE-330",
    owasp: "A04:2025 Cryptographic Failures",
    description: "Math.random is predictable and unsuitable for tokens, secrets, or session identifiers.",
    remediation: "Generate security-sensitive values with crypto.randomBytes or crypto.randomUUID.",
    pattern: /\b(token|secret|session|nonce|otp)\b.*Math\.random|Math\.random.*\b(token|secret|session|nonce|otp)\b/i,
  },
  {
    id: "SPR-010",
    severity: "medium",
    title: "Sensitive value written to logs",
    cwe: "CWE-532",
    owasp: "A09:2025 Security Logging and Alerting Failures",
    description: "A credential-like value appears in an application log statement.",
    remediation: "Remove the value or log only a non-sensitive identifier with structured redaction.",
    pattern: /console\.(log|info|debug|error)\s*\([^)]*\b(password|token|secret|authorization)\b/i,
  },
];

interface AddedLine {
  file: string;
  line: number;
  content: string;
}

export function extractAddedLines(diff: string): AddedLine[] {
  const added: AddedLine[] = [];
  let file = "unknown";
  let newLine = 0;

  for (const raw of diff.split(/\r?\n/)) {
    if (raw.startsWith("+++ b/")) {
      file = raw.slice(6);
      continue;
    }
    const hunk = raw.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      added.push({ file, line: newLine, content: raw.slice(1) });
      newLine += 1;
      continue;
    }
    if (!raw.startsWith("-")) newLine += 1;
  }
  return added;
}

function evidence(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
}

export function scanSecurityDiff(diff: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const seen = new Set<string>();

  for (const added of extractAddedLines(diff)) {
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      if (!rule.pattern.test(added.content) || (rule.predicate && !rule.predicate(added.content))) continue;
      const key = `${rule.id}:${added.file}:${added.line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        title: rule.title,
        file: added.file,
        line: added.line,
        evidence: evidence(added.content),
        description: rule.description,
        remediation: rule.remediation,
        cwe: rule.cwe,
        owasp: rule.owasp,
      });
    }
  }

  const order: Record<SecuritySeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  return findings.sort((a, b) => order[b.severity] - order[a.severity] || a.file.localeCompare(b.file) || a.line - b.line);
}

export function summarizeSecurity(findings: SecurityFinding[]): SecuritySummary {
  const summary: SecuritySummary = { total: findings.length, critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) summary[finding.severity] += 1;
  return summary;
}

