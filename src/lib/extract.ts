"use client";

// On-device text extraction, mirroring the original app's ML Kit OCR +
// Syncfusion PDF text extraction — here via Tesseract.js (images) and
// pdfjs-dist (PDFs), both running entirely in the browser.

export async function ocrImage(file: Blob, onProgress?: (p: number) => void): Promise<string> {
  const Tesseract = await import("tesseract.js");
  const { data } = await Tesseract.recognize(file, "eng", {
    logger: (m: any) => {
      if (m.status === "recognizing text" && onProgress) onProgress(m.progress);
    },
  });
  return data.text.trim();
}

export async function extractPdfText(file: Blob): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(" ") + "\n\n";
  }
  return text.trim();
}
