/**
 * 마크다운에서 어노테이션 번호를 HTML 태그로 변환
 */
export function insertAnnotationToMarkdown(markdown: string, number: number): string {
  const annotationTag = `<span data-type="annotation" data-number="${number}">[${number}]</span>`;
  
  // 마크다운 끝에 줄넘김 후 추가
  const trimmedMarkdown = markdown.trimEnd();
  return trimmedMarkdown + annotationTag;
}

/**
 * 마크다운에서 어노테이션 번호 업데이트
 */
export function updateAnnotationInMarkdown(
  markdown: string,
  oldNumber: number,
  newNumber: number
): string {
  const oldPattern = new RegExp(
    `<span\\s+data-type="annotation"\\s+data-number="${oldNumber}">\\[${oldNumber}\\]</span>`,
    "g"
  );
  const newTag = `<span data-type="annotation" data-number="${newNumber}">[${newNumber}]</span>`;
  
  return markdown.replace(oldPattern, newTag);
}

/**
 * 마크다운에서 어노테이션 번호 제거
 */
export function removeAnnotationFromMarkdown(markdown: string, number: number): string {
  const pattern = new RegExp(
    `\\s*<span\\s+data-type="annotation"\\s+data-number="${number}">\\[${number}\\]</span>`,
    "g"
  );
  
  return markdown.replace(pattern, "");
}

/**
 * 마크다운에서 모든 어노테이션 번호 추출
 */
export function extractAnnotationNumbers(markdown: string): number[] {
  const pattern = /<span\s+data-type="annotation"\s+data-number="(\d+)">\[\d+\]<\/span>/g;
  const numbers: number[] = [];
  let match;
  
  while ((match = pattern.exec(markdown)) !== null) {
    numbers.push(parseInt(match[1], 10));
  }
  
  return numbers;
}

