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

/** Extracts the readable text from a modern Word document. Kept browser-side
 * so a chat attachment never has to leave the student's device just to be
 * converted into text. */
export async function extractDocxText(file: Blob): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value.trim();
}

/** PowerPoint files are ZIP archives. Slide XML contains the visible text in
 * <a:t> elements, so reading those elements gives a useful study transcript
 * without sending the deck to a third party. */
export async function extractPptxText(file: Blob): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const archive = await JSZip.loadAsync(await file.arrayBuffer());
  const slideNames = Object.keys(archive.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1]) - Number(b.match(/slide(\d+)/i)?.[1]));
  const slides = await Promise.all(slideNames.map(async (name) => {
    const xml = await archive.files[name].async("string");
    return Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
      .map((match) => match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"))
      .join(" ");
  }));
  return slides.filter(Boolean).join("\n\n").trim();
}
