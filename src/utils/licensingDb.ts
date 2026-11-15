import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface LicenceInstallation {
  installationId: string;
  registeredAt: string;
  lastActivityAt: string;
  trialStatus: 'active' | 'expired';
  trialExpiresAt: string;
  activationStatus: 'trial' | 'permanently_activated';
  licenceId?: string;
  publicKeyIdentity: string;
  clientName: string;
  deviceInfo: string;
}

export interface ActivationCodeRecord {
  codeHash: string;
  plaintextCodePreview: string; // e.g. "OMNI-****-****-A9F2"
  plaintextCode?: string; // stored temporarily when newly generated
  status: 'unused' | 'redeemed' | 'revoked';
  generatedAt: string;
  redeemedAt?: string;
  associatedInstallationId?: string;
  licenceId: string;
}

export interface LicenceAuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  adminUser: string;
}

interface OmniRosterLicensingDB extends DBSchema {
  licence_installations: {
    key: string;
    value: LicenceInstallation;
  };
  licence_codes: {
    key: string; // codeHash
    value: ActivationCodeRecord;
  };
  licence_audit: {
    key: string;
    value: LicenceAuditLog;
  };
}

const LICENSING_DB_NAME = 'omniroster_licensing_db';
const LICENSING_DB_VERSION = 1;

let licensingDbPromise: Promise<IDBPDatabase<OmniRosterLicensingDB>> | null = null;

export function getLicensingDB(): Promise<IDBPDatabase<OmniRosterLicensingDB>> {
  if (!licensingDbPromise) {
    licensingDbPromise = openDB<OmniRosterLicensingDB>(LICENSING_DB_NAME, LICENSING_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('licence_installations')) {
          db.createObjectStore('licence_installations', { keyPath: 'installationId' });
        }
        if (!db.objectStoreNames.contains('licence_codes')) {
          db.createObjectStore('licence_codes', { keyPath: 'codeHash' });
        }
        if (!db.objectStoreNames.contains('licence_audit')) {
          db.createObjectStore('licence_audit', { keyPath: 'id' });
        }
      },
    });
  }
  return licensingDbPromise;
}

