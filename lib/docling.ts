import fs from 'fs/promises';
import path from 'path';
import { outputsDir, toRelativePath } from './storage';

const stubMarkdown = (fileName: string) => `# ${fileName}\n\n## Abstract\n- This is a placeholder summary generated locally.\n- Connect your Docling service to replace this output.\n\n## Method\n- Outline the pipeline stages.\n- Highlight key contributions.\n\n## Results\n- Add quantitative highlights.\n- Include notable ablations.\n\n## Conclusion\n- Summarize the impact and next steps.`;

export const convertPdfToMarkdown = async (pdfPath: string, jobId: string) => {
  const outputDir = outputsDir(jobId);
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'doc.md');

  let markdown: string;

  if (process.env.DOCLING_URL) {
    const buffer = await fs.readFile(pdfPath);
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'application/pdf' });
    formData.append('file', blob, path.basename(pdfPath));

    const response = await fetch(`${process.env.DOCLING_URL}/convert`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Docling failed: ${response.status}`);
    }

    const data = await response.json();
    markdown = data.markdown ?? '';
  } else {
    markdown = stubMarkdown(path.basename(pdfPath));
  }

  await fs.writeFile(outputPath, markdown, 'utf8');

  return {
    markdown,
    docPath: toRelativePath(outputPath)
  };
};
