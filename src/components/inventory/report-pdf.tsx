"use client";

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ConditionRating } from "@/lib/types";

/**
 * The printable Schedule of Condition.
 *
 * Laid out to mirror a professional inventory report: a cover, a summary
 * table, then each area section by section with its dated photographs, a
 * defects roll-up, and the signed declarations.
 *
 * Rendered in the browser rather than on a server: reports run to dozens of
 * pages with hundreds of images, which is exactly the shape of work that
 * times out in a serverless function.
 */

const RATING_COLOR: Record<ConditionRating, string> = {
  excellent: "#059669",
  good: "#16a34a",
  fair: "#f59e0b",
  poor: "#ea580c",
  unacceptable: "#dc2626",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, color: "#0f172a", fontFamily: "Helvetica" },
  coverTitle: { fontSize: 22, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  coverSub: { fontSize: 12, color: "#475569", marginBottom: 3 },
  coverBlock: { marginTop: 140, marginBottom: 40 },
  h2: { fontSize: 14, marginBottom: 10, fontFamily: "Helvetica-Bold" },
  h3: {
    fontSize: 11,
    marginBottom: 6,
    marginTop: 10,
    fontFamily: "Helvetica-Bold",
  },
  row: { flexDirection: "row" },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
  },
  badge: {
    color: "#ffffff",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    fontSize: 8,
    // Text is block-level in react-pdf and would otherwise stretch to fill
    // its column; this makes the pill hug its label.
    alignSelf: "flex-start",
  },
  sectionCard: {
    borderWidth: 0.5,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  photoBox: { width: "31%", marginRight: "2%", marginBottom: 6 },
  photo: { width: "100%", height: 90, objectFit: "cover", borderRadius: 3 },
  caption: { fontSize: 6, color: "#64748b", marginTop: 2 },
  muted: { color: "#64748b" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#94a3b8",
  },
});

export interface PdfSection {
  name: string;
  condition: ConditionRating | null;
  cleanliness: ConditionRating | null;
  description: string | null;
  flagged: boolean;
  photos: { url: string; takenAt: string }[];
}

export interface PdfArea {
  name: string;
  sections: PdfSection[];
}

export interface PdfReportData {
  propertyName: string;
  roomName: string;
  address: string | null;
  type: string;
  dateLabel: string;
  occupants: string[];
  areas: PdfArea[];
  meters: { type: string; reading: string; serial: string | null }[];
  keys: { description: string; quantity: number; comments: string | null }[];
  detectors: { type: string; location: string | null; tested: boolean }[];
  declarations: { role: string; name: string; signedAt: string }[];
  labels: Record<string, string>;
}

const Badge = ({ value }: { value: ConditionRating | null }) =>
  value ? (
    <Text style={[styles.badge, { backgroundColor: RATING_COLOR[value] }]}>
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </Text>
  ) : (
    <Text style={styles.muted}>—</Text>
  );

const Footer = ({ data }: { data: PdfReportData }) => (
  <View style={styles.footer} fixed>
    <Text>
      {data.roomName} — {data.propertyName}
    </Text>
    <Text
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
    />
  </View>
);

