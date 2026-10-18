import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type { Folder, Employee } from '../utils/db';
import { getFolderScheduleRows, type ScheduleRowItem } from '../utils/rosterExport';

export interface FolderRosterPDFProps {
  folder: Folder;
  employees: Employee[];
  companyName?: string;
  generatedAt?: string;
}

/**
 * Palette:
 * - Dark Brown: #3D3226
 * - Cream: #FAF8F5
 * - Gold Accents: #C5A059 / #D4AF37
 * - Border: #E4DDD3
 * - Deep Text: #1C1917
 * - Muted Text: #6B5E4F
 */
const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    backgroundColor: '#FAF8F5', // Luxurious Cream background
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1C1917',
  },
  headerContainer: {
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#C5A059', // Gold accent rule
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  companyName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#3D3226', // Dark Brown
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  badgeGold: {
    backgroundColor: '#3D3226',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderWidth: 1,
    borderColor: '#C5A059',
  },
  badgeGoldText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#D4AF37', // Gold
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  folderTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#3D3226',
    marginTop: 2,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#6B5E4F', // Warm Muted Brown
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
    color: '#3D3226',
  },
  tableContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E4DDD3',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#3D3226', // Dark Brown Header
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  headerCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#FAF8F5', // Cream Text
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: '#E4DDD3',
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: '#FFFFFF',
  },
  tableRowOdd: {
    backgroundColor: '#FAF8F5', // Soft Cream
  },
  bodyCell: {
    fontSize: 8,
    color: '#1C1917',
  },
  colDate: {
    width: '24%',
    paddingRight: 4,
  },
  colShift: {
    width: '20%',
    paddingRight: 4,
  },
  colTime: {
    width: '20%',
  },
  colGrace: {
    width: '12%',
  },
  colStaff: {
    width: '24%',
  },
  staffNameText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#3D3226',
  },
  staffEmptyText: {
    fontSize: 7.5,
    color: '#9E8F7F',
    fontStyle: 'italic',
  },
  signaturesContainer: {
    marginTop: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E4DDD3',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '45%',
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#C5A059', // Gold signature line
    height: 28,
    marginBottom: 6,
  },
  signatureField: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#3D3226',
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#7A7062',
    borderTopWidth: 0.5,
    borderTopColor: '#E4DDD3',
    paddingTop: 6,
  },
});

export const FolderRosterPDF: React.FC<FolderRosterPDFProps> = ({
  folder,
  employees,
  companyName = 'OmniRoster OS',
  generatedAt = new Date().toLocaleString(),
}) => {
  const rows: ScheduleRowItem[] = getFolderScheduleRows(folder, employees);
  const isRoster = folder.type === 'optimized_roster';
  const typeBadgeLabel = isRoster ? 'CSP Optimized Roster' : 'Standard 7-Day Shift';
  const dateRange =
    rows.length > 0 ? `${rows[0].dateStr} — ${rows[rows.length - 1].dateStr}` : 'Current Timetable';

  return (
    <Document
      title={`${folder.name} - Official Roster Timetable`}
      author={companyName}
      subject="Official Staff Roster & Shift Schedule"
    >
      <Page size="A4" style={styles.page}>
        {/* Header Block with Dark Brown & Gold accents */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTopRow}>
            <Text style={styles.companyName}>{companyName}</Text>
            <View style={styles.badgeGold}>
              <Text style={styles.badgeGoldText}>{typeBadgeLabel}</Text>
            </View>
          </View>

          <Text style={styles.folderTitle}>{folder.name}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Schedule Horizon: </Text>
              <Text>{dateRange}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Generated: </Text>
              <Text>{generatedAt}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Total Shifts: </Text>
              <Text>{rows.length}</Text>
            </View>
          </View>
        </View>

        {/* Schedule Table */}
        <View style={styles.tableContainer}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            <View style={styles.colDate}>
              <Text style={styles.headerCell}>Date / Day</Text>
            </View>
            <View style={styles.colShift}>
              <Text style={styles.headerCell}>Shift Name</Text>
            </View>
            <View style={styles.colTime}>
              <Text style={styles.headerCell}>Time Window</Text>
            </View>
            <View style={styles.colGrace}>
              <Text style={styles.headerCell}>Grace</Text>
            </View>
            <View style={styles.colStaff}>
              <Text style={styles.headerCell}>Assigned Personnel</Text>
            </View>
          </View>

          {/* Table Rows */}
          {rows.map((row, index) => {
            const isEven = index % 2 === 0;
            return (
              <View
                key={row.id || index}
                style={[styles.tableRow, isEven ? styles.tableRowEven : styles.tableRowOdd]}
              >
                <View style={styles.colDate}>
                  <Text style={[styles.bodyCell, { fontFamily: 'Helvetica-Bold', color: '#3D3226' }]}>
                    {row.formattedDate}
                  </Text>
                  <Text style={{ fontSize: 7, color: '#6B5E4F' }}>{row.dayOfWeek}</Text>
                </View>

                <View style={styles.colShift}>
                  <Text style={styles.bodyCell}>{row.shiftName}</Text>
                </View>

                <View style={styles.colTime}>
                  <Text style={[styles.bodyCell, { fontFamily: 'Helvetica-Bold' }]}>
                    {row.startTime}
                    {row.endTime && row.endTime !== 'Fixed Schedule' ? ` – ${row.endTime}` : ''}
                  </Text>
                </View>

                <View style={styles.colGrace}>
                  <Text style={styles.bodyCell}>±{row.gracePeriodMinutes}m</Text>
                </View>

                <View style={styles.colStaff}>
                  {row.assignedStaffNames.length > 0 ? (
                    <Text style={styles.staffNameText}>
                      {row.assignedStaffNames.join(', ')}
                    </Text>
                  ) : (
                    <Text style={styles.staffEmptyText}>Unassigned</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Corporate Signatures */}
        <View style={styles.signaturesContainer} wrap={false}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureField}>Signature:</Text>
            <Text style={styles.signatureField}>Name:</Text>
            <Text style={styles.signatureField}>Date:</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureField}>Signature:</Text>
            <Text style={styles.signatureField}>Name:</Text>
            <Text style={styles.signatureField}>Date:</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>OmniRoster OS • Official Schedule & Roster Timetable</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

/**
 * Renders the FolderRosterPDF document and triggers browser download.
 */
export async function downloadFolderRosterPDF(
  folder: Folder,
  employees: Employee[],
  options?: {
    companyName?: string;
    filename?: string;
  }
): Promise<void> {
  const doc = (
    <FolderRosterPDF
      folder={folder}
      employees={employees}
      companyName={options?.companyName || 'OmniRoster OS'}
      generatedAt={new Date().toLocaleString()}
    />
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const cleanName = (folder.name || 'roster')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const today = new Date().toISOString().split('T')[0];

  link.download = options?.filename || `${cleanName}-timetable-${today}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
