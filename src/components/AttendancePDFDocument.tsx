import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type { AttendanceRecord } from '../utils/db';

export interface AttendancePDFProps {
  companyName?: string;
  reportTitle?: string;
  dateRangeText?: string;
  generatedAt?: string;
  records: AttendanceRecord[];
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
    paddingBottom: 12,
    marginBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  companyName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  companyTagline: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
  },
  reportBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  reportBadgeText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1d4ed8',
  },
  reportTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    marginTop: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    fontSize: 8,
    color: '#64748b',
  },
  summaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'column',
  },
  summaryLabel: {
    fontSize: 7,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginTop: 2,
  },
  table: {
    width: 'auto',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableRowEven: {
    backgroundColor: '#ffffff',
  },
  tableRowOdd: {
    backgroundColor: '#f8fafc',
  },
  colName: { width: '25%' },
  colShift: { width: '23%' },
  colDate: { width: '15%' },
  colTime: { width: '13%' },
  colStatus: { width: '14%' },
  colConfidence: { width: '10%', textAlign: 'right' },
  headerCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
    textTransform: 'uppercase',
  },
  bodyCell: {
    fontSize: 8,
    color: '#1e293b',
  },
  statusText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
  },
  statusOnTime: {
    color: '#059669', // Green
  },
  statusLate: {
    color: '#dc2626', // Red
  },
  statusEarly: {
    color: '#2563eb', // Blue
  },
  statusDuplicate: {
    color: '#d97706', // Orange
  },
  statusDefault: {
    color: '#475569',
  },
  emptyNotice: {
    padding: 16,
    textAlign: 'center',
    color: '#64748b',
    fontSize: 9,
  },
  signaturesContainer: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '45%',
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#94a3b8',
    height: 32,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
  },
  signatureSubtext: {
    fontSize: 7,
    color: '#64748b',
    marginTop: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#94a3b8',
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
});

function formatDateTime(ts: string) {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return { date: ts, time: '—' };
    const date = d.toISOString().split('T')[0];
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return { date, time };
  } catch {
    return { date: ts, time: '—' };
  }
}

function getStatusStyle(status: AttendanceRecord['status']) {
  switch (status) {
    case 'on_time':
      return styles.statusOnTime;
    case 'late':
      return styles.statusLate;
    case 'early':
      return styles.statusEarly;
    case 'duplicate':
      return styles.statusDuplicate;
    default:
      return styles.statusDefault;
  }
}

function getStatusLabel(status: AttendanceRecord['status']) {
  switch (status) {
    case 'on_time':
      return 'ON TIME';
    case 'late':
      return 'LATE';
    case 'early':
      return 'EARLY';
    case 'duplicate':
      return 'DUPLICATE';
    default:
      return String(status).toUpperCase();
  }
}

