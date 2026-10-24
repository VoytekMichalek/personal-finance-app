// Small deterministic PDF fixture; keeps test data synthetic and auditable.
export function statementPdf(pages: string[][]): Buffer {
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
  ];
  const kids: number[] = [];
  for (const lines of pages) {
    const pageId = objects.length + 1,
      streamId = pageId + 1;
    kids.push(pageId);
    const content =
      "BT /F1 10 Tf 40 790 Td 15 TL " +
      lines
        .map(
          (line, i) =>
            (i ? "T* " : "") + "(" + line.replace(/[\\()]/g, "\\$&") + ") Tj",
        )
        .join("\n") +
      " ET";
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    );
  }
  objects[1] = `<< /Type /Pages /Count ${kids.length} /Kids [${kids.map((id) => id + " 0 R").join(" ")}] >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
export function sixMonthStatement() {
  let balance = 1000;
  return Array.from({ length: 6 }, (_, i) => {
    const month = String(i + 1).padStart(2, "0");
    const lines = [
      "Household bank statement 2026",
      ...(i === 0 ? ["Opening balance 1,000.00"] : []),
      "Date       Details                 Amount       Balance",
    ];
    balance += 3000;
    lines.push(
      `01/${month}/2026 Salary                  +3000.00     ${balance.toFixed(2)}`,
    );
    balance -= 20;
    lines.push(
      `02/${month}/2026 Netflix                  -20.00       ${balance.toFixed(2)}`,
    );
    if (i === 5) lines.push("Closing balance " + balance.toFixed(2));
    return lines;
  });
}
