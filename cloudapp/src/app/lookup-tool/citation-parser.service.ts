import { Injectable } from '@angular/core';

import {
  ParsedCitation,
  ParsedCreator,
  ParsedCitationType
} from '../models/parsed-citation.model';
@Injectable({
  providedIn: 'root'
})
export class CitationParserService {
  parseBlock(text: string, context: Partial<ParsedCitation>): ParsedCitation[] {
    const entries = this.splitEntries(text);
    return entries.map(entry => this.parseEntry(entry, context));
  }

  splitEntries(text: string): string[] {
    const normalized = (text || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    if (/\n\s*\n/.test(normalized)) {
      return normalized
        .split(/\n\s*\n/g)
        .map(x => this.cleanWhitespace(x))
        .filter(Boolean);
    }

    return normalized
      .split('\n')
      .map(x => x.replace(/^\s*(\[\d+\]|\d+\.)\s*/, ''))
      .map(x => this.cleanWhitespace(x))
      .filter(Boolean);
  }

  parseEntry(raw: string, context: Partial<ParsedCitation>): ParsedCitation {
    const creators = this.extractCreators(raw);
    const year = this.extractYear(raw);
    const title = this.extractTitle(raw, creators, year);
    const containerTitle = this.extractContainerTitle(raw, title);
    const publisher = this.extractPublisher(raw, title, containerTitle);
    const type = this.inferType(raw, title, containerTitle);

    return {
      raw,
      type,
      title,
      containerTitle,
      publisher,
      publicationPlace: '',
      year,
      volume: this.extractVolume(raw),
      issue: this.extractIssue(raw),
      pages: this.extractPages(raw),
      edition: '',
      doi: this.extractDoi(raw),
      isbn: this.extractIsbn(raw),
      issn: this.extractIssn(raw),
      url: this.extractUrl(raw),
      creators,
      parseWarnings: this.buildWarnings(raw, creators, title, year),
      confidence: null,
      courseName: context.courseName || '',
      instructor: context.instructor || '',
      courseNumber: context.courseNumber || '',
      courseSemester: context.courseSemester || '',
      courseTermForMapping: context.courseTermForMapping || '',
      courseYearForMapping: context.courseYearForMapping || ''
    };
  }

private extractYear(raw: string): string {
  const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));
  const match = cleaned.match(/\b([1-2]\d{3})\b/);
  return match ? match[1] : '';
}

    private getYearTokenMatch(raw: string): RegExpMatchArray | null {
    return raw.match(/\(?\b\d{4}\b\)?\.?/);
    }
    private cleanWhitespace(value: string): string {
        return value.replace(/\s+/g, ' ').trim();
    }

  private extractCreators(raw: string): ParsedCreator[] {
  const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));
  const pubBlock = this.getPublicationBlock(cleaned);

  let prefix = pubBlock ? pubBlock.prefix : cleaned;

  // For book-list style citations, creators usually come before the first title comma.
  // We also want to preserve markers like "(eds.)" or "trans." if they are attached to creators.
  const firstTitleComma = prefix.indexOf(',');
  if (firstTitleComma >= 0) {
    prefix = prefix.slice(0, firstTitleComma).trim();
  }

  let role: ParsedCreator['role'] = 'author';

  if (/\b(?:eds?\.?|edited by)\b/i.test(cleaned) || /\((?:eds?\.?)\)/i.test(cleaned)) {
    role = 'editor';
  } else if (/\b(?:trans\.?|translated by)\b/i.test(cleaned)) {
    role = 'translator';
  } else if (/\b(?:dir\.?|directed by)\b/i.test(cleaned)) {
    role = 'director';
  }

  prefix = prefix
    .replace(/^\s*(edited by|translated by|directed by)\s+/i, '')
    .replace(/\((?:eds?\.?|trans\.?|dir\.?)\)/gi, '')
    .replace(/\b(?:eds?\.?|trans\.?|dir\.)\b\.?/gi, '')
    .replace(/\bet al\.?\b/gi, '')
    .trim();

  if (!prefix) {
    return [];
  }

  const normalized = prefix
    .replace(/\s+and\s+/gi, '; ')
    .replace(/\s*&\s*/g, '; ')
    .replace(/\s*;\s*/g, '; ');

  const parts = normalized.split(';').map(x => x.trim()).filter(Boolean);

  return parts.map((name): ParsedCreator => {
    const tokens = name.split(/\s+/).filter(Boolean);

    if (tokens.length === 1) {
      return {
        family: tokens[0],
        given: '',
        role
      };
    }

    return {
      family: tokens[tokens.length - 1],
      given: tokens.slice(0, -1).join(' '),
      role
    };
  });
}
private splitPrefixIntoCreatorsAndTitle(raw: string): { creatorPart: string; titlePart: string } {
  const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));
  const pubBlock = this.getPublicationBlock(cleaned);
  const prefix = pubBlock ? pubBlock.prefix : cleaned;

  // Case: "... , eds., Title"
  const roleSplit = prefix.match(/^(.*?\b(?:eds?\.?|trans\.?|dir\.?)\b\.?),\s*(.+)$/i);
  if (roleSplit) {
    return {
      creatorPart: roleSplit[1].trim(),
      titlePart: roleSplit[2].trim()
    };
  }

  // Otherwise split on the first comma followed by what looks like a title
  const idx = prefix.indexOf(',');
  if (idx >= 0) {
    return {
      creatorPart: prefix.slice(0, idx).trim(),
      titlePart: prefix.slice(idx + 1).trim()
    };
  }

  return {
    creatorPart: '',
    titlePart: prefix.trim()
  };
}
private stripTrailingCallNumber(raw: string): string {
  return raw
    .replace(/\)\.\s*[A-Z]{1,3}\s*[A-Z0-9.\- ]+(?:\s+\d{4})?\s*$/u, ').')
    .replace(/\)\s*[A-Z]{1,3}\s*[A-Z0-9.\- ]+(?:\s+\d{4})?\s*$/u, ')')
    .trim();
}

