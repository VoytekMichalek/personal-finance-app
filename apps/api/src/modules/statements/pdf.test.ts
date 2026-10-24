import { expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { deflateSync } from "node:zlib";
import { statementPdf } from "../../integration/statement-fixture.js";
import { extractPdf } from "./pdf.js";
it("reads an image-only bank statement with actual OCR", async () => {
  const dir = await mkdtemp(tmpdir() + "/finance-ocr-test-");
  try {
    const source = statementPdf([
      [
        "Bank statement 2026",
        "Opening balance 1000.00",
        "01/01/2026 Salary +3000.00",
        "02/01/2026 Netflix -20.00",
        "Closing balance 3980.00",
      ],
    ]);
    await writeFile(dir + "/source.pdf", source);
    await promisify(execFile)("pdftoppm", [
      "-singlefile",
      "-scale-to",
      "1800",
      dir + "/source.pdf",
      dir + "/scan",
    ]);
    const ppm = await readFile(dir + "/scan.ppm");
    const header = ppm
      .toString("ascii", 0, 80)
      .match(/^P6\s+(\d+)\s+(\d+)\s+255\s/)!;
    const pixels = deflateSync(ppm.subarray(header[0].length));
    const objects = [
      Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
      Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
      Buffer.from(
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>",
      ),
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${header[1]} /Height ${header[2]} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${pixels.length} >>\nstream\n`,
        ),
        pixels,
        Buffer.from("\nendstream"),
      ]),
    ];
    const content = "q 612 0 0 842 0 0 cm /Im0 Do Q";
    objects.push(
      Buffer.from(
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      ),
    );
    let pdf = Buffer.from("%PDF-1.4\n");
    const offsets = [0];
    for (const [i, obj] of objects.entries()) {
      offsets.push(pdf.length);
      pdf = Buffer.concat([
        pdf,
        Buffer.from(`${i + 1} 0 obj\n`),
        obj,
        Buffer.from("\nendobj\n"),
      ]);
    }
    const xref = pdf.length;
    pdf = Buffer.concat([
      pdf,
      Buffer.from(
        `xref\n0 6\n0000000000 65535 f \n${offsets
          .slice(1)
          .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
          .join(
            "",
          )}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
      ),
    ]);
    // Real OCR subprocess timing is intentionally retained: browser clocks cannot model it.
    const pages = await extractPdf(pdf);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain("Salary");
    expect(pages[0]).toContain("Netflix");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 30000);
