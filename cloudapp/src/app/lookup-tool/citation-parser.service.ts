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

    return entries
      .filter(entry => !this.isLikelyCallNumber(entry))
      .map(entry => this.parseEntry(entry, context))
      .filter(entry => !!entry.title || !!entry.creators.length || !!entry.year);
  }

  splitEntries(text: string): string[] {
    const normalized = (text || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return [];
    }

    // First split on blank lines.
    let entries = normalized
      .split(/\n\s*\n/g)
      .map(x => this.cleanWhitespace(x))
      .filter(Boolean);

    // If there were no blank-line separations, treat each line as an entry.
    if (entries.length <= 1) {
      entries = normalized
        .split('\n')
        .map(x => x.replace(/^\s*(\[\d+\]|\d+\.)\s*/, ''))
        .map(x => this.cleanWhitespace(x))
        .filter(Boolean);
    }

    return entries;
  }

  parseEntry(raw: string, context: Partial<ParsedCitation>): ParsedCitation {
    const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));
    const creators = this.extractCreators(cleaned);
    const year = this.extractYear(cleaned);
    const title = this.extractTitle(cleaned, creators, year);
    const containerTitle = this.extractContainerTitle(cleaned, title);
    const publisher = this.extractPublisher(cleaned, title, containerTitle);
    const publicationPlace = this.extractPublicationPlace(cleaned);
    const type = this.inferType(cleaned, title, containerTitle);

    return {
      raw,
      type,
      title,
      containerTitle,
      publisher,
      publicationPlace,
      year,
      volume: this.extractVolume(cleaned),
      issue: this.extractIssue(cleaned),
      pages: this.extractPages(cleaned),
      edition: '',
      doi: this.extractDoi(cleaned),
      isbn: this.extractIsbn(cleaned),
      issn: this.extractIssn(cleaned),
      url: this.extractUrl(cleaned),
      creators,
      parseWarnings: this.buildWarnings(cleaned, creators, title, year),
      confidence: null,
      courseName: context.courseName || '',
      instructor: context.instructor || '',
      courseNumber: context.courseNumber || '',
      courseSemester: context.courseSemester || '',
      courseTermForMapping: context.courseTermForMapping || '',
      courseYearForMapping: context.courseYearForMapping || ''
    };
  }

  private cleanWhitespace(value: string): string {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private isLikelyCallNumber(raw: string): boolean {
    const cleaned = this.cleanWhitespace(raw);

    // LC call-number-ish lines:
    // HT166 .G438 2010
    // PN1998.3.H36875 A3 2017
    // JC179.M753 B54 2016
    // E184.A75 L86 2017
    return /^[A-Z]{1,3}\d+(?:\.\d+)?(?:\s+[A-Z0-9.]+)+(?:\s+\d{4})?$/u.test(cleaned);
  }

  private stripTrailingCallNumber(raw: string): string {
    return raw
      .replace(/\.\s*[A-Z]{1,3}\d+(?:\.\d+)?(?:\s+[A-Z0-9.]+)+(?:\s+\d{4})?\s*$/u, '.')
      .replace(/\s+[A-Z]{1,3}\d+(?:\.\d+)?(?:\s+[A-Z0-9.]+)+(?:\s+\d{4})?\s*$/u, '')
      .trim();
  }

  private splitAuthorYearParenCitation(raw: string): { creatorPart: string; year: string; rest: string } | null {
    const cleaned = this.cleanWhitespace(raw);
    const match = cleaned.match(/^(.+?)\s*\((\d{4})\)[,\.]?\s*(.+)$/u);

    if (!match) {
      return null;
    }

    return {
      creatorPart: match[1].trim().replace(/[,;:\s]+$/u, ''),
      year: match[2],
      rest: match[3].trim()
    };
  }

  private splitAuthorDateCitation(raw: string): { creatorPart: string; year: string; rest: string } | null {
    const cleaned = this.cleanWhitespace(raw);

    // Chicago-ish:
    // Gehl, Jan. 2010. Cities for people. Washington, DC: Island Press.
    // Harris, Brandon. 2017. Making rent in Bed-Stuy. New York: Harper-Collins.
    const match = cleaned.match(/^(.+?)\.\s+([1-2]\d{3})\.\s+(.+)$/u);

    if (!match) {
      return null;
    }

    return {
      creatorPart: match[1].trim(),
      year: match[2],
      rest: match[3].trim()
    };
  }

  private getPublicationBlock(raw: string): { prefix: string; parenContent: string } | null {
    const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));
    const match = cleaned.match(/^(.*?)(\(([^()]*(?:\d{4})[^()]*)\))\.?$/u);

    if (!match) {
      return null;
    }

    return {
      prefix: match[1].trim().replace(/[,;:\s]+$/u, ''),
      parenContent: match[3].trim()
    };
  }

  private parseCreatorString(
    creatorText: string,
    role: ParsedCreator['role']
  ): ParsedCreator[] {
    let working = this.cleanWhitespace(creatorText)
      .replace(/^\s*(edited by|translated by|directed by)\s+/i, '')
      .replace(/\((?:eds?\.?|trans\.?|dir\.?)\)/gi, '')
      .replace(/\b(?:eds?\.?|trans\.?|dir\.)\b\.?/gi, '')
      .replace(/\bet al\.?\b/gi, '')
      .trim();

    if (!working) {
      return [];
    }

    working = working
      .replace(/\s+and\s+/gi, '; ')
      .replace(/\s*&\s*/g, '; ')
      .replace(/\s*;\s*/g, '; ');

    const parts = working.split(';').map(x => x.trim()).filter(Boolean);

    return parts.map((name): ParsedCreator => {
      // Last, First
      if (name.includes(',')) {
        const bits = name.split(',').map(x => x.trim()).filter(Boolean);
        return {
          family: bits[0] || '',
          given: bits.slice(1).join(' '),
          role
        };
      }

      // First Last
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

  private splitBookListPrefix(raw: string): { creatorPart: string; titlePart: string } {
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

    // Split on the first comma for book-list style:
    // "August Reinisch, Advanced Introduction ..."
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

  private extractYear(raw: string): string {
    const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));

    const parenSplit = this.splitAuthorYearParenCitation(cleaned);
    if (parenSplit) {
      return parenSplit.year;
    }

    const authorDateSplit = this.splitAuthorDateCitation(cleaned);
    if (authorDateSplit) {
      return authorDateSplit.year;
    }

    const pubBlock = this.getPublicationBlock(cleaned);
    if (pubBlock) {
      const pubYear = pubBlock.parenContent.match(/\b([1-2]\d{3})\b/u);
      if (pubYear) {
        return pubYear[1];
      }
    }

    const match = cleaned.match(/\b([1-2]\d{3})\b/u);
    return match ? match[1] : '';
  }

  private extractCreators(raw: string): ParsedCreator[] {
    const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));

    const parenSplit = this.splitAuthorYearParenCitation(cleaned);
    if (parenSplit) {
      return this.parseCreatorString(parenSplit.creatorPart, 'author');
    }

    const authorDateSplit = this.splitAuthorDateCitation(cleaned);
    if (authorDateSplit) {
      return this.parseCreatorString(authorDateSplit.creatorPart, 'author');
    }

    const bookSplit = this.splitBookListPrefix(cleaned);

    let role: ParsedCreator['role'] = 'author';
    if (/\b(?:eds?\.?|edited by)\b/i.test(bookSplit.creatorPart) || /\((?:eds?\.?)\)/i.test(bookSplit.creatorPart)) {
      role = 'editor';
    } else if (/\b(?:trans\.?|translated by)\b/i.test(bookSplit.creatorPart)) {
      role = 'translator';
    } else if (/\b(?:dir\.?|directed by)\b/i.test(bookSplit.creatorPart)) {
      role = 'director';
    }

    return this.parseCreatorString(bookSplit.creatorPart, role);
  }

  private extractTitle(raw: string, _creators: ParsedCreator[], _year: string): string {
    const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));

    const parenSplit = this.splitAuthorYearParenCitation(cleaned);
    if (parenSplit) {
      return parenSplit.rest
        .replace(/,\s*chs?\b.*$/i, '')
        .replace(/,\s*\(pp[,.\s0-9\-–]+\)\.?$/i, '')
        .replace(/\s*\(pp[,.\s0-9\-–]+\)\.?$/i, '')
        .replace(/\.$/, '')
        .trim();
    }

    const authorDateSplit = this.splitAuthorDateCitation(cleaned);
    if (authorDateSplit) {
      // For Chicago author-date book citations:
      // Title. Place: Publisher.
      const rest = authorDateSplit.rest;

      const match = rest.match(/^(.*?)(?:\.\s+[^.:]+:\s+.+)?\.?$/u);
      if (match && match[1]) {
        return match[1].trim().replace(/\.$/, '');
      }

      return rest.replace(/\.$/, '').trim();
    }

    const bookSplit = this.splitBookListPrefix(cleaned);
    let title = bookSplit.titlePart || '';

    title = title
      .replace(/^\(?\b(?:eds?\.?|trans\.?|dir\.?)\b\)?\.?,?\s*/i, '')
      .replace(/^["“]/, '')
      .replace(/["”]$/, '')
      .replace(/\.$/, '')
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

    const inMatch = working.match(/\bIn\s+([^.,]+(?:\.[^.,]+)*)/i);
    if (inMatch) {
      return inMatch[1].trim();
    }

    const journalMatch = working.match(/^([^.,]+?)(?=,?\s*(?:vol\.?|no\.?|issue|pp?\.?|doi\b|\d+\s*\())/i);
    if (journalMatch) {
      return journalMatch[1].trim();
    }

    return '';
  }

  private extractPublisher(raw: string, title: string, _containerTitle: string): string {
    const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));

    // Parenthetical book-list publication block
    const pubBlock = this.getPublicationBlock(cleaned);
    if (pubBlock) {
      const content = pubBlock.parenContent;

      const colonMatch = content.match(/^[^:]+:\s*(.+?)(?:,\s*[1-2]\d{3})$/u);
      if (colonMatch) {
        return colonMatch[1].trim();
      }

      const simpleMatch = content.match(/^(.+?)\s+([1-2]\d{3})$/u);
      if (simpleMatch) {
        return simpleMatch[1].trim();
      }

      return content.replace(/\b[1-2]\d{3}\b/gu, '').replace(/[,:]\s*$/, '').trim();
    }

    // Chicago author-date book citation:
    // Author. Year. Title. Place: Publisher.
    const authorDateSplit = this.splitAuthorDateCitation(cleaned);
    if (authorDateSplit) {
      const afterTitle = authorDateSplit.rest;
      const pubMatch = afterTitle.match(/\.\s+([^.:]+):\s+(.+?)\.?$/u);
      if (pubMatch) {
        return pubMatch[2].trim().replace(/\.$/, '');
      }
    }

    return '';
  }

  private extractPublicationPlace(raw: string): string {
    const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));

    const pubBlock = this.getPublicationBlock(cleaned);
    if (pubBlock) {
      const match = pubBlock.parenContent.match(/^([^:]+):/u);
      return match ? match[1].trim() : '';
    }

    const authorDateSplit = this.splitAuthorDateCitation(cleaned);
    if (authorDateSplit) {
      const pubMatch = authorDateSplit.rest.match(/\.\s+([^.:]+):\s+(.+?)\.?$/u);
      if (pubMatch) {
        return pubMatch[1].trim();
      }
    }

    return '';
  }

  private inferType(raw: string, _title: string, _containerTitle: string): ParsedCitationType {
    const value = raw.toLowerCase();

    if (/\bdoi\b|\bvol\.?\b|\bno\.?\b|\bissue\b|\bpp?\.?\b/.test(value)) return 'article';
    if (/\bin:\s/i.test(raw)) return 'chapter';
    if (/\bdvd\b|\bfilm\b|\bstreaming\b|\bdirected by\b/.test(value)) return 'video';
    if (/https?:\/\//.test(raw)) return 'webpage';
    if (/\bpress\b|\bpublisher\b|:\s+[^.]+$|\(\s*[^)]*\d{4}\s*\)/i.test(raw)) return 'book';

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