private getPublicationBlock(raw: string): { prefix: string; parenContent: string } | null {
  const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));
  const match = cleaned.match(/^(.*?)(\(([^()]*(?:\d{4})[^()]*)\))\.?$/);

  if (!match) {
    return null;
  }

  return {
    prefix: match[1].trim().replace(/[,;:\s]+$/, ''),
    parenContent: match[3].trim()
  };
}
private extractTitle(raw: string, creators: ParsedCreator[], year: string): string {
  const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));
  const parts = this.splitPrefixIntoCreatorsAndTitle(cleaned);

  let title = parts.titlePart || '';

  // Remove dangling creator-role fragments at the start if still present
  title = title
    .replace(/^\(?\b(?:eds?\.?|trans\.?|dir\.?)\b\)?\.?,?\s*/i, '')
    .replace(/^["“]/, '')
    .replace(/["”]$/, '')
    .trim();

  return title;
}

private extractContainerTitle(raw: string, title: string): string {
  let working = this.cleanWhitespace(raw);

  if (!working || !title) {
    return '';
  }

  const quotedTitle = new RegExp(`["“]${this.escapeRegExp(title)}["”]`);
  if (quotedTitle.test(working)) {
    working = working.replace(quotedTitle, '').trim();
  } else {
    const titleIndex = working.indexOf(title);
    if (titleIndex >= 0) {
      working = working.slice(titleIndex + title.length).trim();
    }
  }

  working = working.replace(/^[:;.,)\]\s-]+/, '').trim();

  // "In Container Title"
  const inMatch = working.match(/\bIn\s+([^.,]+(?:\.[^.,]+)*)/i);
  if (inMatch) {
    return inMatch[1].trim();
  }

  // Journal-like chunk before vol/no/pages
  const journalMatch = working.match(/^([^.,]+?)(?=,?\s*(?:vol\.?|no\.?|issue|pp?\.?|doi\b|\d+\s*\())/i);
  if (journalMatch) {
    return journalMatch[1].trim();
  }

  return '';
}

private extractPublisher(raw: string, title: string, containerTitle: string): string {
  const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));
  const pubBlock = this.getPublicationBlock(cleaned);

  if (!pubBlock) {
    return '';
  }

  const content = pubBlock.parenContent;

  // "Place: Publisher, Year"
  const colonMatch = content.match(/^[^:]+:\s*(.+?)(?:,\s*[1-2]\d{3})$/);
  if (colonMatch) {
    return colonMatch[1].trim();
  }

  // "Publisher Year"
  const simpleMatch = content.match(/^(.+?)\s+([1-2]\d{3})$/);
  if (simpleMatch) {
    return simpleMatch[1].trim();
  }

  return content.replace(/\b[1-2]\d{3}\b/g, '').replace(/[,:]\s*$/, '').trim();
}

private escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

  private inferType(raw: string, title: string, containerTitle: string): ParsedCitationType {
    const value = raw.toLowerCase();

    if (/\bdoi\b|\bvol\.?\b|\bno\.?\b|\bissue\b|\bpp?\.?\b/.test(value)) return 'article';
    if (/\bin: /i.test(raw)) return 'chapter';
    if (/\bisbn\b|\bpress\b|\bpublisher\b/.test(value)) return 'book';
    if (/\bdvd\b|\bfilm\b|\bstreaming\b|\bdirected by\b/.test(value)) return 'video';
    if (/https?:\/\//.test(raw)) return 'webpage';

    return 'unknown';
  }

  private extractVolume(raw: string): string {
    const match = raw.match(/\bvol\.?\s*([A-Za-z0-9\-]+)/i);
    return match ? match[1] : '';
  }

  private extractIssue(raw: string): string {
    const match = raw.match(/\bno\.?\s*([A-Za-z0-9\-]+)/i);
    return match ? match[1] : '';
  }

  private extractPages(raw: string): string {
    const match = raw.match(/\bpp?\.?\s*([0-9\-–]+)/i);
    return match ? match[1] : '';
  }

  private extractDoi(raw: string): string {
    const match = raw.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i);
    return match ? match[0] : '';
  }

  private extractIsbn(raw: string): string {
    const match = raw.match(/\b(?:97[89][-\s]?)?[0-9][0-9\-\s]{8,}[0-9Xx]\b/);
    return match ? match[0] : '';
  }

  private extractIssn(raw: string): string {
    const match = raw.match(/\b\d{4}-\d{3}[\dXx]\b/);
    return match ? match[0] : '';
  }

  private extractUrl(raw: string): string {
    const match = raw.match(/https?:\/\/\S+/i);
    return match ? match[0] : '';
  }

  private buildWarnings(
    raw: string,
    creators: ParsedCreator[],
    title: string,
    year: string
  ): string[] {
    const warnings: string[] = [];
    if (!creators.length) warnings.push('No creators detected');
    if (!title) warnings.push('No title detected');
    if (!year) warnings.push('No year detected');
    if (raw.length > 300) warnings.push('Long citation; review recommended');
    return warnings;
  }
}