// Simple secure hash helper (SHA-256 via Web Crypto)
export async function hashString(str: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Seed initial licensing sample data if empty
export async function seedLicensingDataIfNeeded(): Promise<void> {
  const db = await getLicensingDB();
  const installations = await db.getAll('licence_installations');

  if (installations.length === 0) {
    const now = new Date();
    const pastDate = (daysAgo: number) => {
      const d = new Date(now.getTime() - daysAgo * 86400000);
      return d.toISOString();
    };
    const futureDate = (daysAhead: number) => {
      const d = new Date(now.getTime() + daysAhead * 86400000);
      return d.toISOString();
    };

    const sampleInstallations: LicenceInstallation[] = [
      {
        installationId: 'INST-7A9F-2B4C-1001',
        registeredAt: pastDate(5),
        lastActivityAt: pastDate(0),
        trialStatus: 'active',
        trialExpiresAt: futureDate(9),
        activationStatus: 'trial',
        publicKeyIdentity: 'pub_key_sec_91823741092',
        clientName: 'Apex Security Corp (Branch A)',
        deviceInfo: 'Chrome 131.0 / Linux x86_64 PWA',
      },
      {
        installationId: 'INST-4E2D-8C1A-2002',
        registeredAt: pastDate(18),
        lastActivityAt: pastDate(1),
        trialStatus: 'expired',
        trialExpiresAt: pastDate(4),
        activationStatus: 'trial',
        publicKeyIdentity: 'pub_key_bar_88374192837',
        clientName: 'Metro Lounge & Bar',
        deviceInfo: 'Safari 18.2 / iPadOS Mobile PWA',
      },
      {
        installationId: 'INST-9F1B-3E7C-3003',
        registeredAt: pastDate(30),
        lastActivityAt: pastDate(0),
        trialStatus: 'active',
        trialExpiresAt: futureDate(335),
        activationStatus: 'permanently_activated',
        licenceId: 'LIC-PERM-8821-9942',
        publicKeyIdentity: 'pub_key_med_77261592031',
        clientName: 'St. Jude General Hospital (ER Ward)',
        deviceInfo: 'Firefox 133.0 / Windows 11 Enterprise',
      },
      {
        installationId: 'INST-2C8A-6F4E-4004',
        registeredAt: pastDate(45),
        lastActivityAt: pastDate(0),
        trialStatus: 'active',
        trialExpiresAt: futureDate(320),
        activationStatus: 'permanently_activated',
        licenceId: 'LIC-PERM-3312-5567',
        publicKeyIdentity: 'pub_key_log_44192038475',
        clientName: 'Global Logistics Hub #4',
        deviceInfo: 'Edge 131.0 / Windows Server 2022',
      },
      {
        installationId: 'INST-5B3F-9D2A-5005',
        registeredAt: pastDate(2),
        lastActivityAt: pastDate(0),
        trialStatus: 'active',
        trialExpiresAt: futureDate(12),
        activationStatus: 'trial',
        publicKeyIdentity: 'pub_key_ret_11029384756',
        clientName: 'Downtown Retail Superstore',
        deviceInfo: 'Chrome 131.0 / Android 14 Tablet PWA',
      },
    ];

    const tx1 = db.transaction('licence_installations', 'readwrite');
    for (const inst of sampleInstallations) {
      await tx1.store.put(inst);
    }
    await tx1.done;

    // Sample Activation Codes
    const sampleCodes: ActivationCodeRecord[] = [
      {
        codeHash: await hashString('OMNI-8821-9942-A1B2'),
        plaintextCodePreview: 'OMNI-****-****-A1B2',
        status: 'redeemed',
        generatedAt: pastDate(30),
        redeemedAt: pastDate(30),
        associatedInstallationId: 'INST-9F1B-3E7C-3003',
        licenceId: 'LIC-PERM-8821-9942',
      },
      {
        codeHash: await hashString('OMNI-3312-5567-C3D4'),
        plaintextCodePreview: 'OMNI-****-****-C3D4',
        status: 'redeemed',
        generatedAt: pastDate(45),
        redeemedAt: pastDate(45),
        associatedInstallationId: 'INST-2C8A-6F4E-4004',
        licenceId: 'LIC-PERM-3312-5567',
      },
      {
        codeHash: await hashString('OMNI-7749-0012-E5F6'),
        plaintextCodePreview: 'OMNI-****-****-E5F6',
        status: 'unused',
        generatedAt: pastDate(2),
        licenceId: 'LIC-PERM-7749-0012',
      },
      {
        codeHash: await hashString('OMNI-9923-4411-G7H8'),
        plaintextCodePreview: 'OMNI-****-****-G7H8',
        status: 'unused',
        generatedAt: pastDate(1),
        licenceId: 'LIC-PERM-9923-4411',
      },
    ];

    const tx2 = db.transaction('licence_codes', 'readwrite');
    for (const code of sampleCodes) {
      await tx2.store.put(code);
    }
    await tx2.done;

    // Sample Audit Logs
    const sampleAudits: LicenceAuditLog[] = [
      {
        id: 'AUDIT-101',
        timestamp: pastDate(30),
        action: 'GRANT_PERMANENT_LICENCE',
        details: 'Granted permanent licence LIC-PERM-8821-9942 to installation INST-9F1B-3E7C-3003',
        adminUser: 'sys_admin_master',
      },
      {
        id: 'AUDIT-102',
        timestamp: pastDate(45),
        action: 'GRANT_PERMANENT_LICENCE',
        details: 'Granted permanent licence LIC-PERM-3312-5567 to installation INST-2C8A-6F4E-4004',
        adminUser: 'sys_admin_master',
      },
      {
        id: 'AUDIT-103',
        timestamp: pastDate(2),
        action: 'GENERATE_CODE',
        details: 'Generated new unredeemed activation code OMNI-7749-0012-E5F6',
        adminUser: 'sys_admin_master',
      },
    ];

    const tx3 = db.transaction('licence_audit', 'readwrite');
    for (const audit of sampleAudits) {
      await tx3.store.put(audit);
    }
    await tx3.done;
  }
}

export async function generateNewActivationCode(): Promise<{ code: string; record: ActivationCodeRecord }> {
  const db = await getLicensingDB();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const code = `OMNI-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${randomPart}`;
  const codeHash = await hashString(code);
  const licenceId = `LIC-PERM-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;

  const parts = code.split('-');
  const plaintextCodePreview = `OMNI-****-****-${parts[3] || 'XXXX'}`;

  const record: ActivationCodeRecord = {
    codeHash,
    plaintextCodePreview,
    status: 'unused',
    generatedAt: new Date().toISOString(),
    licenceId,
  };

  await db.put('licence_codes', record);

  await db.put('licence_audit', {
    id: 'AUDIT-' + Date.now(),
    timestamp: new Date().toISOString(),
    action: 'GENERATE_CODE',
    details: `Generated new activation code ID ${licenceId}`,
    adminUser: 'sys_admin_master',
  });

  return { code, record };
}

export async function grantPermanentLicenceForInstallation(installationId: string): Promise<{ code: string; record: ActivationCodeRecord }> {
  const db = await getLicensingDB();
  const inst = await db.get('licence_installations', installationId);
  if (!inst) throw new Error('Installation not found');

  const { code, record } = await generateNewActivationCode();

  // Update record with installation binding
  record.associatedInstallationId = installationId;
  await db.put('licence_codes', record);

  // Update installation status
  inst.activationStatus = 'permanently_activated';
  inst.licenceId = record.licenceId;
  await db.put('licence_installations', inst);

  await db.put('licence_audit', {
    id: 'AUDIT-' + Date.now(),
    timestamp: new Date().toISOString(),
    action: 'GRANT_PERMANENT_LICENCE',
    details: `Granted permanent licence ${record.licenceId} to installation ${installationId}`,
    adminUser: 'sys_admin_master',
  });

  return { code, record };
}

export async function revokeActivationCode(codeHash: string): Promise<void> {
  const db = await getLicensingDB();
  const codeRec = await db.get('licence_codes', codeHash);
  if (!codeRec) throw new Error('Activation code not found');

  codeRec.status = 'revoked';
  await db.put('licence_codes', codeRec);

  await db.put('licence_audit', {
    id: 'AUDIT-' + Date.now(),
    timestamp: new Date().toISOString(),
    action: 'REVOKE_CODE',
    details: `Revoked activation code ${codeRec.licenceId}`,
    adminUser: 'sys_admin_master',
  });
}