export const AttendancePDFDocument: React.FC<AttendancePDFProps> = ({
  companyName = 'OmniRoster OS',
  reportTitle = 'Official Biometric Attendance & Shift Audit Report',
  dateRangeText = 'All Dates',
  generatedAt = new Date().toLocaleString(),
  records,
}) => {
  // Summary Stats
  const total = records.length;
  const onTimeCount = records.filter((r) => r.status === 'on_time').length;
  const lateCount = records.filter((r) => r.status === 'late').length;
  const earlyCount = records.filter((r) => r.status === 'early').length;
  const duplicateCount = records.filter((r) => r.status === 'duplicate').length;

  return (
    <Document title={reportTitle} author={companyName}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.companyName}>{companyName}</Text>
              <Text style={styles.companyTagline}>Universal Offline-First Biometric Attendance Platform</Text>
            </View>
            <View style={styles.reportBadge}>
              <Text style={styles.reportBadgeText}>OFFICIAL AUDIT LEDGER</Text>
            </View>
          </View>
          <Text style={styles.reportTitle}>{reportTitle}</Text>
          <View style={styles.metaRow}>
            <Text>Coverage: {dateRangeText}</Text>
            <Text>Generated: {generatedAt}</Text>
            <Text>Total Logged Entries: {total}</Text>
          </View>
        </View>

        {/* Quick KPI Summary Bar */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Records</Text>
            <Text style={styles.summaryValue}>{total}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>On Time</Text>
            <Text style={[styles.summaryValue, styles.statusOnTime]}>{onTimeCount}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Early Arrivals</Text>
            <Text style={[styles.summaryValue, styles.statusEarly]}>{earlyCount}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Late Arrivals</Text>
            <Text style={[styles.summaryValue, styles.statusLate]}>{lateCount}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Duplicate / Flags</Text>
            <Text style={[styles.summaryValue, styles.statusDuplicate]}>{duplicateCount}</Text>
          </View>
        </View>

        {/* Attendance Records Table */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            <View style={styles.colName}>
              <Text style={styles.headerCell}>Employee Name</Text>
            </View>
            <View style={styles.colShift}>
              <Text style={styles.headerCell}>Shift / Folder</Text>
            </View>
            <View style={styles.colDate}>
              <Text style={styles.headerCell}>Date</Text>
            </View>
            <View style={styles.colTime}>
              <Text style={styles.headerCell}>Time</Text>
            </View>
            <View style={styles.colStatus}>
              <Text style={styles.headerCell}>Status</Text>
            </View>
            <View style={styles.colConfidence}>
              <Text style={styles.headerCell}>Match</Text>
            </View>
          </View>

          {/* Table Rows */}
          {records.length === 0 ? (
            <View style={styles.emptyNotice}>
              <Text>No attendance entries found for the selected query.</Text>
            </View>
          ) : (
            records.slice(0, 150).map((record, index) => {
              const { date, time } = formatDateTime(record.timestamp);
              const isEven = index % 2 === 0;
              const confidence =
                record.matchedConfidence !== undefined && record.matchedConfidence !== null
                  ? `${Math.round(record.matchedConfidence)}%`
                  : 'PIN';

              return (
                <View
                  key={record.id || index}
                  style={[styles.tableRow, isEven ? styles.tableRowEven : styles.tableRowOdd]}
                >
                  <View style={styles.colName}>
                    <Text style={[styles.bodyCell, { fontFamily: 'Helvetica-Bold' }]}>
                      {record.employeeName || 'Unknown Employee'}
                    </Text>
                  </View>
                  <View style={styles.colShift}>
                    <Text style={styles.bodyCell}>{record.folderName || 'Default Shift'}</Text>
                  </View>
                  <View style={styles.colDate}>
                    <Text style={styles.bodyCell}>{date}</Text>
                  </View>
                  <View style={styles.colTime}>
                    <Text style={styles.bodyCell}>{time}</Text>
                  </View>
                  <View style={styles.colStatus}>
                    <Text style={[styles.statusText, getStatusStyle(record.status)]}>
                      {getStatusLabel(record.status)}
                    </Text>
                  </View>
                  <View style={styles.colConfidence}>
                    <Text style={styles.bodyCell}>{confidence}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Corporate Signatures */}
        <View style={styles.signaturesContainer} wrap={false}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Human Resources Representative</Text>
            <Text style={styles.signatureSubtext}>Verified & Audited By (Name & Signature)</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Operations / Shift Supervisor</Text>
            <Text style={styles.signatureSubtext}>Approved By (Name & Signature)</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>OmniRoster OS • Secure Offline-First Biometric Attendance</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

/**
 * Renders the AttendancePDFDocument and initiates a direct browser download.
 */
export async function downloadAttendancePDF(
  records: AttendanceRecord[],
  options?: {
    companyName?: string;
    reportTitle?: string;
    dateRangeText?: string;
    filename?: string;
  }
): Promise<void> {
  const doc = (
    <AttendancePDFDocument
      records={records}
      companyName={options?.companyName || 'OmniRoster OS'}
      reportTitle={options?.reportTitle || 'Official Biometric Attendance & Shift Audit Report'}
      dateRangeText={options?.dateRangeText || 'All Logged Dates'}
      generatedAt={new Date().toLocaleString()}
    />
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download =
    options?.filename || `attendance-report-${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