export function ReportPdf({ data }: { data: PdfReportData }) {
  const L = data.labels;
  const defects = data.areas.flatMap((area) =>
    area.sections.filter((s) => s.flagged).map((s) => ({ area, s })),
  );

  return (
    <Document title={`${data.roomName} — ${data.type}`}>
      {/* Cover */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverBlock}>
          <Text style={styles.coverSub}>{data.type}</Text>
          <Text style={styles.coverTitle}>{L.reportTitle}</Text>
          <Text style={styles.coverSub}>
            {data.roomName} — {data.propertyName}
          </Text>
          {data.address ? (
            <Text style={styles.coverSub}>{data.address}</Text>
          ) : null}
          <Text style={[styles.coverSub, { marginTop: 20 }]}>
            {data.dateLabel}
          </Text>
          {data.occupants.length > 0 && (
            <Text style={[styles.coverSub, { marginTop: 6 }]}>
              {data.occupants.join(", ")}
            </Text>
          )}
        </View>
        <Footer data={data} />
      </Page>

      {/* Summary + report-level records */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>{L.summary}</Text>
        <View style={styles.tableHead}>
          <Text style={{ width: "40%" }}>{L.area}</Text>
          <Text style={{ width: "20%" }}>{L.condition}</Text>
          <Text style={{ width: "20%" }}>{L.cleanliness}</Text>
          <Text style={{ width: "10%", textAlign: "right" }}>{L.defects}</Text>
          <Text style={{ width: "10%", textAlign: "right" }}>{L.photos}</Text>
        </View>
        {data.areas.map((area) => {
          const overview = area.sections.find((s) =>
            s.name.toLowerCase().includes("general overview"),
          );
          return (
            <View key={area.name} style={styles.tableRow}>
              <Text style={{ width: "40%" }}>{area.name}</Text>
              <View style={{ width: "20%" }}>
                <Badge value={overview?.condition ?? null} />
              </View>
              <View style={{ width: "20%" }}>
                <Badge value={overview?.cleanliness ?? null} />
              </View>
              <Text style={{ width: "10%", textAlign: "right" }}>
                {area.sections.filter((s) => s.flagged).length}
              </Text>
              <Text style={{ width: "10%", textAlign: "right" }}>
                {area.sections.reduce((n, s) => n + s.photos.length, 0)}
              </Text>
            </View>
          );
        })}

        {data.meters.length > 0 && (
          <>
            <Text style={styles.h3}>{L.meters}</Text>
            {data.meters.map((m, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={{ width: "30%" }}>{m.type}</Text>
                <Text style={{ width: "35%" }}>{m.reading}</Text>
                <Text style={[{ width: "35%" }, styles.muted]}>
                  {m.serial ?? ""}
                </Text>
              </View>
            ))}
          </>
        )}

        {data.keys.length > 0 && (
          <>
            <Text style={styles.h3}>{L.keys}</Text>
            {data.keys.map((k, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={{ width: "50%" }}>{k.description}</Text>
                <Text style={{ width: "15%" }}>× {k.quantity}</Text>
                <Text style={[{ width: "35%" }, styles.muted]}>
                  {k.comments ?? ""}
                </Text>
              </View>
            ))}
          </>
        )}

        {data.detectors.length > 0 && (
          <>
            <Text style={styles.h3}>{L.detectors}</Text>
            {data.detectors.map((d, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={{ width: "40%" }}>{d.type}</Text>
                <Text style={{ width: "40%" }}>{d.location ?? ""}</Text>
                <Text style={{ width: "20%" }}>
                  {d.tested ? L.yes : L.no}
                </Text>
              </View>
            ))}
          </>
        )}
        <Footer data={data} />
      </Page>

      {/* One page per area */}
      {data.areas.map((area) => (
        <Page key={area.name} size="A4" style={styles.page}>
          <Text style={styles.h2}>{area.name}</Text>
          {area.sections.map((section) => (
            <View key={section.name} style={styles.sectionCard} wrap={false}>
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>
                  {section.name}
                </Text>
                <View style={[styles.row, { gap: 4 }]}>
                  <Badge value={section.condition} />
                  <Badge value={section.cleanliness} />
                </View>
              </View>

              {section.description ? (
                <Text style={{ marginTop: 4 }}>{section.description}</Text>
              ) : null}

              {section.flagged ? (
                <Text style={{ marginTop: 3, color: "#b45309" }}>
                  {L.maintenance}
                </Text>
              ) : null}

              {section.photos.length > 0 && (
                <View style={styles.photoGrid}>
                  {section.photos.map((photo, i) => (
                    <View key={i} style={styles.photoBox}>
                      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image takes no alt */}
                      <Image src={photo.url} style={styles.photo} />
                      <Text style={styles.caption}>{photo.takenAt}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
          <Footer data={data} />
        </Page>
      ))}

      {/* Defects and declarations */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>{L.defects}</Text>
        {defects.length === 0 ? (
          <Text style={styles.muted}>{L.noDefects}</Text>
        ) : (
          defects.map(({ area, s }, i) => (
            <View key={i} style={styles.sectionCard}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>
                {area.name} — {s.name}
              </Text>
              <View style={[styles.row, { gap: 4, marginTop: 3 }]}>
                <Badge value={s.condition} />
                <Badge value={s.cleanliness} />
              </View>
              {s.description ? (
                <Text style={{ marginTop: 3 }}>{s.description}</Text>
              ) : null}
            </View>
          ))
        )}

        <Text style={[styles.h2, { marginTop: 20 }]}>{L.declarations}</Text>
        {data.declarations.length === 0 ? (
          <Text style={styles.muted}>—</Text>
        ) : (
          data.declarations.map((d, i) => (
            <View key={i} style={{ marginBottom: 10 }}>
              <Text style={styles.muted}>{d.role}</Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{d.name}</Text>
              <Text style={styles.muted}>{d.signedAt}</Text>
            </View>
          ))
        )}
        <Footer data={data} />
      </Page>
    </Document>
  );
}
