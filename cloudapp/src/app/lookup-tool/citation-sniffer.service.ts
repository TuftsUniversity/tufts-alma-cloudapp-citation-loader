import { Injectable } from '@angular/core';

export interface CitationSniffContext {
  courseName?: string;
  instructorLastName?: string;
  courseNumber?: string;
  courseSemester?: string;
  courseTermForMapping?: string;
  courseYearForMapping?: string;
}

export interface CitationInputRow {
  'Author First': string;
  'Author Last': string;
  'Contributor First': string;
  'Contributor Last': string;
  'Title': string;
  'Publisher': string;
  'Year': string;
  'Course Number': string;
  'Course Semester': string;
  'Instructor Last Name': string;
  'Format': string;
  'Course Term for Mapping'?: string;
  'Course Year for Mapping'?: string;
  'Raw Citation'?: string;
  'Course Name - Input'?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CitationSnifferService {

  parseCitationsBlock(text: string, context: CitationSniffContext): CitationInputRow[] {
    const citations = this.splitReferences(text);

    return citations
      .map(citation => this.parseSingleCitation(citation, context))
      .filter(row => !!row.Title || !!row['Author Last'] || !!row.Year);
  }

  private splitReferences(text: string): string[] {
    if (!text) {
      return [];
    }

    const normalized = text
      .replace(/\r\n/g, '\n')
      .replace(/\u00A0/g, ' ')
      .trim();

    // Prefer blank-line splitting if present; otherwise one line = one citation.
    if (/\n\s*\n/.test(normalized)) {
      return normalized
        .split(/\n\s*\n/g)
        .map(x => this.normalizeWhitespace(x))
        .filter(Boolean);
    }

    return normalized
      .split('\n')
      .map(x => this.normalizeWhitespace(x))
      .filter(Boolean);
  }

  private parseSingleCitation(citation: string, context: CitationSniffContext): CitationInputRow {
    const clean = this.normalizeWhitespace(citation);

    const yearMatch = clean.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : '';

    const beforeYear = yearMatch ? clean.slice(0, yearMatch.index).trim() : '';
    const afterYear = yearMatch
      ? clean.slice((yearMatch.index || 0) + year.length).trim()
      : clean;

    const author = this.parseAuthorBlock(beforeYear);
    const title = this.extractTitle(afterYear);
    const publisher = this.extractPublisher(afterYear, title);
    const format = this.inferFormat(clean, title);

    return {
      'Author First': author.first,
      'Author Last': author.last,
      'Contributor First': '',
      'Contributor Last': '',
      'Title': title,
      'Publisher': publisher,
      'Year': year,
      'Course Number': context.courseNumber || '',
      'Course Semester': context.courseSemester || '',
      'Instructor Last Name': context.instructorLastName || '',
      'Format': format,
      'Course Term for Mapping': context.courseTermForMapping || '',
      'Course Year for Mapping': context.courseYearForMapping || '',
      'Raw Citation': citation,
      'Course Name - Input': context.courseName || ''
    };
  }

  private parseAuthorBlock(block: string): { first: string; last: string } {
    const cleaned = this.normalizeWhitespace(
      block
        .replace(/\.$/, '')
        .replace(/\bet al\.?$/i, '')
    );

    if (!cleaned) {
      return { first: '', last: '' };
    }

    // Handle "Last, First"
    if (cleaned.includes(',')) {
      const parts = cleaned.split(',').map(x => x.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return {
          last: parts[0],
          first: parts[1]
        };
      }
    }

    // Handle "First Last"
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
      return { first: '', last: tokens[0] };
    }

    return {
      first: tokens.slice(0, -1).join(' '),
      last: tokens[tokens.length - 1]
    };
  }

  private extractTitle(afterYear: string): string {
    if (!afterYear) {
      return '';
    }

    const stripped = afterYear
      .replace(/^[:;.,)\]\s-]+/, '')
      .trim();

    const sentenceParts = stripped
      .split(/\. (?=[A-Z"“‘'])/)
      .map(x => x.trim())
      .filter(Boolean);

    if (sentenceParts.length === 0) {
      return '';
    }

    let candidate = sentenceParts[0];

    candidate = candidate
      .replace(/^["“]/, '')
      .replace(/["”]$/, '')
      .replace(/\s+\(\d{4}\)$/, '')
      .trim();

    // If title starts with container hints, likely we missed the title
    if (/^(In|Journal|Vol\.|Volume|pp\.|Pages)\b/i.test(candidate) && sentenceParts.length > 1) {
      candidate = sentenceParts[1];
    }

    return candidate;
  }

  private extractPublisher(afterYear: string, title: string): string {
    if (!afterYear) {
      return '';
    }

    let remainder = afterYear;

    if (title) {
      const titleIndex = remainder.indexOf(title);
      if (titleIndex >= 0) {
        remainder = remainder.slice(titleIndex + title.length).trim();
      }
    }

    remainder = remainder.replace(/^[:;.,)\]\s-]+/, '').trim();

    const parts = remainder
      .split('.')
      .map(x => x.trim())
      .filter(Boolean);

    for (const part of parts) {
      if (
        !/\b(pp?|pages?|vol|no|issue|doi|isbn|issn)\b/i.test(part) &&
        !/^\d+$/.test(part)
      ) {
        return part;
      }
    }

    return '';
  }

  private inferFormat(citation: string, title: string): string {
    const value = `${citation} ${title}`.toLowerCase();

    if (/\bjournal\b|\bvol\.?\b|\bno\.?\b|\bissue\b|\bpp\.?\b|\bdoi\b/.test(value)) {
      return 'Article';
    }

    if (/\bedited by\b|\bpublisher\b|\bpress\b|\bisbn\b/.test(value)) {
      return 'Book';
    }

    if (/\bfilm\b|\bdvd\b|\bstreaming\b|\bvideo\b/.test(value)) {
      return 'Video';
    }

    if (/\bchapter\b|\bin:/.test(value)) {
      return 'Book Chapter';
    }

    return 'Book';
  }

  private normalizeWhitespace(value: string): string {
    return (value || '').replace(/\s+/g, ' ').trim();
  }
}