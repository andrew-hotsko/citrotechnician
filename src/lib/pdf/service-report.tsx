/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer's Image does not
   support the alt prop; PDFs are not HTML documents. */

import "server-only";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import React from "react";

// -----------------------------------------------------------------------------
// Input type — everything the template needs to render.
// -----------------------------------------------------------------------------

export type ServiceReportInput = {
  jobNumber: string;
  completedAt: Date;
  product: "SYSTEM" | "SPRAY" | "MFB_31" | "MFB_34" | "MFB_35_FM";
  contractValue: number | null;
  property: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string | null;
  };
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  technician: {
    name: string;
  } | null;
  checklist: { label: string; completed: boolean }[];
  photos: {
    BEFORE: string[];
    DURING: string[];
    AFTER: string[];
    ISSUE: string[];
  };
  signatureUrl: string | null;
  techNotes: string | null;
};

const PRODUCT_LABEL: Record<ServiceReportInput["product"], string> = {
  SYSTEM: "System",
  SPRAY: "Spray",
  // Legacy values still resolve cleanly if any historic data slips through.
  MFB_31: "System",
  MFB_34: "System",
  MFB_35_FM: "Spray",
};

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const BRAND_ORANGE = "#ea580c";
const INK_900 = "#18181b";
const INK_700 = "#3f3f46";
const INK_500 = "#71717a";
const INK_300 = "#d4d4d8";
const HAIRLINE = "#e4e4e7";
const SURFACE = "#fafafa";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 10,
    color: INK_900,
    fontFamily: "Helvetica",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    paddingBottom: 14,
    marginBottom: 20,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandChip: {
    width: 24,
    height: 24,
    backgroundColor: BRAND_ORANGE,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  brandChipText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  brandName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: INK_900 },
  headerMeta: { alignItems: "flex-end" },
  headerTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: INK_900 },
  headerSub: { fontSize: 9, color: INK_500, marginTop: 2 },

  hero: { marginBottom: 22 },
  heroKicker: {
    fontSize: 8,
    letterSpacing: 1,
    color: INK_500,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: INK_900,
    letterSpacing: -0.3,
    lineHeight: 1.15,
  },
  heroSubtitle: { fontSize: 10, color: INK_500, marginTop: 4 },

  sectionLabel: {
    fontSize: 8,
    letterSpacing: 1,
    color: INK_500,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginBottom: 8,
  },

  twoCol: { flexDirection: "row", gap: 20, marginBottom: 18 },
  col: { flex: 1 },

  factsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 18,
  },
  factItem: { width: "33.33%", marginBottom: 12, paddingRight: 8 },
  factLabel: {
    fontSize: 8,
    letterSpacing: 1,
    color: INK_500,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  factValue: { fontSize: 11, color: INK_900 },

  addressCard: {
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 6,
    padding: 12,
  },
  addressTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: INK_900,
  },
  addressLine: { fontSize: 10, color: INK_700, marginTop: 2, lineHeight: 1.4 },

  checklistRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 5,
  },
  checkbox: {
    width: 9,
    height: 9,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: INK_300,
    marginTop: 1.5,
  },
  checkboxDone: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    color: "#ffffff",
    fontSize: 7,
    lineHeight: 1,
    fontFamily: "Helvetica-Bold",
  },
  checklistLabel: { flex: 1, fontSize: 10, color: INK_700, lineHeight: 1.35 },
  checklistLabelDone: { color: INK_500 },

  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  photoCell: {
    width: 120,
    height: 90,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: HAIRLINE,
    backgroundColor: SURFACE,
    overflow: "hidden",
  },
  photoImage: { width: "100%", height: "100%", objectFit: "cover" },

  signatureBox: {
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 6,
    height: 90,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  signatureImage: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
  },
  signaturePlaceholder: { fontSize: 10, color: INK_300 },
  signatureMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    fontSize: 9,
    color: INK_500,
  },

  noteBox: {
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 6,
    padding: 12,
    backgroundColor: SURFACE,
  },
  noteText: { fontSize: 10, color: INK_700, lineHeight: 1.5 },

  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingTop: 10,
    fontSize: 8,
    color: INK_500,
  },
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmtMoney(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

// -----------------------------------------------------------------------------
// Template
// -----------------------------------------------------------------------------

export function ServiceReport({ data }: { data: ServiceReportInput }) {
  const doneCount = data.checklist.filter((c) => c.completed).length;
  const beforePhotos = data.photos.BEFORE.slice(0, 4);
  const afterPhotos = data.photos.AFTER.slice(0, 4);

  return (
    <Document
      title={`Service Report — ${data.property.name} — ${data.jobNumber}`}
      author="CitroTech Corporation"
      subject={`${PRODUCT_LABEL[data.product]} wildfire defense application`}
    >
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View style={styles.brandRow}>
            <View style={styles.brandChip}>
              <Text style={styles.brandChipText}>C</Text>
            </View>
            <Text style={styles.brandName}>CitroTech Corporation</Text>
          </View>
          <View style={styles.headerMeta}>
            <Text style={styles.headerTitle}>Service Report</Text>
            <Text style={styles.headerSub}>
              {data.jobNumber} · {PRODUCT_LABEL[data.product]}
            </Text>
          </View>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>
            Completed {fmtDate(data.completedAt)}
          </Text>
          <Text style={styles.heroTitle}>{data.property.name}</Text>
          <Text style={styles.heroSubtitle}>
            {PRODUCT_LABEL[data.product]} wildfire defense application
          </Text>
        </View>

        {/* Two-col: Property / Customer */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Property</Text>
            <View style={styles.addressCard}>
              <Text style={styles.addressTitle}>{data.property.name}</Text>
              <Text style={styles.addressLine}>{data.property.address}</Text>
              <Text style={styles.addressLine}>
                {data.property.city}, {data.property.state}{" "}
                {data.property.zip ?? ""}
              </Text>
            </View>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Customer</Text>
            <View style={styles.addressCard}>
              <Text style={styles.addressTitle}>{data.customer.name}</Text>
              {data.customer.email && (
                <Text style={styles.addressLine}>{data.customer.email}</Text>
              )}
              {data.customer.phone && (
                <Text style={styles.addressLine}>{data.customer.phone}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Facts grid */}
        <Text style={styles.sectionLabel}>Service details</Text>
        <View style={styles.factsGrid}>
          <Fact label="Product" value={PRODUCT_LABEL[data.product]} />
          <Fact label="Contract value" value={fmtMoney(data.contractValue)} />
          <Fact
            label="Technician"
            value={data.technician?.name ?? "Not recorded"}
          />
          <Fact label="Completion" value={fmtDate(data.completedAt)} />
          <Fact label="Job number" value={data.jobNumber} />
        </View>

        {/* Checklist */}
        <Text style={styles.sectionLabel}>
          Pre-job checklist · {doneCount} of {data.checklist.length} complete
        </Text>
        <View style={{ marginBottom: 18 }}>
          {data.checklist.map((item, i) => (
            <View key={i} style={styles.checklistRow}>
              <View
                style={[
                  styles.checkbox,
                  item.completed ? styles.checkboxDone : {},
                ]}
              >
                {item.completed && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text
                style={[
                  styles.checklistLabel,
                  item.completed ? styles.checklistLabelDone : {},
                ]}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Tech notes */}
        {data.techNotes && (
          <>
            <Text style={styles.sectionLabel}>Technician notes</Text>
            <View style={[styles.noteBox, { marginBottom: 18 }]}>
              <Text style={styles.noteText}>{data.techNotes}</Text>
            </View>
          </>
        )}

        {/* Photos */}
        {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
          <View break>
            <Text style={styles.sectionLabel}>Documentation</Text>
            {beforePhotos.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text
                  style={{ fontSize: 9, color: INK_500, marginBottom: 6 }}
                >
                  Before ({beforePhotos.length})
                </Text>
                <View style={styles.photoGrid}>
                  {beforePhotos.map((url, i) => (
                    <View key={i} style={styles.photoCell}>
                      <Image src={url} style={styles.photoImage} />
                    </View>
                  ))}
                </View>
              </View>
            )}
            {afterPhotos.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text
                  style={{ fontSize: 9, color: INK_500, marginBottom: 6 }}
                >
                  After ({afterPhotos.length})
                </Text>
                <View style={styles.photoGrid}>
                  {afterPhotos.map((url, i) => (
                    <View key={i} style={styles.photoCell}>
                      <Image src={url} style={styles.photoImage} />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Signature */}
        <View wrap={false} style={{ marginTop: 12 }}>
          <Text style={styles.sectionLabel}>Customer sign-off</Text>
          <View style={styles.signatureBox}>
            {data.signatureUrl ? (
              <Image src={data.signatureUrl} style={styles.signatureImage} />
            ) : (
              <Text style={styles.signaturePlaceholder}>
                Signature not captured
              </Text>
            )}
          </View>
          <View style={styles.signatureMeta}>
            <Text>Signed by customer on behalf of {data.customer.name}</Text>
            <Text>{fmtDate(data.completedAt)}</Text>
          </View>
        </View>

        {/* Footer — every page */}
        <View style={styles.footer} fixed>
          <Text>CitroTech Corporation · MFB Wildfire Defense</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${data.jobNumber} · Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factItem}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}
